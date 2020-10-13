import pprint
import pytest
import os

import sqlalchemy as sa
import alembic.operations.ops as alembicops
from sqlalchemy.dialects import postgresql

from . import conftest
from auto_schema import runner
from auto_schema import ops


def get_new_metadata_for_runner(r):
    # metadata = r.get_metadata()
    # don't reflect but in fact get a new object so that we can reflect corectly
    new_metadata = sa.MetaData()
    # fetch any new tables
    new_metadata.reflect(bind=r.get_connection())
    return new_metadata


def assert_num_files(r, expected_count):
    versions_path = os.path.join(r.get_schema_path(), "versions")

    if os.path.isdir(versions_path):
        files = os.listdir(versions_path)
        files = list(filter(lambda f: f != '__pycache__', files))
        assert len(files) == expected_count
    else:
        # if versions directory is 0, we better make sure expected_count is 0
        assert expected_count == 0


def assert_num_tables(r, expected_count, tables=None):
    new_metadata = get_new_metadata_for_runner(r)

    # sometimes, alembic_version is created in between revisions, we don't care about that case here
    # so just write it away
    sorted_tables = new_metadata.sorted_tables
    if expected_count == 0:
        sorted_tables = list(
            filter(lambda t: t.name != 'alembic_version', new_metadata.sorted_tables))

    assert len(sorted_tables) == expected_count

    if expected_count > 0 and tables is not None:
        table_names = [t.name for t in sorted_tables]
        table_names.sort()
        assert table_names == tables


def assert_no_changes_made(r):
    assert_num_files(r, 0)
    assert_num_tables(r, 0)


def validate_edges_from_metadata(metadata, r):
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
        assert db_edge['edge_type'] == edge['edge_type']
        assert db_edge['edge_table'] == edge['edge_table']
        assert db_edge.get('inverse_edge_type') == edge.get(
            'inverse_edge_type')
        # 0 == False??
        assert db_edge.get('symmetric_edge') == edge.get('symmetric_edge')


def validate_data_from_metadata(metadata, r):
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


# TODO audit that this is being called...
def validate_metadata_after_change(r, old_metadata):
    new_metadata = get_new_metadata_for_runner(r)
    assert new_metadata != old_metadata

    dialect = r.get_connection().dialect.name
    assert(len(old_metadata.sorted_tables)) != len(new_metadata.sorted_tables)

    new_metadata.bind = r.get_connection()
    for db_table in new_metadata.sorted_tables:
        schema_table = next(
            (t for t in old_metadata.sorted_tables if db_table.name == t.name), None)

        if schema_table is not None:
            validate_table(schema_table, db_table, dialect, new_metadata)
        else:
            # no need to do too much testing on this since we'll just have to trust that alembic works.
            assert db_table.name == 'alembic_version'


def run_and_validate_with_standard_metadata_tables(r, metadata_with_table, new_table_names=['accounts']):
    r.run()

    # should have the expected file with the expected tables
    assert_num_files(r, 1)
    tables = ['alembic_version']
    [tables.append(t) for t in new_table_names]
    tables.sort()
    assert_num_tables(r, len(tables), tables)

    validate_metadata_after_change(r, metadata_with_table)


def recreate_with_new_metadata(r, new_test_runner, metadata_with_table, metadata_func):
    metadata_func(metadata_with_table)
    # recreate and run
    r2 = new_test_runner(metadata_with_table, r)
    assert r.get_schema_path() == r2.get_schema_path()
    return r2


def validate_table(schema_table, db_table, dialect, metadata):
    assert schema_table != db_table
    assert id(schema_table) != id(db_table)

    assert schema_table.name == db_table.name

    validate_columns(schema_table, db_table, metadata)
    validate_constraints(schema_table, db_table, dialect, metadata)
    validate_indexes(schema_table, db_table, metadata)


def validate_columns(schema_table, db_table, metadata):
    schema_columns = schema_table.columns
    db_columns = db_table.columns
    assert len(schema_columns) == len(db_columns)
    for schema_column, db_column in zip(schema_columns, db_columns):
        validate_column(schema_column, db_column, metadata)


def validate_column(schema_column, db_column, metadata):
    assert schema_column != db_column
    assert(id(schema_column)) != id(db_column)

    assert schema_column.name == db_column.name
    validate_column_type(schema_column, db_column, metadata)
    assert schema_column.primary_key == db_column.primary_key
    assert schema_column.nullable == db_column.nullable

    validate_foreign_key(schema_column, db_column)
    validate_column_server_default(schema_column, db_column)

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


def validate_column_server_default(schema_column, db_column):
    schema_clause_text = runner.Runner.get_clause_text(
        schema_column.server_default)
    db_clause_text = runner.Runner.get_clause_text(db_column.server_default)

    if isinstance(schema_column.type, sa.Boolean):
        schema_clause_text = runner.Runner.convert_postgres_boolean(
            schema_clause_text)
        db_clause_text = runner.Runner.convert_postgres_boolean(db_clause_text)

    if schema_clause_text is None and db_column.autoincrement == True:
        assert db_clause_text.startswith("nextval")
    else:
        assert schema_clause_text == db_clause_text


def validate_column_type(schema_column, db_column, metadata):
    # print(type(schema_column.type).__name__, schema_column.type, db_column.type, schema_column.type == db_column.type, str(schema_column.type) == str(db_column.type))

    if isinstance(schema_column.type, sa.TIMESTAMP):
        assert schema_column.type.timezone == db_column.type.timezone
    elif isinstance(schema_column.type, sa.Numeric):
        assert isinstance(db_column.type, sa.Numeric)
        # precision is tricky so ignore this for now
        # assert schema_column.type.precision == db_column.type.precision
    elif isinstance(schema_column.type, postgresql.ENUM):
        # enum type if possible otherwise check constraint...
        assert isinstance(db_column.type, postgresql.ENUM)
        validate_enum_column_type(metadata, db_column, schema_column)
    else:
        # compare types by using the string version of the types.
        # seems to account for differences btw Integer and INTEGER, String(255) and VARCHAR(255) etc

        assert str(schema_column.type) == str(db_column.type)


def validate_enum_column_type(metadata, db_column, schema_column):
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


def sort_fn(item):
    # if name is null, use type of object to sort
    if item.name is None:
        return type(item).__name__ + str(id(item))
    # otherwise, use name + class name
    return type(item).__name__ + item.name


def validate_indexes(schema_table, db_table, metadata):
    # sort indexes so that the order for both are the same
    schema_indexes = sorted(schema_table.indexes, key=sort_fn)
    db_indexes = sorted(db_table.indexes, key=sort_fn)

    assert len(schema_indexes) == len(db_indexes)
    for schema_index, db_index in zip(schema_indexes, db_indexes):
        # index names should be equal
        assert schema_index.name == db_index.name

        schema_index_columns = schema_index.columns
        db_index_columns = db_index.columns
        for schema_column, db_column in zip(schema_index_columns, db_index_columns):
            validate_column(schema_column, db_column, metadata)


def validate_constraints(schema_table, db_table, dialect, metadata):
    # sort constraints so that the order for both are the same
    schema_constraints = sorted(schema_table.constraints, key=sort_fn)
    db_constraints = sorted(db_table.constraints, key=sort_fn)

    bool_columns = []
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
            validate_column(schema_column, db_column, metadata)


def validate_foreign_key(schema_column, db_column):
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


def setup_assoc_edge_config(new_test_runner):
    # no revision, just do the changes to setup base case
    r = new_test_runner(conftest.metadata_assoc_edge_config())
    assert len(r.compute_changes()) == 1
    r.run()
    assert_num_tables(r, 2, ['alembic_version', 'assoc_edge_config'])
    assert_num_files(r, 1)
    # r.get_metadata().reflect(bind=r.get_connection())

    return r


def recreate_metadata_fixture(new_test_runner, metadata, prev_runner):
    metadata.bind = prev_runner.get_connection()
    metadata.reflect()

    r = new_test_runner(metadata, prev_runner)
    return r


def run_edge_metadata_script(new_test_runner, metadata, message, num_files=2, prev_runner=None, num_changes=1):
    # TODO combine with recreate_with_new_metadata?
    if prev_runner is None:
        prev_runner = setup_assoc_edge_config(new_test_runner)

    r = recreate_metadata_fixture(new_test_runner, metadata, prev_runner)
    assert len(r.compute_changes()) == num_changes

    assert r.revision_message() == message

    r.run()
    # new file added for edge
    assert_num_files(r, num_files)
    validate_edges_from_metadata(metadata, r)

    return r


class BaseTestRunner(object):

    @pytest.mark.usefixtures("empty_metadata")
    def test_compute_changes_with_empty_metadata(self, new_test_runner, empty_metadata):
        r = new_test_runner(empty_metadata)
        assert r.compute_changes() == []
        assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_compute_changes_with_new_table(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        assert len(r.compute_changes()) == 1
        assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_index_added_and_removed(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        r2 = recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_table_with_index)

        message = r2.revision_message()
        assert message == "add index accounts_first_name_idx to accounts"

        r2.run()
        assert_num_files(r2, 2)
        assert_num_tables(r2, 2)

        r3 = recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_base_table_restored(), r2)

        message = r3.revision_message()
        assert message == "drop index accounts_first_name_idx from accounts"

        r3.run()
        assert_num_files(r3, 3)
        assert_num_tables(r3, 2)

    @pytest.mark.usefixtures("metadata_with_two_tables")
    def test_compute_changes_with_two_tables(self, new_test_runner, metadata_with_two_tables):
        r = new_test_runner(metadata_with_two_tables)
        assert len(r.compute_changes()) == 2
        assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_foreign_key")
    def test_compute_changes_with_foreign_key_table(self, new_test_runner, metadata_with_foreign_key):
        r = new_test_runner(metadata_with_foreign_key)
        assert len(r.compute_changes()) == 2
        assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_foreign_key_to_same_table")
    def test_compute_changes_with_foreign_key_to_same_table(self, new_test_runner, metadata_with_foreign_key_to_same_table):
        r = new_test_runner(metadata_with_foreign_key_to_same_table)
        # same table so don't need a second change. this is where the extra checks we're seeing are coming from?
        assert len(r.compute_changes()) == 1
        assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_revision_message(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)

        message = r.revision_message()
        assert message == "add accounts table"

    @pytest.mark.usefixtures("metadata_with_two_tables")
    def test_revision_message_two_tables(self, new_test_runner, metadata_with_two_tables):
        r = new_test_runner(metadata_with_two_tables)

        message = r.revision_message()
        assert message == "add accounts table\nadd messages table"

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_revision(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)

        r.revision()

        # 1 schema file should have been created
        assert_num_files(r, 1)
        assert_num_tables(r, 0)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_revision_with_multi_step(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)

        r.revision()

        # 1 schema file should have been created
        assert_num_files(r, 1)

        # upgrade the schema in between. let's do a cursory check that it works
        r.upgrade()

        # confirm that 2 tables were created
        assert_num_tables(r, 2, ['accounts', 'alembic_version'])

        r2 = recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.messages_table)

        r2.revision()

        # we should have a 2nd schema path
        assert_num_files(r2, 2)

        # upgrade the schema and let's confirm it works
        r2.upgrade()

        # confirm that a 3rd table was created
        assert_num_tables(r2, 3, ['accounts', 'alembic_version', 'messages'])

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_table_add(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_multi_column_index_added_and_removed(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        r2 = recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_multi_column_index)

        message = r2.revision_message()
        assert message == "add index accounts_first_name_last_name_idx to accounts"

        r2.run()
        assert_num_files(r2, 2)
        assert_num_tables(r2, 2)

        tables = [t for t in r2.get_metadata(
        ).sorted_tables if t.name == "accounts"]
        assert len(tables) == 1
        table = tables[0]

        assert len(table.indexes) == 1
        index = table.indexes.pop()
        assert len(index.columns) == 2

        r3 = recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_base_table_restored(), r2)

        message = r3.revision_message()
        assert message == "drop index accounts_first_name_last_name_idx from accounts"

        r3.run()
        assert_num_files(r3, 3)
        assert_num_tables(r3, 2)

    @pytest.mark.usefixtures("metadata_with_multi_column_pkey_constraint")
    def test_new_table_with_multi_column_pkey_constraint(self, new_test_runner, metadata_with_multi_column_pkey_constraint):
        r = new_test_runner(metadata_with_multi_column_pkey_constraint)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multi_column_pkey_constraint,
            new_table_names=['user_friends_edge'],
        )

        tables = r.get_metadata().sorted_tables
        assert len(r.get_metadata().sorted_tables) == 1
        table = tables.pop()

        assert len(table.constraints) == 1
        constraint = table.constraints.pop()
        assert isinstance(constraint, sa.PrimaryKeyConstraint)
        assert len(constraint.columns) == 3

    @pytest.mark.usefixtures("metadata_with_multi_column_unique_constraint")
    def test_new_table_with_multi_column_unique_constraint(self, new_test_runner, metadata_with_multi_column_unique_constraint):
        r = new_test_runner(metadata_with_multi_column_unique_constraint)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multi_column_unique_constraint,
            new_table_names=['contacts'],
        )

        tables = r.get_metadata().sorted_tables
        assert len(r.get_metadata().sorted_tables) == 1
        table = tables.pop()

        assert len(table.constraints) == 2
        constraints = table._sorted_constraints
        # first constraint, we don't care about but acknowledge
        assert isinstance(constraints[0], sa.PrimaryKeyConstraint)
        constraint = constraints[1]
        assert isinstance(constraint, sa.UniqueConstraint)
        assert len(constraint.columns) == 2

        dialect = r.get_connection().dialect.name
        # can't drop a constraint in sqlite so skipping below
        if dialect == 'sqlite':
            return

        r2 = recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_contacts_table_with_no_unique_constraint(), r)
        message = r2.revision_message()
        assert message == "drop constraint contacts_unique_email_per_contact from contacts"

        r2.run()

        assert_num_files(r2, 2)
        assert_num_tables(r2, 2, ['alembic_version', 'contacts'])

    @pytest.mark.usefixtures("metadata_with_multi_column_fkey_constraint")
    def test_new_table_with_multi_column_fkey_constraint(self, new_test_runner, metadata_with_multi_column_fkey_constraint):
        r = new_test_runner(metadata_with_multi_column_fkey_constraint)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multi_column_fkey_constraint,
            new_table_names=['t1', 't2'],
        )

        tables = r.get_metadata().sorted_tables
        assert len(r.get_metadata().sorted_tables) == 2
        tables = [t for t in tables if t.name == 't2']
        table = tables[0]

        assert len(table.constraints) == 2
        constraints = table._sorted_constraints
        # first constraint, we don't care about but acknowledge
        assert isinstance(constraints[0], sa.PrimaryKeyConstraint)
        constraint = constraints[1]
        assert isinstance(constraint, sa.ForeignKeyConstraint)
        assert len(constraint.columns) == 2

        dialect = r.get_connection().dialect.name
        # can't drop a constraint in sqlite so skipping below
        if dialect == 'sqlite':
            return

        r2 = recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_multi_column_fkey_constraint_removed(), r)
        message = r2.revision_message()
        assert message == "drop constraint t2_fkey from t2"

        r2.run()

        assert_num_files(r2, 2)
        assert_num_tables(r2, 3, ['alembic_version', 't1', 't2'])

    # ideally we catch the expected error but this is the best we seem to be able to do do for now

    @pytest.mark.usefixtures("metadata_with_multi_column_fkey_constraint_no_constraint_reference_table")
    @pytest.mark.xfail()
    def test_new_table_with_invalid_multi_column_constraint(self, new_test_runner, metadata_with_multi_column_fkey_constraint_no_constraint_reference_table):
        r = new_test_runner(
            metadata_with_multi_column_fkey_constraint_no_constraint_reference_table)

        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multi_column_fkey_constraint_no_constraint_reference_table,
            new_table_names=['t1', 't2'],
        )

    @pytest.mark.usefixtures("metadata_with_column_check_constraint")
    def test_new_table_with_column_check_constraint(self, new_test_runner, metadata_with_column_check_constraint):
        r = new_test_runner(metadata_with_column_check_constraint)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_column_check_constraint,
            new_table_names=['t1'],
        )

        tables = r.get_metadata().sorted_tables
        assert len(r.get_metadata().sorted_tables) == 1
        table = tables.pop()

        assert len(table.constraints) == 2
        constraints = table._sorted_constraints
        # first constraint, we don't care about but acknowledge
        assert isinstance(constraints[0], sa.PrimaryKeyConstraint)
        constraint = constraints[1]
        assert isinstance(constraint, sa.CheckConstraint)
        assert len(constraint.columns) == 0

    @pytest.mark.usefixtures("metadata_with_multi_column_check_constraint")
    def test_new_table_with_multi_column_check_constraint(self, new_test_runner, metadata_with_multi_column_check_constraint):
        r = new_test_runner(metadata_with_multi_column_check_constraint)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multi_column_check_constraint,
            new_table_names=['t1'],
        )

        tables = r.get_metadata().sorted_tables
        assert len(r.get_metadata().sorted_tables) == 1
        table = tables.pop()

        assert len(table.constraints) == 4
        constraints = table._sorted_constraints
        # first constraint, we don't care about but acknowledge
        assert isinstance(constraints[0], sa.PrimaryKeyConstraint)
        for idx in range(1, 4):
            constraint = constraints[idx]
            assert isinstance(constraint, sa.CheckConstraint)
            assert len(constraint.columns) == 0

    @pytest.mark.usefixtures("metadata_with_table")
    def test_sequential_table_adds(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        # recreate runner with last runner
        r2 = recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.messages_table)
        r2.run()

        # should have the expected files with the expected tables
        assert_num_files(r2, 2)
        assert_num_tables(r2, 3, ['accounts', 'alembic_version', 'messages'])

        validate_metadata_after_change(r2, metadata_with_table)

    @pytest.mark.usefixtures("metadata_with_two_tables")
    def test_multiple_tables_added(self, new_test_runner, metadata_with_two_tables):
        r = new_test_runner(metadata_with_two_tables)
        r.run()

        # should have the expected file with the expected tables
        # because 2 new tables added at the same time, only one schema file needed
        assert_num_files(r, 1)
        assert_num_tables(r, 3, ['accounts', 'alembic_version', 'messages'])

        validate_metadata_after_change(r, metadata_with_two_tables)

    @pytest.mark.usefixtures("metadata_with_no_edges")
    def test_no_new_edges(self, new_test_runner, metadata_with_no_edges):
        run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            message='',
            num_files=1,  # just the first file
            num_changes=0
        )

    @pytest.mark.usefixtures("metadata_with_one_edge")
    def test_one_new_edge(self, new_test_runner, metadata_with_one_edge):
        run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge"
        )

    @pytest.mark.usefixtures("metadata_with_symmetric_edge")
    def test_symmetric_edge(self, new_test_runner, metadata_with_symmetric_edge):
        run_edge_metadata_script(
            new_test_runner,
            metadata_with_symmetric_edge,
            "add edge UserToFriendsEdge"
        )

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_no_edges")
    def test_new_edge_then_remove(self, new_test_runner, metadata_with_one_edge, metadata_with_no_edges):
        r = run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge"
        )

        run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            "remove edge UserToFollowersEdge",
            num_files=3,
            prev_runner=r
        )

    @pytest.mark.usefixtures("metadata_with_inverse_edge")
    def test_inverse_edge_added_same_time(self, new_test_runner, metadata_with_inverse_edge, metadata_with_no_edges):
        r = run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "add edges UserToFolloweesEdge, UserToFollowersEdge",
        )

        run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            "remove edges UserToFolloweesEdge, UserToFollowersEdge",
            prev_runner=r,
            num_files=3,
        )

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_inverse_edge", "metadata_with_no_edges")
    def test_inverse_edge_added_after(self, new_test_runner, metadata_with_one_edge, metadata_with_inverse_edge, metadata_with_no_edges):
        r = run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge"
        )

        # TODO need to test up/down for edges
        # TODO need to change the rendered to only show the minimum
        # e.g. op.remove_edge(edge_type)

        r2 = run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "add edge UserToFolloweesEdge\nmodify edge UserToFollowersEdge",
            prev_runner=r,
            num_files=3,
            num_changes=2,
        )

        run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            "remove edges UserToFolloweesEdge, UserToFollowersEdge",
            prev_runner=r2,
            num_files=4,
            num_changes=1,
        )

    @pytest.mark.usefixtures("metadata_with_nullable_fields")
    def test_new_table_with_nullable_fields(self, new_test_runner, metadata_with_nullable_fields):
        r = new_test_runner(metadata_with_nullable_fields)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_nullable_fields)

    @pytest.mark.usefixtures("metadata_with_foreign_key_to_same_table")
    def test_with_foreign_key_to_same_table(self, new_test_runner, metadata_with_foreign_key_to_same_table):
        r = new_test_runner(metadata_with_foreign_key_to_same_table)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_foreign_key_to_same_table, new_table_names=["assoc_edge_config"])

    @pytest.mark.usefixtures('metadata_with_request_data')
    def test_saving_data(self, new_test_runner, metadata_with_request_data):
        r = new_test_runner(metadata_with_request_data)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_request_data, new_table_names=["request_statuses"])

        validate_data_from_metadata(metadata_with_request_data, r)

        new_metadata = conftest.metadata_with_row_removed(
            metadata_with_request_data)
        new_metadata.bind = r.get_connection()
        r2 = new_test_runner(new_metadata, r)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.RemoveRowsOp)

        assert r2.revision_message() == "remove row from request_statuses"

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, new_metadata)
        validate_data_from_metadata(new_metadata, r2)

        new_metadata = conftest.metadata_with_rows_added(
            metadata_with_request_data)
        new_metadata.bind = r.get_connection()
        r3 = new_test_runner(new_metadata, r)

        diff = r3.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.AddRowsOp)
        assert r3.revision_message() == "add rows to request_statuses"

        r3.run()
        assert_num_files(r3, 3)
        validate_metadata_after_change(r3, new_metadata)
        validate_data_from_metadata(new_metadata, r3)

    @pytest.mark.usefixtures('metadata_with_multiple_data_tables')
    def test_saving_complex_data(self, new_test_runner, metadata_with_multiple_data_tables):
        r = new_test_runner(metadata_with_multiple_data_tables)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multiple_data_tables,
            # got 3 tables
            new_table_names=["request_statuses", "rainbows"]
        )

        # data is as expected
        validate_data_from_metadata(metadata_with_multiple_data_tables, r)

        # update multiple objects so there's different values
        new_metadata = conftest.metadata_with_rainbows_enum_changed(
            metadata_with_multiple_data_tables)
        new_metadata.bind = r.get_connection()
        r2 = new_test_runner(new_metadata, r)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.ModifyRowsOp)
        assert r2.revision_message() == 'modify rows in rainbows'

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, new_metadata)
        validate_data_from_metadata(new_metadata, r2)

    @pytest.mark.usefixtures('metadata_with_triple_pkey')
    def test_multiple_column_pkey(self, new_test_runner, metadata_with_triple_pkey):
        r = new_test_runner(metadata_with_triple_pkey)
        run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_triple_pkey,
            # got 3 tables
            new_table_names=["group_members", "roles"]
        )
        validate_data_from_metadata(metadata_with_triple_pkey, r)

        # remove rows
        new_metadata = conftest.metadata_with_triple_pkey_with_rows_removed(
            metadata_with_triple_pkey)
        new_metadata.bind = r.get_connection()
        r2 = new_test_runner(new_metadata, r)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.RemoveRowsOp)
        assert r2.revision_message() == 'remove rows from group_members'

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, new_metadata)
        validate_data_from_metadata(new_metadata, r2)

        # modify row
        new_metadata = conftest.metadata_with_triple_pkey_with_rows_changed(
            metadata_with_triple_pkey)
        new_metadata.bind = r.get_connection()
        r3 = new_test_runner(new_metadata, r)

        diff = r3.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.ModifyRowsOp)
        assert r3.revision_message() == 'modify rows in group_members'

        r3.run()
        assert_num_files(r3, 3)
        validate_metadata_after_change(r3, new_metadata)
        validate_data_from_metadata(new_metadata, r3)


class TestPostgresRunner(BaseTestRunner):

    # only in postgres because modifying columns not supported by Sqlite
    @pytest.mark.usefixtures("metadata_with_table")
    @pytest.mark.parametrize(
        "new_metadata_func, expected_message",
        [
            (conftest.metadata_with_table_text_changed,
             "modify column email_address type from VARCHAR(255) to TEXT"),
            (conftest.metadata_with_timestamp_changed,
             "modify column created_at type from DATE to TIMESTAMP"),
            (conftest.metadata_with_nullable_changed,
             "modify nullable value of column last_name from False to True"),
            (conftest.metadata_with_server_default_changed_int,
             "modify server_default value of column meaning_of_life from 42 to 35"),
            (conftest.metadata_with_server_default_changed_bool,
             "modify server_default value of column email_verified from false to TRUE"),
            (conftest.metadata_with_created_at_default_changed,
             "modify server_default value of column created_at from None to now()"),
        ])
    def test_column_attr_change(self, new_test_runner, metadata_with_table, new_metadata_func, expected_message):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        # recreate runner with last path and modified metadata
        new_metadata_func(metadata_with_table)
        r2 = new_test_runner(metadata_with_table, r)

        diff = r2.compute_changes()

        assert len(diff) == 1

        assert r2.revision_message() == expected_message

        r.run()

        validate_metadata_after_change(r, metadata_with_table)

    # only in postgres because "No support for ALTER of constraints in SQLite dialect"

    @pytest.mark.usefixtures("metadata_with_table")
    def test_unique_constraint_added(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        r2 = recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_unique_constraint_added)

        message = r2.revision_message()
        assert message == "add unique constraint accounts_unique_email_address"

        r2.run()

        # should have the expected files with the expected tables
        assert_num_files(r2, 2)
        assert_num_tables(r2, 2, ['accounts', 'alembic_version'])
        validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_table")
    def test_check_constraint_added_and_removed(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        r2 = recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_constraint_added_after)

        message = r2.revision_message()
        assert message == "add constraint meaning_of_life_correct to accounts"

        r2.run()

        # should have the expected files with the expected tables
        assert_num_files(r2, 2)
        assert_num_tables(r2, 2, ['accounts', 'alembic_version'])
        validate_metadata_after_change(r2, r2.get_metadata())

        r3 = recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_base_table_restored(), r2)

        message = r3.revision_message()
        assert message == "drop constraint meaning_of_life_correct from accounts"

        r3.run()

        # should have the expected files with the expected tables
        assert_num_files(r3, 3)
        assert_num_tables(r3, 2, ['accounts', 'alembic_version'])

    @pytest.mark.usefixtures('metadata_with_enum_type')
    def test_enum_type(self, new_test_runner, metadata_with_enum_type):
        r = new_test_runner(metadata_with_enum_type)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

    @pytest.mark.usefixtures("metadata_with_enum_type")
    @pytest.mark.parametrize(
        'new_metadata_func, expected_diff',
        [
            (conftest.metadata_with_new_enum_value, 1),
            (conftest.metadata_with_multiple_new_enum_values, 2),
            (conftest.metadata_with_enum_value_before_first_pos, 1),
            (conftest.metadata_with_multiple_new_enum_values_at_diff_pos, 2),
            (conftest.metadata_with_multiple_new_values_before, 2),
        ]
    )
    def test_enum_additions(self, new_test_runner, metadata_with_enum_type, new_metadata_func, expected_diff):
        r = new_test_runner(metadata_with_enum_type)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

        # TODO this isn't ideal
        # need a good way to commit in between for separate steps in transaction to work
        conn = r.get_connection()
        conn.execute('COMMIT')

        new_metadata_func(metadata_with_enum_type)
        r2 = new_test_runner(metadata_with_enum_type, r)

        diff = r2.compute_changes()

        assert len(diff) == expected_diff

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, metadata_with_enum_type)

    @pytest.mark.usefixtures("metadata_with_enum_type")
    def test_remove_enum_value(self, new_test_runner, metadata_with_enum_type):
        r = new_test_runner(metadata_with_enum_type)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

        # TODO this isn't ideal
        # need a good way to commit in between for separate steps in transaction to work
        conn = r.get_connection()
        conn.execute('COMMIT')

        conftest.metadata_with_removed_enum_value(metadata_with_enum_type)
        r2 = new_test_runner(metadata_with_enum_type, r)

        with pytest.raises(ValueError, match="postgres doesn't support enum removals"):
            diff = r2.compute_changes()

    @pytest.mark.usefixtures("metadata_with_table")
    def test_remove_column(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        new_metadata = conftest.metadata_with_removed_column()
        new_metadata.bind = r.get_connection()
        r2 = new_test_runner(new_metadata, r)

        diff = r2.compute_changes()

        assert len(diff) == 1

        assert r2.revision_message() == 'drop column meaning_of_life'

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, new_metadata)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_enum_column_added_then_removed(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        run_and_validate_with_standard_metadata_tables(r, metadata_with_table)

        # add column with enum
        new_metadata = conftest.metadata_with_new_enum_column()
        new_metadata.bind = r.get_connection()
        r2 = new_test_runner(new_metadata, r)

        diff = r2.compute_changes()

        assert len(diff) == 2

        add_enum = [op for op in diff if isinstance(op, ops.AddEnumOp)]
        modify_table_ops = [op for op in diff if isinstance(
            op, alembicops.ModifyTableOps)]
        assert len(add_enum) == 1
        assert len(modify_table_ops) == 1

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, new_metadata)

        # drop column with enum
        r3 = new_test_runner(metadata_with_table, r)
        diff = r3.compute_changes()

        assert len(diff) == 2

        drop_enum = [op for op in diff if isinstance(op, ops.DropEnumOp)]
        modify_table_ops = [op for op in diff if isinstance(
            op, alembicops.ModifyTableOps)]

        assert len(drop_enum) == 1
        assert len(modify_table_ops) == 1

        r3.run()
        assert_num_files(r3, 3)
        validate_metadata_after_change(r3, metadata_with_table)

    @pytest.mark.usefixtures("metadata_with_enum_type")
    def test_drop_table_with_enum(self, new_test_runner, metadata_with_enum_type):
        r = new_test_runner(metadata_with_enum_type)
        run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

        # no tables
        new_metadata = sa.MetaData()
        new_metadata.bind = r.get_connection()
        r2 = new_test_runner(new_metadata, r)

        diff = r2.compute_changes()

        assert len(diff) == 2

        drop_enum = [op for op in diff if isinstance(op, ops.DropEnumOp)]
        drop_table = [op for op in diff if isinstance(
            op, alembicops.DropTableOp)]
        assert len(drop_enum) == 1
        assert len(drop_table) == 1

        r2.run()
        assert_num_files(r2, 2)
        validate_metadata_after_change(r2, new_metadata)


class TestSqliteRunner(BaseTestRunner):
    pass
