"""Ownership rules shared by reflection, autogenerate and empty-DB compares."""

import re

import sqlalchemy as sa
from alembic.operations import ops
from .ops import RemoveRowsOp, ModifyRowsOp


_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_$]*(?:\.(?:\*|[A-Za-z_][A-Za-z0-9_$]*))?")


class ExternalTables:
    def __init__(self, patterns=()):
        if not isinstance(patterns, (list, tuple)):
            raise ValueError("ignore_table must be a list of table, schema.table, or schema.* entries")
        for pattern in patterns:
            if not isinstance(pattern, str) or not _PATTERN.fullmatch(pattern):
                raise ValueError(
                    f"invalid ignore_table entry {pattern!r}: expected table, schema.table, "
                    "or schema.* (no prefix globs or quoted identifiers)"
                )
        self.patterns = tuple(sorted(set(patterns)))
        self.default_schema = None
        self.visible_schemas = {}

    def configure(self, connection, schema_name=None):
        self.default_schema = schema_name or connection.dialect.default_schema_name
        self.visible_schemas = {}
        if not self.patterns and not schema_name:
            return
        if connection.dialect.name == "postgresql":
            self.default_schema = schema_name or connection.scalar(sa.text("SELECT current_schema()"))
            # schema=None in SQLAlchemy means visible via search_path, which need
            # not mean current_schema(). Keep same-named tables distinct.
            self.visible_schemas = dict(connection.execute(sa.text("""
                SELECT c.relname, n.nspname
                FROM pg_catalog.pg_class c
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind IN ('r', 'p') AND pg_catalog.pg_table_is_visible(c.oid)
            """)).all())

    def schema_for(self, name, schema=None, reflected=False):
        if schema is not None:
            return schema
        if reflected:
            return self.visible_schemas.get(name, self.default_schema)
        return self.default_schema

    def matches(self, name, schema=None, reflected=False):
        schema = self.schema_for(name, schema, reflected)
        for pattern in self.patterns:
            if "." not in pattern:
                if schema == self.default_schema and name == pattern:
                    return True
            else:
                pattern_schema, table = pattern.split(".")
                if schema == pattern_schema and (table == "*" or name == table):
                    return True
        return False

    def validate_metadata(self, metadata):
        for table in metadata.tables.values():
            if self.matches(table.name, table.schema):
                raise ValueError(
                    f"ignoreTables matches managed table {table.fullname!r}; "
                    "remove its Ent schema before declaring it external"
                )
            for fk in table.foreign_keys:
                schema, name, _ = fk._column_tokens
                if self.matches(name, schema):
                    raise ValueError(
                        f"managed foreign key {table.fullname}.{fk.parent.name} references "
                        f"ignored table {fk.target_fullname!r}; manage this foreign key "
                        "in an external migration instead"
                    )

    def foreign_key_is_external(self, constraint, reflected=False):
        for fk in constraint.elements:
            schema, table, _ = fk._column_tokens
            if self.matches(table, schema, reflected):
                return True
        return False

    def guard_dependencies(self, autogen_context, upgrade_ops, dev_schema=None):
        """Fail before emitting destructive changes to an external FK endpoint.

        External migrations own FKs crossing the ownership boundary, including
        existing FKs on a managed table that point to an external table.
        """
        if not self.patterns or not upgrade_ops.ops:
            return

        dangerous = []

        def collect(container):
            for op in container.ops:
                if isinstance(op, ops.OpContainer):
                    collect(op)
                elif isinstance(op, (ops.DropTableOp, ops.DropColumnOp, ops.DropIndexOp,
                                     ops.DropConstraintOp, RemoveRowsOp, ModifyRowsOp)) or (
                    isinstance(op, ops.AlterColumnOp) and (
                        op.modify_type is not None or op.modify_name is not None
                    )
                ):
                    dangerous.append(op)

        collect(upgrade_ops)
        if not dangerous:
            return

        inspector = autogen_context.inspector
        # Include explicit external schemas without widening Ent's comparison
        # scope. Dev-schema mode reflects only its own schema's tables.
        schemas = {self.default_schema}
        if not dev_schema:
            schemas.update(p.split(".")[0] for p in self.patterns if "." in p)
        available = set(inspector.get_schema_names())
        endpoints = set()
        referenced = set()

        def add_dependency(schema, table, columns, target_schema, target, target_columns):
            endpoints.add((schema, table, None))
            endpoints.add((target_schema, target, None))
            endpoints.update((schema, table, c) for c in columns)
            endpoints.update((target_schema, target, c) for c in target_columns)
            referenced.add((target_schema, target, None))
            referenced.update((target_schema, target, c) for c in target_columns)

        for schema in sorted(schemas & available):
            for table in inspector.get_table_names(schema=schema):
                owner_external = self.matches(table, schema)
                for fk in inspector.get_foreign_keys(table, schema=schema):
                    target = fk["referred_table"]
                    target_schema = self.schema_for(target, fk["referred_schema"], reflected=True)
                    if not owner_external and not self.matches(target, target_schema):
                        continue
                    add_dependency(schema, table, fk["constrained_columns"],
                                   target_schema, target, fk["referred_columns"])

        if dev_schema:
            # Inspect dependencies *on the dev schema*, without reflecting or
            # comparing tables in public or other schemas. Postgres may rewrite
            # an inbound FK implicitly when ALTER TYPE changes its target.
            rows = autogen_context.connection.execute(sa.text("""
                SELECT source_ns.nspname, source.relname, target.relname,
                       ARRAY(SELECT a.attname FROM unnest(fk.conkey) AS k(num)
                             JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = k.num),
                       ARRAY(SELECT a.attname FROM unnest(fk.confkey) AS k(num)
                             JOIN pg_attribute a ON a.attrelid = fk.confrelid AND a.attnum = k.num)
                FROM pg_constraint fk
                JOIN pg_class source ON source.oid = fk.conrelid
                JOIN pg_namespace source_ns ON source_ns.oid = source.relnamespace
                JOIN pg_class target ON target.oid = fk.confrelid
                JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
                WHERE fk.contype = 'f' AND target_ns.nspname = :schema
                  AND source_ns.nspname <> :schema
            """), {"schema": dev_schema})
            for source_schema, source, target, columns, target_columns in rows:
                if self.matches(source, source_schema):
                    add_dependency(source_schema, source, columns, dev_schema, target, target_columns)

        for op in dangerous:
            schema = self.schema_for(op.table_name, op.schema, reflected=True)
            column = getattr(op, "column_name", None)
            blocked = (schema, op.table_name, column) in endpoints
            if isinstance(op, (ops.DropIndexOp, ops.DropConstraintOp)):
                # Only keys supporting an external FK are protected. Ordinary
                # managed indexes and checks can still change.
                if isinstance(op, ops.DropIndexOp):
                    keys = [i for i in inspector.get_indexes(op.table_name, schema=schema)
                            if i["name"] == op.index_name and i.get("unique")]
                else:
                    keys = inspector.get_unique_constraints(op.table_name, schema=schema)
                    keys.append(inspector.get_pk_constraint(op.table_name, schema=schema))
                    keys = [k for k in keys if k["name"] == op.constraint_name]
                blocked = any((schema, op.table_name, c) in referenced
                              for key in keys for c in (key.get("column_names") or key.get("constrained_columns") or []))
            elif isinstance(op, RemoveRowsOp):
                blocked = (schema, op.table_name, None) in referenced
            elif isinstance(op, ModifyRowsOp):
                changed = {c for row, old in zip(op.rows, op.old_rows)
                           for c in set(row) | set(old) if row.get(c) != old.get(c)}
                blocked = any((schema, op.table_name, c) in referenced for c in changed)
            if blocked:
                raise ValueError(
                    f"cannot change {schema}.{op.table_name}"
                    f"{'.' + column if column else ''}: foreign key crosses an "
                    "ignoreTables ownership boundary; coordinate an external migration first"
                )
