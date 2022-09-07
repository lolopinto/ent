from auto_schema.diff import Diff
from auto_schema.change_type import ChangeType
import pytest

import sqlalchemy as sa
import alembic.operations.ops as alembicops

from . import conftest
from . import testingutils
from auto_schema import runner
from auto_schema import ops


class BaseTestRunner(object):

    @pytest.mark.usefixtures("empty_metadata")
    def test_compute_changes_with_empty_metadata(self, new_test_runner, empty_metadata):
        r = new_test_runner(empty_metadata)
        assert r.compute_changes() == []
        testingutils.assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_compute_changes_with_new_table(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        assert len(r.compute_changes()) == 1
        testingutils.assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_index_added_and_removed(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_table_with_index,
            "add index accounts_first_name_idx to accounts",
            "drop index accounts_first_name_idx from accounts",
            validate_schema=False
        )

    @pytest.mark.usefixtures("metadata_with_two_tables")
    def test_compute_changes_with_two_tables(self, new_test_runner, metadata_with_two_tables):
        r = new_test_runner(metadata_with_two_tables)
        assert len(r.compute_changes()) == 2
        testingutils.assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_foreign_key")
    def test_compute_changes_with_foreign_key_table(self, new_test_runner, metadata_with_foreign_key):
        r = new_test_runner(metadata_with_foreign_key)
        assert len(r.compute_changes()) == 2
        testingutils.assert_no_changes_made(r)

    @pytest.mark.usefixtures("metadata_with_foreign_key_to_same_table")
    def test_compute_changes_with_foreign_key_to_same_table(self, new_test_runner, metadata_with_foreign_key_to_same_table):
        r = new_test_runner(metadata_with_foreign_key_to_same_table)
        # same table so don't need a second change. this is where the extra checks we're seeing are coming from?
        assert len(r.compute_changes()) == 1
        testingutils.assert_no_changes_made(r)

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
        testingutils.assert_num_files(r, 1)
        testingutils.assert_num_tables(r, 0)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_revision_with_multi_step(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)

        r.revision()

        # 1 schema file should have been created
        testingutils.assert_num_files(r, 1)

        # upgrade the schema in between. let's do a cursory check that it works
        r.upgrade()

        # confirm that 2 tables were created
        testingutils.assert_num_tables(r, 2, ['accounts', 'alembic_version'])

        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.messages_table)

        r2.revision()

        # we should have a 2nd schema path
        testingutils.assert_num_files(r2, 2)

        # upgrade the schema and let's confirm it works
        r2.upgrade()

        # confirm that a 3rd table was created
        testingutils.assert_num_tables(
            r2, 3, ['accounts', 'alembic_version', 'messages'])

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_table_add(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_multi_column_index_added_and_removed(self, new_test_runner, metadata_with_table):
        def post_r2_func(r2):
            tables = [t for t in r2.get_metadata(
            ).sorted_tables if t.name == "accounts"]
            assert len(tables) == 1
            table = tables[0]

            assert len(table.indexes) == 1
            index = table.indexes.copy().pop()
            assert len(index.columns) == 2

        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_multi_column_index,
            "add index accounts_first_name_last_name_idx to accounts",
            "drop index accounts_first_name_last_name_idx from accounts",
            validate_schema=False,
            post_r2_func=post_r2_func
        )

    @pytest.mark.usefixtures("metadata_with_multi_column_pkey_constraint")
    def test_new_table_with_multi_column_pkey_constraint(self, new_test_runner, metadata_with_multi_column_pkey_constraint):
        r = new_test_runner(metadata_with_multi_column_pkey_constraint)
        testingutils.run_and_validate_with_standard_metadata_tables(
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
        testingutils.run_and_validate_with_standard_metadata_tables(
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

        r2 = testingutils.recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_contacts_table_with_no_unique_constraint(), r)
        message = r2.revision_message()
        assert message == "drop constraint contacts_unique_email_per_contact from contacts"

        r2.run()

        testingutils.assert_num_files(r2, 2)
        testingutils.assert_num_tables(r2, 2, ['alembic_version', 'contacts'])

    @pytest.mark.usefixtures("metadata_with_multi_column_fkey_constraint")
    def test_new_table_with_multi_column_fkey_constraint(self, new_test_runner, metadata_with_multi_column_fkey_constraint):
        r = new_test_runner(metadata_with_multi_column_fkey_constraint)
        testingutils.run_and_validate_with_standard_metadata_tables(
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

        r2 = testingutils.recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_multi_column_fkey_constraint_removed(), r)
        message = r2.revision_message()
        assert message == "drop constraint t2_fkey from t2"

        r2.run()

        testingutils.assert_num_files(r2, 2)
        testingutils.assert_num_tables(r2, 3, ['alembic_version', 't1', 't2'])

    # ideally we catch the expected error but this is the best we seem to be able to do do for now

    @pytest.mark.usefixtures("metadata_with_multi_column_fkey_constraint_no_constraint_reference_table")
    @pytest.mark.xfail()
    def test_new_table_with_invalid_multi_column_constraint(self, new_test_runner, metadata_with_multi_column_fkey_constraint_no_constraint_reference_table):
        r = new_test_runner(
            metadata_with_multi_column_fkey_constraint_no_constraint_reference_table)

        testingutils.run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multi_column_fkey_constraint_no_constraint_reference_table,
            new_table_names=['t1', 't2'],
        )

    @pytest.mark.usefixtures("metadata_with_column_check_constraint")
    def test_new_table_with_column_check_constraint(self, new_test_runner, metadata_with_column_check_constraint):
        r = new_test_runner(metadata_with_column_check_constraint)
        testingutils.run_and_validate_with_standard_metadata_tables(
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
        testingutils.run_and_validate_with_standard_metadata_tables(
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
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        # recreate runner with last runner
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.messages_table)
        r2.run()

        # should have the expected files with the expected tables
        testingutils.assert_num_files(r2, 2)
        testingutils.assert_num_tables(
            r2, 3, ['accounts', 'alembic_version', 'messages'])

        testingutils.validate_metadata_after_change(r2, metadata_with_table)

    @pytest.mark.usefixtures("metadata_with_two_tables")
    def test_multiple_tables_added(self, new_test_runner, metadata_with_two_tables):
        r = new_test_runner(metadata_with_two_tables)
        r.run()

        # should have the expected file with the expected tables
        # because 2 new tables added at the same time, only one schema file needed
        testingutils.assert_num_files(r, 1)
        testingutils.assert_num_tables(
            r, 3, ['accounts', 'alembic_version', 'messages'])

        testingutils.validate_metadata_after_change(
            r, metadata_with_two_tables)

    @pytest.mark.usefixtures("metadata_with_no_edges", "metadata_with_assoc_edge_config")
    def test_no_new_edges(self, new_test_runner, metadata_with_no_edges, metadata_with_assoc_edge_config):
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            '',
            metadata_with_assoc_edge_config,
            num_files=1,  # just the first file
            num_changes=0
        )

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_assoc_edge_config")
    def test_one_new_edge(self, new_test_runner, metadata_with_one_edge, metadata_with_assoc_edge_config):
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )

    @pytest.mark.usefixtures("metadata_with_symmetric_edge", "metadata_with_assoc_edge_config")
    def test_symmetric_edge(self, new_test_runner, metadata_with_symmetric_edge, metadata_with_assoc_edge_config):
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_symmetric_edge,
            "add edge UserToFriendsEdge",
            metadata_with_assoc_edge_config
        )

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_no_edges", "metadata_with_assoc_edge_config")
    def test_new_edge_then_remove(self, new_test_runner, metadata_with_one_edge, metadata_with_no_edges, metadata_with_assoc_edge_config):
        r = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )

        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            "remove edge UserToFollowersEdge",
            metadata_with_assoc_edge_config,
            num_files=3,
            prev_runner=r
        )

    @pytest.mark.usefixtures("metadata_with_inverse_edge", "metadata_with_assoc_edge_config")
    def test_inverse_edge_added_same_time(self, new_test_runner, metadata_with_inverse_edge, metadata_with_no_edges, metadata_with_assoc_edge_config):
        r = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "add edges UserToFolloweesEdge, UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )

        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            "remove edges UserToFolloweesEdge, UserToFollowersEdge",
            metadata_with_assoc_edge_config,
            prev_runner=r,
            num_files=3,
        )

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_inverse_edge", "metadata_with_no_edges", "metadata_with_assoc_edge_config")
    def test_inverse_edge_added_after(self, new_test_runner, metadata_with_one_edge, metadata_with_inverse_edge, metadata_with_no_edges, metadata_with_assoc_edge_config):
        r = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )
        # downgrade and upgrade once to confirm the downgrade path works
        r.downgrade('-1', delete_files=False)
        r.upgrade()

        # TODO need to change the rendered to only show the minimum
        # e.g. op.remove_edge(edge_type)

        r2 = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "add edge UserToFolloweesEdge\nmodify edge UserToFollowersEdge",
            metadata_with_assoc_edge_config,
            prev_runner=r,
            num_files=3,
            num_changes=2,
        )
        r2.downgrade('-1', delete_files=False)
        r2.upgrade()

        r3 = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_no_edges,
            "remove edges UserToFolloweesEdge, UserToFollowersEdge",
            metadata_with_assoc_edge_config,
            prev_runner=r2,
            num_files=4,
            num_changes=1,
        )
        r3.downgrade('-1', delete_files=False)
        r3.upgrade()

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_assoc_edge_config")
    def test_edge_in_db_modified(self, new_test_runner, metadata_with_one_edge, metadata_with_assoc_edge_config):
        r = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )
        conn = r.get_connection()
        conn.execute(
            "UPDATE assoc_edge_config SET edge_table = 'user_to_followers_edge_incorrect'")

        # validate edges fails because edges incorrect
        with pytest.raises(AssertionError):
            testingutils.validate_edges_from_metadata(
                metadata_with_one_edge, r)

        # edge is modified
        r2 = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "modify edge UserToFollowersEdge",
            metadata_with_assoc_edge_config,
            num_files=3,
            prev_runner=r,
            num_changes=1
        )

        # run again, nothing
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "",
            metadata_with_assoc_edge_config,
            num_files=3,
            prev_runner=r2,
            num_changes=0
        )

    @pytest.mark.usefixtures("metadata_with_inverse_edge", "metadata_with_assoc_edge_config")
    def test_multiple_edge_table_incorrect_and_modified(self, new_test_runner, metadata_with_inverse_edge, metadata_with_assoc_edge_config):
        r = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "add edges UserToFolloweesEdge, UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )
        conn = r.get_connection()
        conn.execute(
            "UPDATE assoc_edge_config SET edge_table = 'user_to_followers_edge_incorrect'")

        # validate edges fails because edges incorrect
        with pytest.raises(AssertionError):
            testingutils.validate_edges_from_metadata(
                metadata_with_inverse_edge, r)

        # edge is modified
        r2 = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "modify edge UserToFollowersEdge\nmodify edge UserToFolloweesEdge",
            metadata_with_assoc_edge_config,
            num_files=3,
            prev_runner=r,
            num_changes=2
        )

        # run again, nothing
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_inverse_edge,
            "",
            metadata_with_assoc_edge_config,
            num_files=3,
            prev_runner=r2,
            num_changes=0
        )

    @pytest.mark.usefixtures("metadata_with_nullable_fields")
    def test_new_table_with_nullable_fields(self, new_test_runner, metadata_with_nullable_fields):
        r = new_test_runner(metadata_with_nullable_fields)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_nullable_fields)

    @pytest.mark.usefixtures("metadata_with_foreign_key_to_same_table")
    def test_with_foreign_key_to_same_table(self, new_test_runner, metadata_with_foreign_key_to_same_table):
        r = new_test_runner(metadata_with_foreign_key_to_same_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_foreign_key_to_same_table, new_table_names=["assoc_edge_config"])

    @pytest.mark.usefixtures('metadata_with_request_data')
    def test_saving_data(self, new_test_runner, metadata_with_request_data):
        r = new_test_runner(metadata_with_request_data)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_request_data, new_table_names=["request_statuses"])

        testingutils.validate_data_from_metadata(metadata_with_request_data, r)

        new_metadata = conftest.metadata_with_row_removed(
            metadata_with_request_data)
        r2 = testingutils.new_runner_from_old(
            r, new_test_runner, new_metadata)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.RemoveRowsOp)

        assert r2.revision_message() == "remove row from request_statuses"

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)
        testingutils.validate_data_from_metadata(new_metadata, r2)

        new_metadata = conftest.metadata_with_rows_added(
            metadata_with_request_data)
        r3 = testingutils.new_runner_from_old(
            r, new_test_runner, new_metadata)

        diff = r3.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.AddRowsOp)
        assert r3.revision_message() == "add rows to request_statuses"

        r3.run()
        testingutils.assert_num_files(r3, 3)
        testingutils.validate_metadata_after_change(r3, new_metadata)
        testingutils.validate_data_from_metadata(new_metadata, r3)

    @pytest.mark.usefixtures('metadata_with_multiple_data_tables')
    def test_saving_complex_data(self, new_test_runner, metadata_with_multiple_data_tables):
        r = new_test_runner(metadata_with_multiple_data_tables)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_multiple_data_tables,
            # got 3 tables
            new_table_names=["request_statuses", "rainbows"]
        )

        # data is as expected
        testingutils.validate_data_from_metadata(
            metadata_with_multiple_data_tables, r)

        # update multiple objects so there's different values
        new_metadata = conftest.metadata_with_rainbows_enum_changed(
            metadata_with_multiple_data_tables)
        r2 = testingutils.new_runner_from_old(
            r, new_test_runner, new_metadata)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.ModifyRowsOp)
        assert r2.revision_message() == 'modify rows in rainbows'

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)
        testingutils.validate_data_from_metadata(new_metadata, r2)

    @pytest.mark.usefixtures('metadata_with_triple_pkey')
    def test_multiple_column_pkey(self, new_test_runner, metadata_with_triple_pkey):
        r = new_test_runner(metadata_with_triple_pkey)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r,
            metadata_with_triple_pkey,
            # got 3 tables
            new_table_names=["group_members", "roles"]
        )
        testingutils.validate_data_from_metadata(metadata_with_triple_pkey, r)

        # remove rows
        new_metadata = conftest.metadata_with_triple_pkey_with_rows_removed(
            metadata_with_triple_pkey)
        r2 = testingutils.new_runner_from_old(
            r, new_test_runner, new_metadata)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.RemoveRowsOp)
        assert r2.revision_message() == 'remove rows from group_members'

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)
        testingutils.validate_data_from_metadata(new_metadata, r2)

        # modify row
        new_metadata = conftest.metadata_with_triple_pkey_with_rows_changed(
            metadata_with_triple_pkey)
        r3 = testingutils.new_runner_from_old(
            r, new_test_runner, new_metadata)

        diff = r3.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.ModifyRowsOp)
        assert r3.revision_message() == 'modify rows in group_members'

        r3.run()
        testingutils.assert_num_files(r3, 3)
        testingutils.validate_metadata_after_change(r3, new_metadata)
        testingutils.validate_data_from_metadata(new_metadata, r3)

    @pytest.mark.usefixtures("table_with_timestamptz_plus_date")
    def test_table_with_timestamptz_plus_date(self, new_test_runner, table_with_timestamptz_plus_date):
        r = new_test_runner(table_with_timestamptz_plus_date)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r,
            table_with_timestamptz_plus_date,
        )
        testingutils.validate_data_from_metadata(
            table_with_timestamptz_plus_date, r)

    @pytest.mark.usefixtures("metadata_table_with_time")
    def test_table_with_time(self, new_test_runner, metadata_table_with_time):
        r = new_test_runner(metadata_table_with_time)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r,
            metadata_table_with_time,
            new_table_names=["hours"]
        )
        testingutils.validate_data_from_metadata(metadata_table_with_time, r)

    @pytest.mark.usefixtures("metadata_table_with_timetz")
    def test_table_with_timetz(self, new_test_runner, metadata_table_with_timetz):
        r = new_test_runner(metadata_table_with_timetz)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r,
            metadata_table_with_timetz,
            new_table_names=["hours"]
        )
        testingutils.validate_data_from_metadata(metadata_table_with_timetz, r)

    @pytest.mark.usefixtures("metadata_with_one_edge", "metadata_with_assoc_edge_config")
    def test_fix_edges(self, new_test_runner, metadata_with_one_edge, metadata_with_assoc_edge_config):
        r = testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "add edge UserToFollowersEdge",
            metadata_with_assoc_edge_config
        )

        # no changes when re-run
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "",
            metadata_with_assoc_edge_config,
            num_files=2,
            prev_runner=r,
            num_changes=0
        )

        # can re-run with same edges and nothing happens
        runner.Runner.fix_edges(metadata_with_one_edge, {
                                'connection': r.connection})

        conn = r.get_connection()
        conn.execute('delete from assoc_edge_config')

        # validate edges fails because edges incorrect
        with pytest.raises(AssertionError):
            testingutils.validate_edges_from_metadata(
                metadata_with_one_edge, r)

        # re-run again. it fixes
        runner.Runner.fix_edges(metadata_with_one_edge, {
                                'connection': r.connection})

        # no changes
        testingutils.run_edge_metadata_script(
            new_test_runner,
            metadata_with_one_edge,
            "",
            metadata_with_assoc_edge_config,
            num_files=2,
            prev_runner=r,
            num_changes=0
        )

    @pytest.mark.usefixtures("metadata_with_bigint")
    def test_tables_with_biginit(self, new_test_runner, metadata_with_bigint):
        r = new_test_runner(metadata_with_bigint)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_bigint, new_table_names=['tbl'])

    @pytest.mark.usefixtures("metadata_with_table")
    def test_drop_table_with_index(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_table_with_index)

        message = r2.revision_message()
        assert message == "add index accounts_first_name_idx to accounts"

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.assert_num_tables(r2, 2)

        # no tables
        new_metadata = sa.MetaData()
        r2 = testingutils.new_runner_from_old(
            r,
            new_test_runner,
            new_metadata
        )

        diff = r2.compute_changes()

        assert len(diff) == 2

        modify_table = [op for op in diff if isinstance(
            op, alembicops.ModifyTableOps)]
        drop_table = [op for op in diff if isinstance(
            op, alembicops.DropTableOp)]
        assert len(modify_table) == 1
        assert len(drop_table) == 1

        d = Diff(diff, group_by_table=False)
        assert d.list_changes() == [{
            'change': ChangeType.DROP_INDEX,
            "index": "accounts_first_name_idx",
            'desc': 'drop index accounts_first_name_idx from accounts',
        }, {
            'change': ChangeType.DROP_TABLE,
            'desc': 'drop accounts table',
        }]

        d2 = Diff(diff, group_by_table=True)
        assert d2.changes() == {
            'accounts': [{
                'change': ChangeType.DROP_INDEX,
                "index": "accounts_first_name_idx",
                'desc': 'drop index accounts_first_name_idx from accounts',
            }, {
                'change': ChangeType.DROP_TABLE,
                'desc': 'drop accounts table',
            }]
        }

        r2.run()
        testingutils.assert_num_files(r2, 3)
        testingutils.validate_metadata_after_change(r2, new_metadata)


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
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        # recreate runner with last path and modified metadata
        new_metadata_func(metadata_with_table)
        r2 = new_test_runner(metadata_with_table, r)

        diff = r2.compute_changes()

        assert len(diff) == 1

        assert r2.revision_message() == expected_message

        r2.run()

        testingutils.validate_metadata_after_change(r2, metadata_with_table)

    @pytest.mark.usefixtures("address_metadata_table")
    def test_server_default_no_change_string(self, new_test_runner, address_metadata_table):
        r = new_test_runner(address_metadata_table)

        testingutils.run_and_validate_with_standard_metadata_tables(
            r, address_metadata_table, ['addresses'])

        conftest.identity_metadata_func(address_metadata_table)

        r2 = new_test_runner(address_metadata_table, r)
        diff = r2.compute_changes()

        # nothing changed, we should have no changes
        assert len(diff) == 0

    @pytest.mark.usefixtures("address_metadata_table")
    def test_server_default_change_string(self, new_test_runner, address_metadata_table):
        r = new_test_runner(address_metadata_table)

        testingutils.run_and_validate_with_standard_metadata_tables(
            r, address_metadata_table, ['addresses'])

        conftest.metadata_with_server_default_changed_string(
            address_metadata_table)

        r2 = new_test_runner(address_metadata_table, r)
        diff = r2.compute_changes()

        assert len(diff) == 1

        assert r2.revision_message() == "modify server_default value of column country from US to UK"
        r2.run()

        testingutils.validate_metadata_after_change(r2, address_metadata_table)

    @pytest.mark.usefixtures("address_metadata_table")
    def test_server_default_dropped(self, new_test_runner, address_metadata_table):
        r = new_test_runner(address_metadata_table)

        testingutils.run_and_validate_with_standard_metadata_tables(
            r, address_metadata_table, ['addresses'])

        conftest.metadata_with_server_default_dropped(
            address_metadata_table)

        r2 = new_test_runner(address_metadata_table, r)
        diff = r2.compute_changes()

        assert len(diff) == 1

        assert r2.revision_message(
        ) == "modify server_default value of column country from US to None"
        r2.run()

        testingutils.validate_metadata_after_change(r2, address_metadata_table)

    # only in postgres because "No support for ALTER of constraints in SQLite dialect"

    @pytest.mark.usefixtures("metadata_with_table")
    def test_unique_constraint_added(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_unique_constraint_added)

        message = r2.revision_message()
        assert message == "add unique constraint accounts_unique_email_address"

        r2.run()

        # should have the expected files with the expected tables
        testingutils.assert_num_files(r2, 2)
        testingutils.assert_num_tables(r2, 2, ['accounts', 'alembic_version'])
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_table")
    def test_check_constraint_added_and_removed(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_constraint_added_after,
            "add constraint meaning_of_life_correct to accounts",
            "drop constraint meaning_of_life_correct from accounts"
        )

    @pytest.mark.usefixtures('metadata_with_enum_type')
    def test_enum_type(self, new_test_runner, metadata_with_enum_type):
        r = new_test_runner(metadata_with_enum_type)
        testingutils.run_and_validate_with_standard_metadata_tables(
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
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

        new_metadata_func(metadata_with_enum_type)
        r2 = new_test_runner(metadata_with_enum_type, r)

        diff = r2.compute_changes()

        assert len(diff) == expected_diff

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(
            r2, metadata_with_enum_type)

    @pytest.mark.usefixtures("metadata_with_enum_type")
    def test_remove_enum_value(self, new_test_runner, metadata_with_enum_type):
        r = new_test_runner(metadata_with_enum_type)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

        conftest.metadata_with_removed_enum_value(metadata_with_enum_type)
        r2 = new_test_runner(metadata_with_enum_type, r)

        with pytest.raises(ValueError, match="postgres doesn't support enum removals"):
            r2.compute_changes()

    @pytest.mark.usefixtures("metadata_with_table")
    def test_remove_column(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        new_metadata = conftest.metadata_with_removed_column()
        r2 = testingutils.new_runner_from_old(
            r, new_test_runner, new_metadata)

        diff = r2.compute_changes()

        exp_message = 'drop column meaning_of_life from table accounts'
        assert r2.revision_message() == exp_message
        assert len(diff) == 1

        d = Diff(diff)
        changes = d.changes()
        assert len(changes) == 1
        l = changes.get('accounts')
        exp_change = {
            'change': ChangeType.DROP_COLUMN,
            'desc': exp_message,
            'col': 'meaning_of_life',
        }
        assert len(l) == 1
        assert l[0] == exp_change
        d2 = Diff(diff, group_by_table=False)
        assert d2.list_changes() == [exp_change]

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_add_multiple_cols(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        r2 = testingutils.new_runner_from_old(r, new_test_runner, conftest.metadata_with_cols_added_to_table(
            metadata_with_table))

        diff = r2.compute_changes()

        d = Diff(diff)
        changes = d.changes()
        assert len(changes) == 1
        l = changes.get('accounts')
        assert len(l) == 2
        for change in l:
            assert change['change'] == ChangeType.ADD_COLUMN
            assert change['col'] in ['new_column', 'rainbow']

    @pytest.mark.usefixtures("metadata_with_table")
    def test_new_enum_column_added_then_removed(self, new_test_runner, metadata_with_table):
        r = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        # add column with enum
        new_metadata = conftest.metadata_with_new_enum_column()
        r2 = testingutils.new_runner_from_old(
            r,
            new_test_runner,
            new_metadata
        )

        diff = r2.compute_changes()

        assert len(diff) == 2

        d = Diff(diff)
        changes = d.changes()
        assert len(changes) == 2
        l = changes.get('accounts')
        assert len(l) == 1
        assert l[0] == {
            'change': ChangeType.ADD_COLUMN,
            'desc': 'add column rainbow to table accounts',
            'col': 'rainbow',
        }

        l2 = changes.get('enum_schema')
        assert len(l2) == 1
        assert l2[0] == {
            'change': ChangeType.ADD_ENUM,
            'desc': 'add enum rainbow_type',
        }

        add_enum = [op for op in diff if isinstance(op, ops.AddEnumOp)]
        modify_table_ops = [op for op in diff if isinstance(
            op, alembicops.ModifyTableOps)]
        assert len(add_enum) == 1
        assert len(modify_table_ops) == 1

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)

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
        testingutils.assert_num_files(r3, 3)
        testingutils.validate_metadata_after_change(r3, metadata_with_table)

    @pytest.mark.usefixtures("metadata_with_enum_type")
    def test_drop_table_with_enum(self, new_test_runner, metadata_with_enum_type):
        r = new_test_runner(metadata_with_enum_type)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_enum_type)

        # no tables
        new_metadata = sa.MetaData()
        r2 = testingutils.new_runner_from_old(
            r,
            new_test_runner,
            new_metadata
        )

        diff = r2.compute_changes()

        assert len(diff) == 2

        drop_enum = [op for op in diff if isinstance(op, ops.DropEnumOp)]
        drop_table = [op for op in diff if isinstance(
            op, alembicops.DropTableOp)]
        assert len(drop_enum) == 1
        assert len(drop_table) == 1

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)

    @pytest.mark.usefixtures("metadata_with_arrays")
    def test_tables_with_arrays(self, new_test_runner, metadata_with_arrays):
        r = new_test_runner(metadata_with_arrays)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_arrays, new_table_names=['tbl'])

    @pytest.mark.usefixtures("metadata_with_arrays")
    def test_change_array_index_type_explicit(self, new_test_runner, metadata_with_arrays):
        r = new_test_runner(metadata_with_arrays)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_arrays, new_table_names=['tbl'])

        t = r.get_metadata().tables.get('tbl')
        indexes = {
            index.name: index for index in t.indexes}

        index = indexes.get('tbl_float_list_idx')
        assert index.kwargs.get('postgresql_using') == 'btree'
        index.kwargs['postgresql_using'] = 'gin'
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_arrays, lambda _: t)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], alembicops.ModifyTableOps)
        modify_op = diff[0]
        assert len(modify_op.ops) == 2
        # we drop and recreate index
        assert isinstance(modify_op.ops[0], alembicops.DropIndexOp)
        assert isinstance(modify_op.ops[1], alembicops.CreateIndexOp)

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_arrays")
    def test_change_array_index_type_no_explicit(self, new_test_runner, metadata_with_arrays):
        r = new_test_runner(metadata_with_arrays)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_arrays, new_table_names=['tbl'])

        t = r.get_metadata().tables.get('tbl')
        indexes = {
            index.name: index for index in t.indexes}

        index = indexes.get('tbl_date_list_idx')
        assert index.kwargs.get('postgresql_using') == False
        index.kwargs['postgresql_using'] = 'gin'
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_arrays, lambda _: t)

        diff = r2.compute_changes()
        assert len(diff) == 1
        r2.run()
        assert isinstance(diff[0], alembicops.ModifyTableOps)
        modify_op = diff[0]
        assert len(modify_op.ops) == 2
        # we drop and recreate index
        assert isinstance(modify_op.ops[0], alembicops.DropIndexOp)
        assert isinstance(modify_op.ops[1], alembicops.CreateIndexOp)

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_arrays")
    def test_change_array_index_type_implicit_explicit_btree(self, new_test_runner, metadata_with_arrays):
        r = new_test_runner(metadata_with_arrays)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_arrays, new_table_names=['tbl'])

        t = r.get_metadata().tables.get('tbl')
        indexes = {
            index.name: index for index in t.indexes}

        index = indexes.get('tbl_date_list_idx')
        assert index.kwargs.get('postgresql_using') == False
        index.kwargs['postgresql_using'] = 'btree'
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_arrays, lambda _: t)

        diff = r2.compute_changes()
        assert len(diff) == 0

        r2.run()
        testingutils.assert_num_files(r2, 1)
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_json")
    def test_tables_with_json(self, new_test_runner, metadata_with_json):
        r = new_test_runner(metadata_with_json)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_json, new_table_names=['tbl'])

    @pytest.mark.usefixtures("metadata_with_json")
    def test_change_jsonb_index_type_explicit(self, new_test_runner, metadata_with_json):
        r = new_test_runner(metadata_with_json)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_json, new_table_names=['tbl'])

        t = r.get_metadata().tables.get('tbl')
        indexes = {
            index.name: index for index in t.indexes}

        index = indexes.get('tbl_nullable_jsonb_idx')
        assert index.kwargs.get('postgresql_using') == 'btree'
        index.kwargs['postgresql_using'] = 'gin'
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_json, lambda _: t)

        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], alembicops.ModifyTableOps)
        modify_op = diff[0]
        assert len(modify_op.ops) == 2
        # we drop and recreate index
        assert isinstance(modify_op.ops[0], alembicops.DropIndexOp)
        assert isinstance(modify_op.ops[1], alembicops.CreateIndexOp)

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_json")
    def test_change_jsonb_index_type_no_explicit(self, new_test_runner, metadata_with_json):
        r = new_test_runner(metadata_with_json)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_json, new_table_names=['tbl'])

        t = r.get_metadata().tables.get('tbl')
        indexes = {
            index.name: index for index in t.indexes}

        index = indexes.get('tbl_default_jsonb_idx')
        assert index.kwargs.get('postgresql_using') == False
        index.kwargs['postgresql_using'] = 'gin'
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_json, lambda _: t)

        diff = r2.compute_changes()
        assert len(diff) == 1
        r2.run()
        assert isinstance(diff[0], alembicops.ModifyTableOps)
        modify_op = diff[0]
        assert len(modify_op.ops) == 2
        # we drop and recreate index
        assert isinstance(modify_op.ops[0], alembicops.DropIndexOp)
        assert isinstance(modify_op.ops[1], alembicops.CreateIndexOp)

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_json")
    def test_change_jsonb_index_type_implicit_explicit_btree(self, new_test_runner, metadata_with_json):
        r = new_test_runner(metadata_with_json)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_json, new_table_names=['tbl'])

        t = r.get_metadata().tables.get('tbl')
        indexes = {
            index.name: index for index in t.indexes}

        index = indexes.get('tbl_default_jsonb_idx')
        assert index.kwargs.get('postgresql_using') == False
        index.kwargs['postgresql_using'] = 'btree'
        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_json, lambda _: t)

        diff = r2.compute_changes()
        assert len(diff) == 0

        r2.run()
        testingutils.assert_num_files(r2, 1)
        testingutils.validate_metadata_after_change(r2, r2.get_metadata())

    @pytest.mark.usefixtures("metadata_with_table")
    def test_full_text_index_added_and_removed(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_fulltext_search_index,
            "add full text index accounts_first_name_idx to accounts",
            "drop full text index accounts_first_name_idx from accounts",
            # skip validation because of complications with idx
            validate_schema=False
        )

    @pytest.mark.usefixtures("metadata_with_multicolumn_fulltext_search")
    # TODO this is failed because of index comparisons
    # this doesn't work because indexes are wrong. why we have validate false in
    # make_changes_and_restore
    @pytest.mark.xfail()
    def test_multi_col_full_text_create(self, new_test_runner, metadata_with_multicolumn_fulltext_search):
        r = new_test_runner(
            metadata_with_multicolumn_fulltext_search)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_multicolumn_fulltext_search)

    @pytest.mark.usefixtures("metadata_with_table")
    def test_multi_col_full_text_index_added_and_removed(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_multicolumn_fulltext_search_index,
            "add full text index accounts_full_text_idx to accounts",
            "drop full text index accounts_full_text_idx from accounts",
            # skip validation because of complications with idx
            validate_schema=False
        )

    @pytest.mark.usefixtures("metadata_with_table")
    @pytest.mark.xfail()
    # not sure why this fails for gist but not gin|btree
    # TODO https://github.com/lolopinto/ent/issues/848
    def test_multi_col_full_text_index_added_and_removed_gist(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_multicolumn_fulltext_search_index_gist,
            "add full text index accounts_full_text_idx to accounts",
            "drop full text index accounts_full_text_idx from accounts",
            # skip validation because of complications with idx
            validate_schema=False
        )

    @pytest.mark.usefixtures("metadata_with_table")
    def test_multi_col_full_text_index_added_and_removed_btree(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_multicolumn_fulltext_search_index_btree,
            "add full text index accounts_full_text_idx to accounts",
            "drop full text index accounts_full_text_idx from accounts",
            # skip validation because of complications with idx
            validate_schema=False
        )

    @pytest.mark.usefixtures("metadata_with_table")
    def test_full_text_index_with_generated_column(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_generated_col_fulltext_search_index,
            "add column full_name to table accounts\nadd index accounts_full_text_idx to accounts",
            "drop index accounts_full_text_idx from accounts\ndrop column full_name from table accounts",
            # skip validation because of complications with idx
            validate_schema=False
        )

    @pytest.mark.usefixtures("metadata_with_table")
    def test_full_text_index_with_generated_column_gist(self, new_test_runner, metadata_with_table):
        testingutils.make_changes_and_restore(
            new_test_runner,
            metadata_with_table,
            conftest.metadata_with_generated_col_fulltext_search_index_gist,
            "add column full_name to table accounts\nadd index accounts_full_text_idx to accounts",
            "drop index accounts_full_text_idx from accounts\ndrop column full_name from table accounts",
            # skip validation because of complications with idx
            validate_schema=False
        )


class TestSqliteRunner(BaseTestRunner):
    pass
