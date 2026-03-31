import functools
import pprint
import re
from typing import Any

import alembic.operations.ops as alembicops
import sqlalchemy as sa
from alembic.autogenerate import comparators
from alembic.autogenerate.api import AutogenContext
from alembic.operations import MigrateOperation, Operations
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import reflection
from sqlalchemy.sql.elements import TextClause

from auto_schema.clause_text import normalize_clause_text
from auto_schema.schema_item import FullTextIndex

from . import ops


def _normalize_db_extension(extension: dict[str, Any]) -> dict[str, Any]:
    provisioned_by = extension.get("provisioned_by")
    if provisioned_by not in ("ent", "external", None):
        raise ValueError(
            f"invalid provisioned_by {provisioned_by} for db extension {extension['name']}"
        )
    return {
        "name": extension["name"],
        "provisioned_by": provisioned_by or "ent",
        "version": extension.get("version"),
        "install_schema": extension.get("install_schema"),
        "runtime_schemas": list(extension.get("runtime_schemas") or []),
        "drop_cascade": extension.get("drop_cascade", False),
    }


def _is_ent_provisioned(extension: dict[str, Any]) -> bool:
    return extension["provisioned_by"] == "ent"


def _get_metadata_extensions(autogen_context: AutogenContext) -> list[dict[str, Any]]:
    metadata_extensions = autogen_context.metadata.info.get("db_extensions", {})
    extensions = metadata_extensions.get("public", [])
    if not isinstance(extensions, list):
        raise ValueError("db_extensions['public'] needs to be a list")
    return [_normalize_db_extension(extension) for extension in extensions]


def _get_db_extensions(autogen_context: AutogenContext) -> dict[str, dict[str, Any]]:
    rows = autogen_context.connection.execute(
        sa.text(
            """
            SELECT
                ext.extname AS name,
                ext.extversion AS version,
                ns.nspname AS install_schema
            FROM pg_catalog.pg_extension AS ext
            JOIN pg_catalog.pg_namespace AS ns
                ON ns.oid = ext.extnamespace
            """
        )
    )
    return {
        row._asdict()["name"].lower(): row._asdict()
        for row in rows
    }


def _get_extension_ops(
    metadata_extensions: list[dict[str, Any]],
    db_extensions: dict[str, dict[str, Any]],
) -> list[ops.MigrateOpInterface]:
    extension_ops = []
    for extension in metadata_extensions:
        name = extension["name"]
        ent_provisioned = _is_ent_provisioned(extension)
        db_extension = db_extensions.get(name.lower())
        version = extension.get("version")
        install_schema = extension.get("install_schema")
        if db_extension is None:
            if not ent_provisioned:
                raise ValueError(
                    f'required externally provisioned db extension "{name}" is not installed'
                )
            extension_ops.append(
                ops.CreateExtensionOp(extension)
            )
            continue

        if version is not None and db_extension.get("version") != version:
            if not ent_provisioned:
                raise ValueError(
                    f'externally provisioned db extension "{name}" is installed at version '
                    f'"{db_extension.get("version")}" but schema requires "{version}"'
                )
            extension_ops.append(
                ops.UpdateExtensionOp(
                    name,
                    db_extension.get("version"),
                    version,
                )
            )

        if install_schema is not None and db_extension.get("install_schema") != install_schema:
            if not ent_provisioned:
                raise ValueError(
                    f'externally provisioned db extension "{name}" is installed in schema '
                    f'"{db_extension.get("install_schema")}" but schema requires '
                    f'"{install_schema}"'
                )
            extension_ops.append(
                ops.SetExtensionSchemaOp(
                    name,
                    db_extension.get("install_schema"),
                    install_schema,
                )
            )

    return extension_ops


@comparators.dispatch_for("schema")
def compare_extensions(autogen_context, upgrade_ops, schemas):
    metadata_extensions = _get_metadata_extensions(autogen_context)
    if len(metadata_extensions) == 0:
        return

    dialect = _dialect_name(autogen_context)
    if dialect != "postgresql":
        raise ValueError("db extensions are only supported for postgres")

    db_extensions = _get_db_extensions(autogen_context)
    extension_ops = _get_extension_ops(metadata_extensions, db_extensions)
    if len(extension_ops) == 0:
        return

    # create/update extension ops need to happen before any dependent
    # tables, columns, or indexes are created.
    upgrade_ops.ops[0:0] = extension_ops


@comparators.dispatch_for("schema")
def compare_edges(autogen_context, upgrade_ops, schemas):
    db_edges = {}

    for sch in schemas:

        # so first check if the table exists. if it doesn't, nothing to do here
        # TODO not using schema here either
        # https://github.com/lolopinto/ent/issues/123
        if not _table_exists(autogen_context):
            continue

        existing_edges = {}

        # get existing edges from db
        query = "SELECT * FROM assoc_edge_config"
        for row in autogen_context.connection.execute(sa.text(query)):
            edge = row._asdict()
            existing_edges[edge['edge_name']] = edge

        db_edges[_get_schema_key(sch)] = existing_edges

    metadata_edges = autogen_context.metadata.info.setdefault("edges", {})

    # edges in metadata, but not in db, new edges that need to be added
    _process_edges(
        metadata_edges,
        db_edges,
        upgrade_ops,
        ops.AddEdgesOp,
        _meta_to_db_edge_mismatch,
    )

    # edges in db, but not in metadata, edges that need to be dropped
    _process_edges(
        db_edges,
        metadata_edges,
        upgrade_ops,
        ops.RemoveEdgesOp,
    )


def _edges_equal(edge1, edge2):
    fields = [
        'edge_name',
        'edge_type',
        'edge_table',
        'inverse_edge_type'
    ]
    if not all(str(edge1.get(f, None)) == str(edge2.get(f, None)) for f in fields):
        return False

    # sqlite stores 1 as bool. comparing as strings no bueno
    return bool(edge1.get('symmetric_edge', None)) == bool(edge2.get('symmetric_edge', None))


def _process_edges(source_edges, compare_edges, upgrade_ops, upgrade_op, edge_mismatch_fn=None):
    alter_ops = []

    for sch, edges in source_edges.items():

        new_edges = []

        edges_for_sch = compare_edges.get(sch)
        if edges_for_sch is None:
            edges_for_sch = {}

        for k, edge in edges.items():
            compare_edge = edges_for_sch.get(edge['edge_name'])

            if compare_edge is None:
                new_edges.append(edge)
            else:
                # edge exists, let's confirm everything is the same
                # if there's a mismatch, modify the edge to fix it
                # we should have validators in the schema input that makes
                # sure we can't change these by accident
                if edge_mismatch_fn is not None and not _edges_equal(compare_edge, edge):
                    alter_op = edge_mismatch_fn(edge, compare_edge, sch)
                    alter_ops.append(alter_op)
                    pass

        if len(new_edges) > 0:
            upgrade_ops.ops.append(
                upgrade_op(new_edges, schema=sch)
            )

        # do any alter operation after the add/remove edge op
        [upgrade_ops.ops.append(alter_op) for alter_op in alter_ops]


def _dialect_name(autogen_context: AutogenContext) -> str:
    return autogen_context.connection.dialect.name


# why isn't this just metadata.sorted_tables?
def _table_exists(autogen_context: AutogenContext):
    dialect_map = {
        'sqlite': _execute_sqlite_dialect,
        'postgresql': _execute_postgres_dialect,
    }

    dialect = _dialect_name(autogen_context)

    if dialect_map[dialect] is None:
        raise Exception("unsupported dialect")

    return dialect_map[dialect](autogen_context.connection)


def _execute_postgres_dialect(connection: sa.engine.Connection):
    row = connection.execute(sa.text(
            "SELECT to_regclass('assoc_edge_config') IS NOT NULL as exists" 
        )
    )
    res = row.first()._asdict()
    return res["exists"]


def _execute_sqlite_dialect(connection: sa.engine.Connection):
    row = connection.execute(sa.text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='assoc_edge_config'",
        )
    )
    res = row.first()
    return res is not None


def _get_schema_key(schema):
    if schema is None:
        return 'public'
    return schema


def _meta_to_db_edge_mismatch(meta_edge, db_edge, sch):
    return ops.ModifyEdgeOp(
        meta_edge['edge_type'],
        meta_edge,
        db_edge,
        schema=sch
    )


def _create_tuple_key(row, pkeys):
    l = []
    for key in pkeys:
        if not key in row:
            raise ValueError(f"pkey {key} was not found in row")
        l.append(row[key])
    return tuple(l)


@ comparators.dispatch_for('schema')
def compare_data(autogen_context, upgrade_ops, schemas):
    # TODO not using schema correctly
    # https: // github.com/lolopinto/ent/issues/123

    data = autogen_context.metadata.info.setdefault("data", {})

    inspector = autogen_context.inspector
    db_metadata = sa.MetaData()
    db_metadata.reflect(inspector.bind)

    for sch in schemas:
        sch = _get_schema_key(sch)

        if not sch in data:
            continue

        schema_data = data.get(sch, {})
        for table_name in schema_data:
            table_data = schema_data[table_name]

            pkeys = table_data.get('pkeys', None)
            if pkeys is None or not isinstance(pkeys, list):
                raise ValueError("pkeys needs to be a list")

            rows = table_data.get('rows', None)
            if rows is None or not isinstance(rows, list):
                # we want list of dict...
                raise ValueError("rows needs to be a list")

            # verify that each row is valid + create tuple key
            data_rows = {_create_tuple_key(row, pkeys): row for row in rows}

            # new table. need to add
            if not table_name in db_metadata.tables:
                upgrade_ops.ops.append(ops.AddRowsOp(
                    table_name, pkeys, rows))
            else:
                _compare_db_values(autogen_context, upgrade_ops,
                                   table_name, pkeys, data_rows)


def _compare_db_values(autogen_context, upgrade_ops, table_name, pkeys, data_rows):
    connection = autogen_context.connection
    query = f"SELECT * FROM {table_name}"

    db_rows = {}
    for row in connection.execute(sa.text(query)):
        d = row._asdict()
        t = _create_tuple_key(d, pkeys)
        db_rows[t] = d

    deleted_rows = []
    new_rows = []
    modified_new_rows = []
    modified_old_rows = []
    for t in db_rows:
        db_row = db_rows[t]
        if t in data_rows:
            data_row = data_rows[t]
            if db_row != data_row:
                # check to see if keys are the same
                # check db since it has all the keys
                for key in db_row:
                    if db_row[key] != data_row.get(key, None):
                        modified_new_rows.append(data_row)
                        modified_old_rows.append(db_row)
                        break
        else:
            deleted_rows.append(db_row)

    for t in data_rows:
        if t not in db_rows:
            new_rows.append(data_rows[t])

    if len(new_rows) > 0:
        upgrade_ops.ops.append(ops.AddRowsOp(
            table_name, pkeys, new_rows))

    if len(deleted_rows) > 0:
        upgrade_ops.ops.append(ops.RemoveRowsOp(
            table_name, pkeys, deleted_rows))

    if len(modified_new_rows) > 0:
        if len(modified_new_rows) != len(modified_old_rows):
            raise ValueError(
                "length of modified old and new rows should be the same")

        upgrade_ops.ops.append(ops.ModifyRowsOp(
            table_name, pkeys, modified_new_rows, modified_old_rows))


@ comparators.dispatch_for("schema")
def compare_schema(autogen_context, upgrade_ops, schemas):
    inspector = autogen_context.inspector

    db_metadata = sa.MetaData()
    db_metadata.reflect(inspector.bind)

    # TODO schema not being used
    # https://github.com/lolopinto/ent/issues/123
    for sch in schemas:
        conn_tables = {
            table.name: table for table in db_metadata.sorted_tables}
        metadata_tables = {
            table.name: table for table in autogen_context.metadata.sorted_tables}

        # trying to detect change in tables
        for name in conn_tables:
            if name in metadata_tables:
                _check_existing_table(
                    conn_tables[name], metadata_tables[name], upgrade_ops, sch)
            else:
                _check_removed_table(conn_tables[name], upgrade_ops, sch)

        for name in metadata_tables:
            if not name in conn_tables:
                _check_new_table(metadata_tables[name], upgrade_ops, sch)


def _check_removed_table(metadata_table, upgrade_ops, sch):
    for column in metadata_table.columns:
        _check_removed_column(column, upgrade_ops, sch)


# this should be in a table comparison...
def _check_existing_table(conn_table, metadata_table, upgrade_ops, sch):
    conn_columns = {col.name: col for col in conn_table.columns}
    metadata_columns = {
        col.name: col for col in metadata_table.columns}

    for name in conn_columns:
        if not name in metadata_columns:
            # dropped column (potentially dropped type)
            _check_removed_column(conn_columns[name], upgrade_ops, sch)
        else:
            _check_if_enum_values_changed(
                upgrade_ops, conn_columns[name], metadata_columns[name], sch)

    for name in metadata_columns:
        if not name in conn_columns:
            _check_new_column(metadata_columns[name], upgrade_ops, sch)

    conn_constraints = {
        constraint.name: constraint for constraint in conn_table.constraints}
    meta_constraints = {
        constraint.name: constraint for constraint in metadata_table.constraints}

    new_ops = []

    for name in conn_constraints:
        # no name, ignore
        # we don't do anything with None constraints and if we get here
        # it's something autogenerated or something else
        if name is None:
            continue

        constraint = conn_constraints[name]
        if not name in meta_constraints and isinstance(constraint, sa.CheckConstraint):
            if not constraint._type_bound:
                new_ops.append(
                    ops.OurDropConstraintOp.from_constraint(constraint))

    for name in meta_constraints:
        constraint = meta_constraints[name]
        if not name in conn_constraints and isinstance(constraint, sa.CheckConstraint):
            if not constraint._type_bound:
                new_ops.append(
                    ops.OurCreateCheckConstraintOp.from_constraint(constraint))

    if len(new_ops) <= 0:
        return

    existing_op = False
    for index, op in enumerate(upgrade_ops.ops):
        if not isinstance(op, alembicops.ModifyTableOps):
            continue
        if op.table_name != metadata_table.name:
            continue

        existing_op = True
        l = list(op.ops)
        # append the new ops to existing modify table ops for that table
        [l.append(new_op) for new_op in new_ops]
        # swap out the modify table ops object with new one with new ops
        upgrade_ops.ops[index] = alembicops.ModifyTableOps(
            metadata_table.name, l, schema=sch
        )
        break

    if not existing_op:
        upgrade_ops.ops.append(
            alembicops.ModifyTableOps(
                metadata_table.name, new_ops, schema=sch)
        )


def _check_new_column(metadata_column, upgrade_ops, sch):
    metadata_type = metadata_column.type
    if not isinstance(metadata_type, postgresql.ENUM):
        return

    # new column with enum type
    # time to create the type
    # adding a new type. just add to front of list
    upgrade_ops.ops.insert(
        0,
        ops.AddEnumOp(metadata_type.name, metadata_type.enums, schema=sch)
    )


def _check_removed_column(conn_column, upgrade_ops, sch):
    conn_type = conn_column.type
    if not isinstance(conn_type, postgresql.ENUM):
        return

    # column being removed. remove type also
    # we assume 1-1 for now
    upgrade_ops.ops.append(
        ops.DropEnumOp(conn_type.name, conn_type.enums, schema=sch)
    )


def _check_new_table(metadata_table, upgrade_ops, sch):
    for column in metadata_table.columns:
        _check_new_column(column, upgrade_ops, sch)


def _check_if_enum_values_changed(upgrade_ops, conn_column, metadata_column, sch):
    conn_type = conn_column.type
    metadata_type = metadata_column.type

    # not enums, bye
    if not isinstance(conn_type, postgresql.ENUM) or not isinstance(metadata_type, postgresql.ENUM):
        return

    # enums are the same, bye
    if conn_type.enums == metadata_type.enums:
        return

    conn_enums = {k: k for k in conn_type.enums}
    metadata_enums = {k: k for k in metadata_type.enums}
    for key in conn_enums:
        if key not in metadata_enums:
            raise ValueError("postgres doesn't support enum removals")

    l = len(metadata_type.enums)
    for index, value in enumerate(metadata_type.enums):
        if value not in conn_enums:
            # if not last item use BEFORE
            # options are:
            # ALTER TYPE enum_type ADD VALUE 'new_value';
            # ALTER TYPE enum_type ADD VALUE 'new_value' BEFORE 'old_value';
            # we don't need after since the previous 2 suffice so don't officially support that
            # ALTER TYPE enum_type ADD VALUE 'new_value' AFTER 'old_value';
            # only add before if previously existed
            if index != l - 1 and metadata_type.enums[index+1] in conn_enums:
                upgrade_ops.ops.append(
                    ops.AlterEnumOp(conn_type.name, value, schema=sch,
                                    before=metadata_type.enums[index + 1])
                )
            else:
                upgrade_ops.ops.append(
                    ops.AlterEnumOp(conn_type.name, value, schema=sch)
                )


@ comparators.dispatch_for("table")
def _compare_indexes(autogen_context: AutogenContext,
                     modify_table_ops: alembicops.ModifyTableOps,
                     schema,
                     tname: str,
                     conn_table: sa.Table | None,
                     metadata_table: sa.Table,
                     ):

    raw_db_indexes = _get_raw_db_indexes(
        autogen_context, conn_table)
    all_conn_indexes = raw_db_indexes.get('all')
    conn_indexes = {}
    meta_indexes = {}

    def is_full_text_index(index):
        if isinstance(index, FullTextIndex):
            return True

        expressions = index.expressions
        return len(expressions) == 1 and isinstance(expressions[0], TextClause)

    if conn_table is not None:
        conn_indexes = {
            index.name: index for index in conn_table.indexes}

    if metadata_table is not None:
        meta_indexes = {
            index.name: index for index in metadata_table.indexes}

    # sqlalchemy correctly reflects these expressions now but
    # alembic doesn't necessarily autogenerate these correctly so we go through
    # and make the right changes to these FullText indexes
    # https://github.com/sqlalchemy/alembic/issues/1098

    to_remove_list = []
    for i in range(len(modify_table_ops.ops)):
        op = modify_table_ops.ops[i]
        if isinstance(op, alembicops.CreateIndexOp) and op.index_name in meta_indexes:
            index = meta_indexes[op.index_name]

            if is_full_text_index(index):
                # automerge trying to add it again, remove it from here...
                to_remove = op.index_name in conn_indexes

                if to_remove:
                    to_remove_list.append(op)
                else:
                    modify_table_ops.ops[i] = ops.CreateFullTextIndexOp(
                        index.name,
                        index.table.name,
                        schema=schema,
                        table=index.table,
                        unique=index.unique,
                        info=index.info,
                    )
            continue

        if isinstance(op, alembicops.DropIndexOp) and op.index_name in conn_indexes:
            conn_index = conn_indexes.get(op.index_name, None)
            if is_full_text_index(conn_index):
                # automerge trying to drop it again, remove it from here...
                to_remove = op.index_name in meta_indexes
                if to_remove:
                    to_remove_list.append(op)
                else:
                    conn_postgresql_using = normalize_clause_text(
                        conn_index.expressions[0], None)

                    modify_table_ops.ops[i] = ops.DropFullTextIndexOp(
                        conn_index.name,
                        conn_index.table.name,
                        info={
                            # TODO get the right value of this from somewhere since it won't be in expressions
                            'postgresql_using': 'gin',
                            'postgresql_using_internals': conn_postgresql_using,

                        },
                        # info=index.info,
                        table=conn_table,
                    )
            continue

    for op in to_remove_list:
        modify_table_ops.ops.remove(op)

    for name, index in meta_indexes.items():

        # if index is there and postgresql_using changes, drop the index and add it again
        # should hopefully be a one-time migration change...
        if name in conn_indexes and isinstance(index, sa.Index):
            meta_signature = _get_index_signature(index, all_conn_indexes.get(name, {}))
            conn_signature = _get_index_signature(conn_indexes[name], all_conn_indexes.get(name, {}))

            if _index_signatures_differ(meta_signature, conn_signature):
                conn_index = conn_indexes[name]
                if conn_signature.get('postgresql_using') is not None:
                    conn_index.kwargs['postgresql_using'] = conn_signature.get('postgresql_using')
                if conn_signature.get('postgresql_ops'):
                    conn_index.kwargs['postgresql_ops'] = conn_signature.get('postgresql_ops')
                if conn_signature.get('postgresql_with'):
                    conn_index.kwargs['postgresql_with'] = conn_signature.get('postgresql_with')

                modify_table_ops.ops.append(
                    alembicops.DropIndexOp.from_index(conn_index))

                modify_table_ops.ops.append(
                    alembicops.CreateIndexOp(
                        name,
                        index.table.name,
                        index.columns,
                        **_get_create_index_kwargs(index, meta_signature),
                    ))


index_regex = re.compile(r'CREATE (?:UNIQUE )?INDEX .* USING ([a-zA-Z0-9_]+) (.+)')

# this handles computed columns changing and so drops and re-creates the column.


@ comparators.dispatch_for("table")
def _compare_generated_column(autogen_context: AutogenContext,
                              modify_table_ops: alembicops.ModifyTableOps,
                              schema,
                              tname: str,
                              conn_table: sa.Table | None,
                              metadata_table: sa.Table | None,
                              ) -> None:

    if conn_table is None or metadata_table is None:
        return

    col_to_index = {}

    for idx in metadata_table.indexes:
        if len(idx.columns) == 1:
            col_to_index[idx.columns[0].name] = idx

    for conn_col in conn_table.columns:
        if not conn_col.computed:
            continue

        index = col_to_index.get(conn_col.name, None)
        if index is None:
            continue

        index_type = index.kwargs.get('postgresql_using')

        for meta_col in metadata_table.columns:
            if meta_col.name == conn_col.name and meta_col.computed is not None:

                conn_info = _parse_postgres_using_internals(
                    str(conn_col.computed.sqltext), index_type)
                meta_info = _parse_postgres_using_internals(
                    str(meta_col.computed.sqltext), index_type)

                # this is using underlying columns so we use drop and create directly
                if conn_info['columns'] != meta_info['columns']:
                    modify_table_ops.ops = [
                        op for op in modify_table_ops.ops
                        if not (
                            isinstance(op, (alembicops.CreateIndexOp, alembicops.DropIndexOp))
                            and op.index_name == index.name
                        )
                    ]

                    # we'll have to change the entire beh
                    create_index = alembicops.CreateIndexOp(
                        index.name,
                        index.table.name,
                        index.columns,
                        **_get_create_index_kwargs(index),
                    )

                    modify_table_ops.ops.append(
                        alembicops.DropIndexOp(
                            index.name,
                            conn_table.name,
                            schema=schema,
                            info={
                                'postgresql_using': index_type,
                            },
                            _reverse=create_index,
                            # also pass this here so that downgrade does the right thing
                            # TODO need to make sure we test upgrade/downgrade paths are the same.
                            postgresql_using=index_type,
                        )
                    )
                    modify_table_ops.ops.append(
                        alembicops.DropColumnOp.from_column_and_tablename(
                            schema, tname, conn_col
                        )
                    )
                    modify_table_ops.ops.append(
                        alembicops.AddColumnOp.from_column_and_tablename(
                            schema, tname, meta_col
                        )
                    )

                    modify_table_ops.ops.append(
                        create_index
                    )


# sqlalchemy doesn't reflect postgres indexes that have expressions in them so have to manually
# fetch these indices from pg_indices to find them
# warning: "Skipped unsupported reflection of expression-based index accounts_full_text_idx"
def _get_raw_db_indexes(autogen_context: AutogenContext, conn_table: sa.Table | None):
    if conn_table is None or _dialect_name(autogen_context) != 'postgresql':
        return {'missing': {}, 'all': {}}

    missing = {}
    all_indices = {}
    # we cache the db hit but the table seems to change across the same call and so we're
    # just paying the CPU price. can probably be fixed in some way...
    names = set([index.name for index in conn_table.indexes] +
                [constraint.name for constraint in conn_table.constraints])
    res = get_db_indexes_for_table(
        autogen_context.connection,
        conn_table.name,
        conn_table.schema,
    )

    for row in res.fetchall():
        (
            name,
            details
        ) = row
        m = index_regex.match(details)
        if m is None:
            continue
        r = m.groups()

        info = _parse_raw_index_details(r[0], r[1])
        payload = _raw_index_details_payload(info)

        all_indices[name] = payload

        # missing!
        if name not in names:
            missing[name] = payload

    return {'missing': missing, 'all': all_indices}


# use a cache so we only hit the db once for each table
# @functools.lru_cache()
def get_db_indexes_for_table(connection: sa.engine.Connection, tname: str, schema_name: str | None = None):
    res = connection.execute(sa.text(
       """
       SELECT indexname, indexdef
       FROM pg_indexes
       WHERE tablename = :table_name
         AND schemaname = COALESCE(:schema_name, current_schema())
       """),
       {
           'table_name': tname,
           'schema_name': schema_name,
       })
    return res


# pg_get_indexdef gives us a constrained index fragment rather than full SQL.
# We only need the access method, operator classes, and WITH params, so keep the
# parser narrowly scoped to those pieces instead of pulling in a general parser.
simple_index_part_regex = re.compile(
    r'^\s*"?(?P<column>[a-zA-Z0-9_]+)"?(?:\s+(?P<operator_class>[a-zA-Z0-9_.]+))?(?:\s+(?:ASC|DESC))?(?:\s+NULLS\s+(?:FIRST|LAST))?\s*$'
)


def _split_top_level_csv(text: str) -> list[str]:
    parts = []
    current = []
    depth = 0
    in_quotes = False

    for char in text:
        if char == '"':
            in_quotes = not in_quotes
        if not in_quotes:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
            elif char == ',' and depth == 0:
                parts.append(''.join(current).strip())
                current = []
                continue
        current.append(char)

    if current:
        parts.append(''.join(current).strip())

    return [part for part in parts if part]


def _extract_parenthesized_segment(text: str) -> tuple[str | None, str]:
    if not text.startswith('('):
        return (None, text)

    depth = 0
    in_quotes = False
    for index, char in enumerate(text):
        if char == '"':
            in_quotes = not in_quotes
        if in_quotes:
            continue
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
            if depth == 0:
                return (text[1:index], text[index + 1:].strip())

    return (None, text)


def _parse_index_ops(columns_clause: str | None) -> dict[str, str]:
    if not columns_clause:
        return {}

    ret = {}
    for part in _split_top_level_csv(columns_clause):
        match = simple_index_part_regex.match(part)
        if match is None:
            continue
        operator_class = match.group('operator_class')
        if operator_class:
            ret[match.group('column')] = operator_class
    return ret


def _parse_index_with(remainder: str) -> dict[str, str]:
    match = re.search(r'\bWITH\s*\((.+?)\)', remainder)
    if match is None:
        return {}

    ret = {}
    for part in _split_top_level_csv(match.group(1)):
        key, _, value = part.partition('=')
        if not _:
            continue
        ret[key.strip()] = value.strip().strip("'")
    return ret


def _parse_raw_index_details(using: str, details: str) -> dict[str, Any]:
    columns_clause, remainder = _extract_parenthesized_segment(details.strip())
    return {
        'postgresql_using': using,
        'postgresql_using_internals': details,
        'postgresql_ops': _parse_index_ops(columns_clause),
        'postgresql_with': _parse_index_with(remainder),
    }


def _raw_index_details_payload(info: dict[str, Any]) -> dict[str, Any]:
    return {
        'postgresql_using': info.get('postgresql_using'),
        'postgresql_using_internals': info.get('postgresql_using_internals'),
        'postgresql_ops': info.get('postgresql_ops', {}),
        'postgresql_with': info.get('postgresql_with', {}),
        # TODO don't have columns|column to pass to FullTextIndex
    }


def _normalize_index_using(using):
    if using in (None, False, '', 'btree'):
        return None
    return using


def _normalize_index_map(value) -> dict[str, str]:
    if value in (None, False):
        return {}
    return {
        str(key): str(val)
        for key, val in dict(value).items()
    }


def _get_index_kwarg(index: sa.Index, key: str):
    value = index.kwargs.get(key)
    if value not in (None, False):
        return value

    postgres_options = index.dialect_options.get('postgresql')
    if postgres_options is not None:
        value = postgres_options.get(key.removeprefix('postgresql_'))
        if value not in (None, False, [], {}):
            return value
    return None


def _get_index_signature(index: sa.Index, raw_index: dict[str, Any]) -> dict[str, Any]:
    return {
        'postgresql_using': _normalize_index_using(
            _get_index_kwarg(index, 'postgresql_using') or raw_index.get('postgresql_using')
        ),
        'postgresql_ops': _normalize_index_map(
            _get_index_kwarg(index, 'postgresql_ops') or raw_index.get('postgresql_ops')
        ),
        'postgresql_with': _normalize_index_map(
            _get_index_kwarg(index, 'postgresql_with') or raw_index.get('postgresql_with')
        ),
    }


def _get_create_index_kwargs(
    index: sa.Index, signature: dict[str, Any] | None = None
) -> dict[str, Any]:
    kwargs = {}
    for key in (
        'postgresql_using',
        'postgresql_concurrently',
        'postgresql_where',
        'sqlite_where',
    ):
        value = index.kwargs.get(key)
        if value not in (None, False):
            kwargs[key] = value

    if signature is not None:
        if signature.get('postgresql_ops'):
            kwargs['postgresql_ops'] = signature['postgresql_ops']
        if signature.get('postgresql_with'):
            kwargs['postgresql_with'] = signature['postgresql_with']

    return kwargs


def _index_signatures_differ(meta_signature: dict[str, Any], conn_signature: dict[str, Any]) -> bool:
    return meta_signature != conn_signature


# these 2 ported and updated from https://github.com/lolopinto/ent/pull/1223/files
def _parse_cols_from(curr: str):
    cols = []
    for s in curr.strip().split('||'):
        if not s:
            continue
        s = s.strip().strip('(').strip(')')
        # TODO we should test against different db versions. this is too brittle
        if s.startswith('COALESCE') or s.startswith('coalesce'):
            s = s[8:]
        if s.endswith('::text'):
            s = s[:-6]

        for s2 in s.split(','):
            s2 = s2.strip().strip('(').strip(')')
            if s2 == ' ' or s2 == "''" or s2 == "' '":
                continue

            cols.append(s2)

    return cols


sqltext_regex = re.compile(r"to_tsvector\((.+?), (.+)\)")


# 3 is tricky
# to_tsvector('english'::regconfig, ((((first_name || ' '::text) || last_name) || ' '::text) || (email_address)::text))
def _parse_postgres_using_internals(internals: str, index_type: str):
    # single-col to_tsvector('english'::regconfig, first_name)
    # multi-col to_tsvector('english'::regconfig, ((first_name || ' '::text) || last_name))
    m = sqltext_regex.match(internals)
    if m:
        groups = m.groups()
        lang = groups[0].rstrip("::regconfig").strip("'")

        cols = _parse_cols_from(groups[1])

        if len(cols) > 0:
            return {
                'columns': cols,
                'fulltext': {
                    'language': lang,
                    'indexType': index_type,
                }
            }

    cols = [col.strip() for col in internals.split(',')]
    # multi-column index
    if len(cols) > 1:
        return {
            'columns': cols,
        }

    return {}


@ comparators.dispatch_for("table")
def _compare_server_default_nullable(
    autogen_context: AutogenContext,
    modify_table_ops: alembicops.ModifyTableOps,
    schema,
    tname: str,
    conn_table: sa.Table | None,
    metadata_table: sa.Table,
):
    if conn_table is None or metadata_table is None:
        return

    for i in range(len(modify_table_ops.ops)):
        op = modify_table_ops.ops[i]
        if not isinstance(op, alembicops.AlterColumnOp):
            continue


        # changing server default to non-null value
        if op.modify_nullable is False and op.modify_server_default is not False and op.modify_server_default is not None:
            raise ValueError(
                """
                Can't effectively do this in one step. Have to break this into 2 steps:
                1. set the server_default to new value, run codegen
                2. change nullable to False, run codegen
                """
            )

        
