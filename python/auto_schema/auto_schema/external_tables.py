"""Ownership rules shared by reflection, autogenerate and empty-DB compares."""

import re
from collections import defaultdict
from dataclasses import dataclass

import sqlalchemy as sa
from alembic.operations import ops
from .ops import RemoveRowsOp, ModifyRowsOp


_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_$]*(?:\.(?:\*|[A-Za-z_][A-Za-z0-9_$]*))?")
_PG_ACTIONS = {'a': 'NO ACTION', 'r': 'RESTRICT', 'c': 'CASCADE',
               'n': 'SET NULL', 'd': 'SET DEFAULT'}


@dataclass
class _ForeignKey:
    source: tuple[str, str]
    target: tuple[str, str]
    columns: tuple[str, ...]
    target_columns: tuple[str, ...]
    ondelete: str
    onupdate: str
    supporting_index: str | None = None
    supporting_constraint: str | None = None


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

    def _foreign_keys(self, autogen_context, dev_schema):
        schemas = {self.default_schema}
        if not dev_schema:
            schemas.update(p.split('.')[0] for p in self.patterns if '.' in p)

        if autogen_context.connection.dialect.name == 'postgresql':
            # Read dependency metadata touching our scope, including inbound
            # FKs, without reflecting or comparing tables in other schemas.
            # conindid identifies the actual supporting key, even when multiple
            # unique indexes cover the same referenced columns.
            rows = autogen_context.connection.execute(sa.text("""
                SELECT source_ns.nspname, source.relname,
                       target_ns.nspname, target.relname,
                       ARRAY(SELECT a.attname FROM unnest(fk.conkey) WITH ORDINALITY AS k(num, ord)
                             JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = k.num
                             ORDER BY k.ord),
                       ARRAY(SELECT a.attname FROM unnest(fk.confkey) WITH ORDINALITY AS k(num, ord)
                             JOIN pg_attribute a ON a.attrelid = fk.confrelid AND a.attnum = k.num
                             ORDER BY k.ord),
                       fk.confdeltype, fk.confupdtype, key_index.relname, key_constraint.conname
                FROM pg_constraint fk
                JOIN pg_class source ON source.oid = fk.conrelid
                JOIN pg_namespace source_ns ON source_ns.oid = source.relnamespace
                JOIN pg_class target ON target.oid = fk.confrelid
                JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
                JOIN pg_class key_index ON key_index.oid = fk.conindid
                LEFT JOIN pg_constraint key_constraint
                  ON key_constraint.conrelid = fk.confrelid AND key_constraint.conindid = fk.conindid
                 AND key_constraint.contype IN ('p', 'u')
                WHERE fk.contype = 'f'
                  AND (source_ns.nspname = ANY(:schemas) OR target_ns.nspname = ANY(:schemas))
            """), {'schemas': sorted(schemas)})
            for source_schema, source, target_schema, target, columns, target_columns, delete, update, index, constraint in rows:
                yield _ForeignKey((source_schema, source), (target_schema, target),
                                  tuple(columns), tuple(target_columns),
                                  _PG_ACTIONS[delete], _PG_ACTIONS[update], index, constraint)
            return

        inspector = autogen_context.inspector
        for schema in sorted(schemas & set(inspector.get_schema_names())):
            for table in inspector.get_table_names(schema=schema):
                for fk in inspector.get_foreign_keys(table, schema=schema):
                    target = fk['referred_table']
                    target_schema = self.schema_for(target, fk['referred_schema'], reflected=True)
                    options = fk.get('options', {})
                    yield _ForeignKey((schema, table), (target_schema, target),
                                      tuple(fk['constrained_columns']), tuple(fk['referred_columns']),
                                      options.get('ondelete', 'NO ACTION').upper(),
                                      options.get('onupdate', 'NO ACTION').upper())

    def _seed_change_crosses_boundary(self, incoming, table, columns=None):
        # None represents deletion; a column set represents an update. Tracking
        # both lets DELETE SET NULL/DEFAULT continue through ON UPDATE cascades.
        pending = [(table, columns)]
        seen = set()
        while pending:
            table, columns = pending.pop()
            if (table, columns) in seen:
                continue
            seen.add((table, columns))
            for fk in incoming.get(table, []):
                if columns is not None and not columns.intersection(fk.target_columns):
                    continue
                if self.matches(fk.source[1], fk.source[0]):
                    return True
                action = fk.ondelete if columns is None else fk.onupdate
                if action == 'CASCADE':
                    changed = None if columns is None else frozenset(
                        source for source, target in zip(fk.columns, fk.target_columns) if target in columns)
                    pending.append((fk.source, changed))
                elif action in ('SET NULL', 'SET DEFAULT'):
                    pending.append((fk.source, frozenset(fk.columns)))
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
        endpoints = set()
        referenced_keys = defaultdict(list)
        incoming = defaultdict(list)
        for fk in self._foreign_keys(autogen_context, dev_schema):
            # Managed-to-managed FKs are needed to find indirect cascades.
            incoming[fk.target].append(fk)
            if self.matches(fk.source[1], fk.source[0]) or self.matches(fk.target[1], fk.target[0]):
                endpoints.add((*fk.source, None))
                endpoints.add((*fk.target, None))
                endpoints.update((*fk.source, c) for c in fk.columns)
                endpoints.update((*fk.target, c) for c in fk.target_columns)
                referenced_keys[fk.target].append(fk)

        for op in dangerous:
            schema = self.schema_for(op.table_name, op.schema, reflected=True)
            column = getattr(op, "column_name", None)
            blocked = (schema, op.table_name, column) in endpoints
            if isinstance(op, (ops.DropIndexOp, ops.DropConstraintOp)):
                # Only keys supporting an external FK are protected. Ordinary
                # managed indexes and checks can still change.
                dependencies = referenced_keys.get((schema, op.table_name), [])
                if autogen_context.connection.dialect.name == 'postgresql':
                    blocked = any(
                        fk.supporting_index == op.index_name if isinstance(op, ops.DropIndexOp)
                        else fk.supporting_constraint == op.constraint_name
                        for fk in dependencies
                    )
                elif isinstance(op, ops.DropIndexOp):
                    keys = [i for i in inspector.get_indexes(op.table_name, schema=schema)
                            if i["name"] == op.index_name and i.get("unique")]
                else:
                    keys = inspector.get_unique_constraints(op.table_name, schema=schema)
                    keys.append(inspector.get_pk_constraint(op.table_name, schema=schema))
                    keys = [k for k in keys if k["name"] == op.constraint_name]
                if autogen_context.connection.dialect.name != 'postgresql':
                    # SQLite resolves an FK against a complete unique key, not
                    # any key containing one of its columns.
                    blocked = any(set(fk.target_columns) == set(
                        key.get('column_names') or key.get('constrained_columns') or []
                    ) for fk in dependencies for key in keys)
            elif isinstance(op, RemoveRowsOp):
                blocked = self._seed_change_crosses_boundary(incoming, (schema, op.table_name))
            elif isinstance(op, ModifyRowsOp):
                changed = {c for row, old in zip(op.rows, op.old_rows)
                           for c in set(row) | set(old) if row.get(c) != old.get(c)}
                blocked = self._seed_change_crosses_boundary(incoming, (schema, op.table_name), frozenset(changed))
            if blocked:
                raise ValueError(
                    f"cannot change {schema}.{op.table_name}"
                    f"{'.' + column if column else ''}: foreign key crosses an "
                    "ignoreTables ownership boundary; coordinate an external migration first"
                )
