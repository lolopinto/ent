"""Collect existing FK dependencies before ordering index replacements."""

import alembic.operations.ops as alembicops
import sqlalchemy as sa

from . import ops
from .migration_ordering import index_requires_autocommit


def collect_index_foreign_keys(context, upgrade_ops, schemas):
    index_drops = [
        (operation.schema or table_ops.schema, operation.index_name)
        for table_ops in upgrade_ops.ops if isinstance(table_ops, alembicops.ModifyTableOps)
        for operation in table_ops.ops
        if isinstance(operation, (alembicops.DropIndexOp, ops.DropFullTextIndexOp))
    ]
    if not index_drops:
        return

    # conindid identifies the particular unique index PostgreSQL chose for an
    # FK. Another UNIQUE on the same columns does not automatically rebind it.
    dependencies = context.connection.execute(sa.text("""
        SELECT DISTINCT fk.oid, fk.conname, source.relname AS source_table,
            source_ns.nspname AS source_schema, target.relname AS target_table,
            target_ns.nspname AS target_schema, idx.relname AS index_name,
            fk.confupdtype, fk.confdeltype, fk.confmatchtype,
            fk.condeferrable, fk.condeferred, fk.convalidated,
            fk.conparentid, fk.coninhcount,
            to_jsonb(fk)->'confdelsetcols' AS delete_columns,
            to_jsonb(fk)->'conperiod' AS period,
            to_jsonb(fk)->'conenforced' AS enforced,
            EXISTS (SELECT 1 FROM pg_catalog.pg_trigger trigger
                WHERE trigger.tgconstraint = fk.oid AND trigger.tgenabled <> 'O') AS custom_trigger_modes,
            pg_catalog.obj_description(fk.oid, 'pg_constraint') AS comment,
            current_schema() AS default_schema,
            ARRAY(SELECT att.attname FROM unnest(fk.conkey) WITH ORDINALITY AS col(num, position)
                JOIN pg_catalog.pg_attribute att ON att.attrelid = source.oid AND att.attnum = col.num
                ORDER BY col.position) AS source_columns,
            ARRAY(SELECT att.attname FROM unnest(fk.confkey) WITH ORDINALITY AS col(num, position)
                JOIN pg_catalog.pg_attribute att ON att.attrelid = target.oid AND att.attnum = col.num
                ORDER BY col.position) AS target_columns
        FROM unnest(CAST(:schemas AS text[]), CAST(:indexes AS text[])) AS dropped_index(schema_name, index_name)
        JOIN pg_catalog.pg_namespace index_ns ON index_ns.nspname = COALESCE(dropped_index.schema_name, current_schema())
        JOIN pg_catalog.pg_class idx ON idx.relnamespace = index_ns.oid AND idx.relname = dropped_index.index_name
        JOIN pg_catalog.pg_constraint fk ON fk.conindid = idx.oid AND fk.contype = 'f'
        JOIN pg_catalog.pg_class source ON source.oid = fk.conrelid
        JOIN pg_catalog.pg_namespace source_ns ON source_ns.oid = source.relnamespace
        JOIN pg_catalog.pg_class target ON target.oid = fk.confrelid
        JOIN pg_catalog.pg_namespace target_ns ON target_ns.oid = target.relnamespace
        ORDER BY fk.oid
    """), {"schemas": [schema for schema, _ in index_drops], "indexes": [name for _, name in index_drops]}).mappings().all()
    if not dependencies:
        return

    default_schema = dependencies[0]["default_schema"]
    compared_schemas = {schema or default_schema for schema in schemas}
    table_drops = {
        (operation.schema or default_schema, operation.table_name)
        for operation in upgrade_ops.ops if isinstance(operation, alembicops.DropTableOp)
    }
    constraint_drops = {
        (operation.schema or table_ops.schema or default_schema, table_ops.table_name, operation.constraint_name)
        for table_ops in upgrade_ops.ops if isinstance(table_ops, alembicops.ModifyTableOps)
        for operation in table_ops.ops if isinstance(operation, alembicops.DropConstraintOp)
    }
    metadata_tables = {
        (table.schema or default_schema, table.name): table
        for table in context.table_key_to_table.values()
    }
    reflected = sa.MetaData()
    concurrent_indexes = _contains_concurrent_index(upgrade_ops)
    for dependency in dependencies:
        schema, table_name, name = (dependency[key] for key in ("source_schema", "source_table", "conname"))
        table_key = (schema, table_name)
        if table_key in table_drops or (*table_key, name) in constraint_drops:
            # Existing removals (including inline FKs on a removed table) retain
            # their normal inverse. Changed FKs already have their own operation.
            continue
        metadata_table = metadata_tables.get(table_key)
        # Use Alembic's comparison spelling for filters (the default schema is
        # often None), while emitted SQL always uses the resolved catalog schema.
        filter_schema = None if schema == default_schema and None in schemas else schema
        parents = {"schema_name": filter_schema, "table_name": table_name}
        if (
            schema not in compared_schemas or metadata_table is None
            or not context.run_name_filters(filter_schema, "schema", {})
            or not context.run_name_filters(table_name, "table", {"schema_name": filter_schema})
            or not context.run_name_filters(name, "foreign_key_constraint", parents)
        ):
            _cannot_rebind(dependency, "the referencing table or constraint is outside the comparison scope")
        table = sa.Table(table_name, reflected, schema=filter_schema, autoload_with=context.connection, resolve_fks=False)
        constraint = next(item for item in table.foreign_key_constraints if item.name == name)
        metadata_constraint = next((item for item in metadata_table.foreign_key_constraints if item.name == name), None)
        if (
            not context.run_object_filters(table, table_name, "table", True, metadata_table)
            or not context.run_object_filters(constraint, name, "foreign_key_constraint", True, metadata_constraint)
        ):
            _cannot_rebind(dependency, "the referencing table or constraint is excluded from comparison")
        if (
            dependency["conparentid"] or dependency["coninhcount"] or dependency["comment"] is not None
            or dependency["delete_columns"] is not None or dependency["period"] or dependency["enforced"] is False
        ):
            # Standard Alembic FK operations cannot round-trip these attributes.
            # Reject during generation rather than silently changing ownership or
            # losing a comment while replacing an otherwise unchanged constraint.
            _cannot_rebind(dependency, "the foreign key has attributes requiring an explicit migration")

        if dependency["custom_trigger_modes"]:
            # Dropping the constraint also drops its parent action and child
            # validation triggers. Recreating it would reset their firing modes.
            _cannot_rebind(dependency, "customized foreign-key trigger modes require an explicit migration")

        if concurrent_indexes:
            # Global ordering places all index DDL between FK removal and
            # recreation. CONCURRENTLY would commit the removal, exposing a
            # window without enforcement or cascading actions to other writers.
            # The inverse index operations retain the same autocommit flags.
            # Enum-label commits run before FK removal and do not create this gap.
            _cannot_rebind(dependency, "automatic rebinding would cross an autocommit boundary; use an explicit migration strategy")

        create = _foreign_key_operation(dependency)
        upgrade_ops.ops.append(alembicops.ModifyTableOps(table_name, [create.reverse(), create], schema=schema))


def _contains_concurrent_index(operation):
    if isinstance(operation, alembicops.OpContainer):
        return any(_contains_concurrent_index(child) for child in operation.ops)
    return index_requires_autocommit(operation)


def _cannot_rebind(dependency, reason):
    raise ValueError(
        f"cannot replace index {dependency['target_schema']}.{dependency['index_name']}: "
        f"foreign key {dependency['source_schema']}.{dependency['source_table']}.{dependency['conname']} "
        f"depends on it and {reason}"
    )


def _foreign_key_operation(dependency):
    actions = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}
    return alembicops.CreateForeignKeyOp(
        dependency["conname"], dependency["source_table"], dependency["target_table"],
        list(dependency["source_columns"]), list(dependency["target_columns"]),
        source_schema=dependency["source_schema"], referent_schema=dependency["target_schema"],
        onupdate=actions[dependency["confupdtype"]], ondelete=actions[dependency["confdeltype"]],
        match={"f": "FULL", "p": "PARTIAL", "s": "SIMPLE"}[dependency["confmatchtype"]],
        deferrable=dependency["condeferrable"],
        initially="DEFERRED" if dependency["condeferred"] else "IMMEDIATE",
        postgresql_not_valid=not dependency["convalidated"],
    )
