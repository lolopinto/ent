import os
from typing import List
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from auto_schema.clause_text import get_clause_text
from auto_schema import runner
from sqlalchemy.sql.sqltypes import String

from auto_schema import compare
from . import conftest


def assert_num_files(r: runner.Runner, expected_count):
    assert len(get_version_files(r)) == expected_count


def get_version_files(r: runner.Runner):
    versions_path = os.path.join(r.get_schema_path(), "versions")

    if os.path.isdir(versions_path):
        files = os.listdir(versions_path)
        files = list(filter(lambda f: f != '__pycache__', files))
        return files
    return []


# get sorted tabels not alembic_version
def get_sorted_tables(metadata: sa.MetaData) -> List[sa.Table]:
    return list(
        filter(lambda t: t.name != 'alembic_version', metadata.sorted_tables))


def assert_num_tables(r: runner.Runner, expected_count, tables=None):
    new_metadata = _get_new_metadata_for_runner(r)

    # sometimes, alembic_version is created in between revisions, we don't care about that case here
    # so just write it away
    sorted_tables = new_metadata.sorted_tables
    if expected_count == 0:
        sorted_tables = get_sorted_tables(new_metadata)

    assert len(sorted_tables) == expected_count

    if expected_count > 0 and tables is not None:
        table_names = [t.name for t in sorted_tables]
        table_names.sort()
        assert table_names == tables


def assert_no_changes_made(r: runner.Runner):
    assert_num_files(r, 0)
    assert_num_tables(r, 0)


def validate_edges_from_metadata(metadata: sa.MetaData, r: runner.Runner):
    edges_from_metadata = metadata.info.setdefault("edges", {})

    # denestify the schema
    if len(edges_from_metadata) != 0:
        edges_from_metadata = edges_from_metadata['public']

    db_edges = {}
    for row in r.get_connection().execute("SELECT * FROM assoc_edge_config"):
        row_dict = dict(row)
        db_edges[row_dict['edge_name']] = row_dict

    # same number of edges
    assert len(db_edges) == len(edges_from_metadata)

    for k, edge in edges_from_metadata.items():
        db_edge = db_edges.get(k)

        assert db_edge is not None

        assert db_edge['edge_name'] == edge['edge_name']
        # TO account for uuid
        assert str(db_edge['edge_type']) == str(edge['edge_type'])
        assert db_edge['edge_table'] == edge['edge_table']
        assert str(db_edge.get('inverse_edge_type')) == str(edge.get(
            'inverse_edge_type'))
        # 0 == False??
        assert db_edge.get('symmetric_edge') == edge.get('symmetric_edge')


def validate_data_from_metadata(metadata: sa.MetaData, r: runner.Runner):
    def sort_rows(rows):
        # sort each time by pkey and depend on the fact that sorting is stable
        for pkey in pkeys:
            rows.sort(key=lambda obj: obj[pkey])

    data_from_metadata = metadata.info.setdefault('data', {})
    if len(data_from_metadata) != 0:
        data_from_metadata = data_from_metadata['public']

    for table_name in data_from_metadata:

        data_rows = data_from_metadata[table_name]['rows']
        pkeys = data_from_metadata[table_name]['pkeys']
        sort_rows(data_rows)

        db_rows = []
        db_keys = []
        for row in r.get_connection().execute('SELECT * FROM %s' % table_name):
            row_dict = dict(row)
            if len(db_keys) == 0:
                db_keys = row_dict.keys()
            db_rows.append(row_dict)

        sort_rows(db_rows)

        # verify data in db is same after sorting
        # we go through each data row and set None for any missing keys
        for index, row in enumerate(data_rows):
            # set None for nullable keys that aren't specified in data rows
            for key in db_keys:
                row[key] = row.get(key, None)
            data_rows[index] = row

        assert data_rows == db_rows


def validate_metadata_after_change(r: runner.Runner, old_metadata: sa.MetaData):
    new_metadata = _get_new_metadata_for_runner(r)
    assert new_metadata != old_metadata

    dialect = r.get_connection().dialect.name
# TODO why is this here?
#    assert(len(old_metadata.sorted_tables)) != len(new_metadata.sorted_tables)

    new_metadata.bind = r.get_connection()
    for db_table in new_metadata.sorted_tables:
        schema_table = next(
            (t for t in old_metadata.sorted_tables if db_table.name == t.name), None)

        if schema_table is not None:
            _validate_table(schema_table, db_table, dialect, new_metadata)
        else:
            # no need to do too much testing on this since we'll just have to trust that alembic works.
            assert db_table.name == 'alembic_version'


def run_and_validate_with_standard_metadata_tables(r: runner.Runner, metadata_with_table: sa.MetaData, new_table_names=['accounts']):
    r.run()

    # should have the expected file with the expected tables
    assert_num_files(r, 1)
    tables = ['alembic_version']
    [tables.append(t) for t in new_table_names]
    tables.sort()
    assert_num_tables(r, len(tables), tables)

    validate_metadata_after_change(r, metadata_with_table)


def recreate_with_new_metadata(r: runner.Runner, new_test_runner, metadata_with_table: sa.MetaData, metadata_func) -> runner.Runner:
    metadata_func(metadata_with_table)
    # recreate and run
    r2 = new_test_runner(metadata_with_table, r)
    assert r.get_schema_path() == r2.get_schema_path()
    return r2


# TODO too many of these functions and not obvious what the difference is
def new_runner_from_old(prev_runner: runner.Runner, new_test_runner, new_metadata):
    new_metadata.bind = prev_runner.get_connection()
    r2 = new_test_runner(new_metadata, prev_runner)
    return r2


def recreate_metadata_fixture(new_test_runner, metadata: sa.MetaData, prev_runner: runner.Runner) -> runner.Runner:
    metadata.bind = prev_runner.get_connection()
    metadata.reflect()

    r = new_test_runner(metadata, prev_runner)
    return r


def run_edge_metadata_script(new_test_runner, metadata: sa.MetaData, message: String, metadata_with_assoc_edge_config, num_files=2, prev_runner=None, num_changes=1) -> runner.Runner:
    # TODO combine with recreate_with_new_metadata?
    if prev_runner is None:
        prev_runner = _setup_assoc_edge_config(
            new_test_runner, metadata_with_assoc_edge_config)

    r = recreate_metadata_fixture(new_test_runner, metadata, prev_runner)
    assert len(r.compute_changes()) == num_changes

    assert r.revision_message() == message

    r.run()
    # new file added for edge
    assert_num_files(r, num_files)
    validate_edges_from_metadata(metadata, r)

    return r


def _get_new_metadata_for_runner(r: runner.Runner) -> sa.MetaData:
    # metadata = r.get_metadata()
    # don't reflect but in fact get a new object so that we can reflect corectly
    new_metadata = sa.MetaData()
    # fetch any new tables
    new_metadata.reflect(bind=r.get_connection())
    return new_metadata


def _validate_table(schema_table: sa.Table, db_table: sa.Table, dialect: String, metadata: sa.MetaData):
    assert schema_table != db_table
    assert id(schema_table) != id(db_table)

    assert schema_table.name == db_table.name

    _validate_columns(schema_table, db_table, metadata, dialect)
    _validate_constraints(schema_table, db_table, dialect, metadata)
    _validate_indexes(schema_table, db_table, metadata, dialect)


def _validate_columns(schema_table: sa.Table, db_table: sa.Table, metadata: sa.MetaData, dialect: String):
    schema_columns = schema_table.columns
    db_columns = db_table.columns
    assert len(schema_columns) == len(db_columns)
    for schema_column, db_column in zip(schema_columns, db_columns):
        _validate_column(schema_column, db_column, metadata, dialect)


def _validate_column(schema_column: sa.Column, db_column: sa.Column, metadata: sa.MetaData, dialect: String):
    assert schema_column != db_column
    assert(id(schema_column)) != id(db_column)

    assert schema_column.name == db_column.name
    _validate_column_type(schema_column, db_column, metadata, dialect)
    assert schema_column.primary_key == db_column.primary_key
    assert schema_column.nullable == db_column.nullable

    _validate_foreign_key(schema_column, db_column)
    _validate_column_server_default(schema_column, db_column)

    # we don't actually support all these below yet but when we do, it should start failing and we should know that
    assert schema_column.default == db_column.default
    assert schema_column.index == db_column.index
    assert schema_column.unique == db_column.unique
    # assert schema_column.autoincrement == db_column.autoincrement # ignore autoincrement for now as there's differences btw default behavior and postgres
    assert schema_column.key == db_column.key
    assert schema_column.onupdate == db_column.onupdate
    assert schema_column.constraints == db_column.constraints
    assert len(schema_column.constraints) == 0
    assert schema_column.comment == db_column.comment


def _validate_column_server_default(schema_column: sa.Column, db_column: sa.Column):
    schema_clause_text = get_clause_text(
        schema_column.server_default)
    db_clause_text = get_clause_text(db_column.server_default)

    if isinstance(schema_column.type, sa.Boolean):
        schema_clause_text = runner.Runner.convert_postgres_boolean(
            schema_clause_text)
        db_clause_text = runner.Runner.convert_postgres_boolean(db_clause_text)

    if schema_clause_text is None and db_column.autoincrement == True:
        assert db_clause_text.startswith("nextval")
    else:
        assert schema_clause_text == db_clause_text


def _validate_column_type(schema_column: sa.Column, db_column: sa.Column, metadata: sa.MetaData, dialect: String):
    # array type. validate contents
    if isinstance(schema_column.type, postgresql.ARRAY):
        assert isinstance(db_column.type, postgresql.ARRAY)

        _validate_column_type_impl(
            schema_column.type.item_type, db_column.type.item_type, metadata, dialect, db_column, schema_column)
    else:

        _validate_column_type_impl(
            schema_column.type, db_column.type, metadata, dialect, db_column, schema_column)
    pass


def _validate_column_type_impl(schema_column_type, db_column_type, metadata: sa.MetaData, dialect, db_column: sa.Column, schema_column: sa.Column):

    if isinstance(schema_column_type, sa.TIMESTAMP):
        # timezone not supported in sqlite so this is just ignored there
        if dialect != 'sqlite':
            assert schema_column_type.timezone == db_column_type.timezone
        else:
            assert str(db_column_type) == "TIMESTAMP"
    elif isinstance(schema_column_type, sa.Time):
        # timezone not supported in sqlite so this is just ignored there
        if dialect != 'sqlite':
            assert schema_column_type.timezone == db_column_type.timezone
        else:
            assert str(db_column_type) == "TIME"
    elif isinstance(schema_column_type, sa.Numeric):
        assert isinstance(db_column_type, sa.Numeric)
        # precision is tricky so ignore this for now
        # assert schema_column.type.precision == db_column.type.precision
    elif isinstance(schema_column_type, postgresql.ENUM):
        # enum type if possible otherwise check constraint...
        assert isinstance(db_column_type, postgresql.ENUM)
        _validate_enum_column_type(metadata, db_column, schema_column)
    else:
        # compare types by using the string version of the types.
        # seems to account for differences btw Integer and INTEGER, String(255) and VARCHAR(255) etc

        assert str(schema_column_type) == str(db_column_type)


def _validate_enum_column_type(metadata: sa.MetaData, db_column: sa.Column, schema_column: sa.Column):
    # has to be same length
    assert(len(schema_column.type.enums) == len(db_column.type.enums))

    # if equal, nothing to do here, we're done
    if schema_column.type.enums == db_column.type.enums:
        return

    # we gotta go to the db and check the order
    db_sorted_enums = []
    # https://www.postgresql.org/docs/9.5/functions-enum.html
    query = "select unnest(enum_range(enum_first(null::%s)));" % (
        db_column.type.name)
    for row in metadata.bind.execute(query):
        db_sorted_enums.append(dict(row)['unnest'])

    assert schema_column.type.enums == db_sorted_enums


def _sort_fn(item):
    # if name is null, use type of object to sort
    if item.name is None:
        return type(item).__name__ + str(id(item))
    # otherwise, use name + class name
    return type(item).__name__ + item.name


def _validate_indexes(schema_table: sa.Table, db_table: sa.Table, metadata: sa.MetaData, dialect: String):
    # sort indexes so that the order for both are the same
    schema_indexes = sorted(schema_table.indexes, key=_sort_fn)
    db_indexes = sorted(db_table.indexes, key=_sort_fn)

    assert len(schema_indexes) == len(db_indexes)
    for schema_index, db_index in zip(schema_indexes, db_indexes):
        # index names should be equal
        assert schema_index.name == db_index.name

        schema_index_columns = schema_index.columns
        db_index_columns = db_index.columns
        for schema_column, db_column in zip(schema_index_columns, db_index_columns):
            _validate_column(schema_column, db_column, metadata, dialect)


def _validate_constraints(schema_table: sa.Table, db_table: sa.Table, dialect: String, metadata: sa.MetaData):
    # sort constraints so that the order for both are the same
    schema_constraints = sorted(schema_table.constraints, key=_sort_fn)
    db_constraints = sorted(db_table.constraints, key=_sort_fn)

    bool_column_names_set = set()
    # sqlite doesn't support native boolean datatype so it adds another constraint.
    # This is us working around that...
    if dialect == 'sqlite':
        # remove the extra sqlite specific boolean constraints
        bool_columns = list(filter(lambda col: str(
            col.type) == 'BOOLEAN', db_table.columns))
        bool_columns_set = set(bool_columns)
        bool_column_names_set = set([col.name for col in bool_columns])
        db_constraints_to_compare = []
        for constraint in db_constraints:
            if isinstance(constraint, sa.CheckConstraint) and len(constraint.columns) == 1 and len(bool_columns_set.intersection(constraint.columns)) > 0:
                continue
            db_constraints_to_compare.append(constraint)

        db_constraints = db_constraints_to_compare

    assert len(schema_constraints) == len(db_constraints)

    for schema_constraint, db_constraint in zip(schema_constraints, db_constraints):
        # constraint names should be equal
        if schema_constraint.name == '_unnamed_' and dialect == 'sqlite':
            assert db_constraint.name == None
        else:
            assert schema_constraint.name == db_constraint.name

        schema_constraint_columns = schema_constraint.columns
        db_constraint_columns = db_constraint.columns

        if (dialect == 'sqlite' and
            isinstance(db_constraint, sa.CheckConstraint) and
            len(schema_constraint_columns) == 1 and
            len(db_constraint_columns) == 0 and
            # sqlalchemy's default check constraint adds an extra rule for dialects that don't natively
            # support booleans, if we're in this case, check for it and don't do the rest of the checks
            # see _should_create_constraint in sqltypes.py
                len(bool_column_names_set.intersection([col.name for col in schema_constraint_columns])) == 1):
            continue

        assert len(schema_constraint_columns) == len(db_constraint_columns)
        for schema_column, db_column in zip(schema_constraint_columns, db_constraint_columns):
            _validate_column(schema_column, db_column, metadata, dialect)


def _validate_foreign_key(schema_column: sa.Column, db_column: sa.Column):
    assert len(schema_column.foreign_keys) == len(schema_column.foreign_keys)

    for db_fkey, schema_fkey in zip(db_column.foreign_keys, schema_column.foreign_keys):
        # similar to what we do in validate_table on column.type
        assert str(db_fkey.column) == str(schema_fkey.column)
        assert db_fkey.name == schema_fkey.name
        assert db_fkey.ondelete == schema_fkey.ondelete
        assert db_fkey.onupdate == schema_fkey.onupdate

        # we don't actually support all these below yet but when we do, it should start failing and we should know that
        assert db_fkey.deferrable == schema_fkey.deferrable
        assert db_fkey.initially == schema_fkey.initially
       # assert db_fkey.link_to_name == schema_fkey.link_to_name # this seems like it's expected to change. TODO figure this out more
        assert db_fkey.use_alter == schema_fkey.use_alter
        assert db_fkey.match == schema_fkey.match
        assert db_fkey.info == schema_fkey.info
        assert str(db_fkey.parent) == str(schema_fkey.parent)


def _setup_assoc_edge_config(new_test_runner, metadata_with_assoc_edge_config):
    # no revision, just do the changes to setup base case
    r = new_test_runner(metadata_with_assoc_edge_config)
    assert len(r.compute_changes()) == 1
    r.run()
    assert_num_tables(r, 2, ['alembic_version', 'assoc_edge_config'])
    assert_num_files(r, 1)
    # r.get_metadata().reflect(bind=r.get_connection())

    return r


def make_changes_and_restore(
    new_test_runner,
    metadata_with_table,
    metadata_change_func,
    r2_message,
    r3_message,
    validate_schema=True,
    post_r2_func=None,
):
    r = new_test_runner(metadata_with_table)
    run_and_validate_with_standard_metadata_tables(
        r, metadata_with_table)

    r2 = recreate_with_new_metadata(
        r, new_test_runner, metadata_with_table, metadata_change_func)

    message = r2.revision_message()
    assert message == r2_message

    r2.run()

    # should have the expected files with the expected tables
    assert_num_files(r2, 2)
    assert_num_tables(r2, 2, ['accounts', 'alembic_version'])

    if post_r2_func is not None:
        post_r2_func(r2)

    # run again. should be a no-op
    r2.run()

    # downgrade and upgrade back should work
    r2.downgrade(delete_files=False, revision='-1')
    r2.upgrade()

    if validate_schema:
        validate_metadata_after_change(r2, r2.get_metadata())

    r3 = recreate_metadata_fixture(
        new_test_runner, conftest.metadata_with_base_table_restored(), r2)

    message = r3.revision_message()
    assert message == r3_message

    r3.run()

    # should have the expected files with the expected tables
    assert_num_files(r3, 3)
    assert_num_tables(r3, 2, ['accounts', 'alembic_version'])

    # downgrade and upgrade back should work
    r3.downgrade(delete_files=False, revision='-1')
    r3.upgrade()
