from alembic import command
import alembic
from alembic.util.exc import CommandError
import alembic.operations.ops as alembicops
from auto_schema import runner
from sqlalchemy.sql.sqltypes import String
import pytest
import sqlalchemy as sa

from . import conftest
from . import testingutils
from typing import List
import os


# there doesn't seem to be an api for this
def get_stamped_alembic_versions(r: runner.Runner):
    return [row['version_num'] for row in r.get_connection().execute('select * from alembic_version')]


def stash_new_files(r: runner.Runner, l: List[String], l2: List[String]):
    ret = {}

    for path in l2:
        if path not in l:
            file = os.path.join(r.get_schema_path(), 'versions', path)
            with open(file) as f:
                ret[file] = f.readlines()
            os.remove(file)
    return ret


def write_stashed_files(stash):
    for file in stash:
        with open(file, 'w') as w:
            w.writelines(stash[file])


def _add_column_to_metadata(metadata: sa.MetaData, col_name: String):
    return _add_columns_to_metadata(metadata, [col_name])


def _add_columns_to_metadata(metadata: sa.MetaData, col_names: List[String]):
    if len(testingutils.get_sorted_tables(metadata)) != 1:
        raise ValueError("only support one table at the moment")

    return conftest.metadata_with_given_cols_added_to_table(
        metadata,
        [sa.Column(col_name, sa.Integer, nullable=True)
         for col_name in col_names],
    )


def _validate_column_added(r: runner.Runner, col_name: String):
    diff = r.compute_changes()
    assert len(diff) == 1
    modify_table_ops = [op for op in diff if isinstance(
        op, alembicops.ModifyTableOps)]
    assert len(modify_table_ops) == 1
    modify_table = modify_table_ops[0]
    assert len(modify_table.ops) == 1
    op = modify_table.ops[0]
    assert isinstance(op, alembicops.AddColumnOp)
    assert op.column.name == col_name


# adds a table then adds 2 new columns in separate source control "branches"
def _create_parallel_changes(new_test_runner, metadata_with_table):
    r: runner.Runner = new_test_runner(metadata_with_table)
    testingutils.run_and_validate_with_standard_metadata_tables(
        r, metadata_with_table)

    assert len(r.cmd.get_heads()) == 1

    files = testingutils.get_version_files(r)
    assert len(files) == 1
    revs = r.cmd.get_revisions('heads')
    assert len(revs) == 1
    rev1 = revs[0]
    assert rev1.down_revision == None

    r2 = testingutils.new_runner_from_old(
        r,
        new_test_runner,
        _add_column_to_metadata(metadata_with_table, 'new_col1'),
    )
    r2.revision()
    files2 = testingutils.get_version_files(r2)
    assert len(files2) == 2

    assert len(r2.cmd.get_heads()) == 1

    _validate_column_added(r, 'new_col1')
    revs = r.cmd.get_revisions('heads')
    assert len(revs) == 1
    rev2 = revs[0]
    assert rev2.down_revision == rev1.revision

    stashed = stash_new_files(r, files, files2)

    r3 = testingutils.new_runner_from_old(
        r,
        new_test_runner,
        _add_column_to_metadata(metadata_with_table, 'new_col2'),
    )

    r3.revision()

    files3 = testingutils.get_version_files(r3)
    assert len(files3) == 2

    write_stashed_files(stashed)

    files3b = testingutils.get_version_files(r3)
    assert len(files3b) == 3

    assert len(r3.cmd.get_heads()) == 2

    _validate_column_added(r, 'new_col2')
    revs = r.cmd.get_revisions('heads')
    rev2_revs = [rev for rev in revs if rev.revision == rev2.revision]
    assert len(rev2_revs) == 1
    rev3_revs = [rev for rev in revs if rev.revision != rev2.revision]
    assert len(rev3_revs) == 1
    rev3 = rev3_revs[0]
    assert rev3.down_revision == rev1.revision

    # multiple heads, trying to use alembic upgrade on its own causes leads to an error
    with pytest.raises(CommandError):
        command.upgrade(r3.cmd.alembic_cfg, 'head')

    assert len(r3.compute_changes()) > 0

    # sucessfully upgrade
    r3.upgrade('heads')

    files3c = testingutils.get_version_files(r3)

    assert len(r3.cmd.get_heads()) == 2

    # no new file created
    assert len(files3c) == 3

    # reflect to reload
    r3.metadata.reflect()

    return {
        # most-recent runner
        'runner': r3,
        # revision after adding table
        'rev1': rev1,
        # revision after adding one column on base
        'rev2': rev2,
        # revision after adding 2nd column on base
        'rev3': rev3,
    }


class CommandTest(object):

    @ pytest.mark.usefixtures("metadata_with_table")
    @ pytest.mark.parametrize(
        'migrate_rev, delete_files, new_file_count, expected_current_head',
        [
            # migrate down 1, delete files, 2 files left, current head is the 1st in history
            ('-1', True, 2, 1),
            # migrate down 1, don't delete files, 3 files left, current head is the 1st in history
            ('-1', False, 3, 1),
            # migrate to base, delete files, no files left, no current head
            ('base', True, 0, None),
            # migrate to base, don't delete files, 3 files left, no current head
            ('base', False, 3, None),
            # migrate down with specific rev given, delete files, 2 files left, current head is the 1st in history
            (0, True, 2, 1),
            # migrate down with specific rev given, delete files, 3 files left, current head is the 1st in history
            (0, False, 3, 1),
            # migrate down with specific rev given, delete files, 1 files left, current head is the 2nd in history
            (1, True, 1, 2),
            # migrate down with specific rev given, delete files, 3 files left, current head is the 2nd in history
            (1, False, 3, 2),
        ]
    )
    def test_linear_downgrade(self, new_test_runner, metadata_with_table, migrate_rev, delete_files, new_file_count, expected_current_head):
        r: runner.Runner = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        r2 = testingutils.recreate_with_new_metadata(
            r, new_test_runner, metadata_with_table, conftest.metadata_with_table_with_index)

        message = r2.revision_message()
        assert message == "add index accounts_first_name_idx to accounts"

        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.assert_num_tables(r2, 2)

        r3 = testingutils.recreate_metadata_fixture(
            new_test_runner, conftest.metadata_with_base_table_restored(), r2)

        message = r3.revision_message()
        assert message == "drop index accounts_first_name_idx from accounts"

        r3.run()
        testingutils.assert_num_files(r3, 3)
        testingutils.assert_num_tables(r3, 2)

        history = r3.cmd.get_history()
        assert len(history) == 3
        assert len(testingutils.get_version_files(r3)) == 3

        current_versions = get_stamped_alembic_versions(r3)
        assert len(current_versions) == 1
        assert history[0].revision == current_versions[0]

        # migrate down to down revision
        if isinstance(migrate_rev, int):
            migrate_rev = history[migrate_rev].down_revision

        # downgrade and delete files
        r3.downgrade(migrate_rev, delete_files)
        assert len(testingutils.get_version_files(r3)) == new_file_count

        current_versions = get_stamped_alembic_versions(r3)
        if expected_current_head == None:
            assert len(current_versions) == 0
        else:
            assert len(current_versions) == 1
            assert current_versions[0] == history[expected_current_head].revision

    @ pytest.mark.usefixtures("metadata_with_table")
    @ pytest.mark.parametrize(
        'migrate_col1_path, delete_files',
        [
            # migrate down 1st one, delete_files
            (True, True),
            # migrate down 1st, don't delete_files
            (True, False),
            # # migrate down 2nd one, delete_files
            (False, True),
            # # migrate down 2nd one, don't delete_files
            (False, False),
        ]
    )
    def test_downgrade_partial(self, new_test_runner, metadata_with_table, migrate_col1_path, delete_files):
        ret = _create_parallel_changes(new_test_runner, metadata_with_table)
        r = ret.setdefault('runner', None)
        rev1 = ret.setdefault('rev1', None)
        rev2 = ret.setdefault('rev2', None)
        rev3 = ret.setdefault('rev3', None)

        exp_file_count = 3
        assert len(testingutils.get_version_files(r)) == exp_file_count

        # https://gerrit.sqlalchemy.org/c/sqlalchemy/alembic/+/2530
        down_rev = ''
        stamped_version = ''
        if migrate_col1_path:
            down_rev = '%s@%s' % (rev2.revision, rev1.revision)
            stamped_version = rev3.revision
        else:
            down_rev = '%s@%s' % (rev3.revision, rev1.revision)
            stamped_version = rev2.revision

        r.downgrade(down_rev, delete_files)

        if delete_files:
            exp_file_count = 2

        assert len(testingutils.get_version_files(r)) == exp_file_count

        current_versions = get_stamped_alembic_versions(r)
        assert len(current_versions) == 1
        assert current_versions[0] == stamped_version

    @ pytest.mark.usefixtures("metadata_with_table")
    def test_upgrade(self, new_test_runner, metadata_with_table):
        ret = _create_parallel_changes(new_test_runner, metadata_with_table)
        r3 = ret.setdefault('runner', None)
        rev2 = ret.setdefault('rev2', None)
        rev3 = ret.setdefault('rev3', None)

        r4 = testingutils.new_runner_from_old(
            r3,
            new_test_runner,
            # 1 and 2 already there, really only adding 3
            _add_columns_to_metadata(
                r3.metadata, ['new_col1', 'new_col2', 'new_col3']),
        )

        r4.revision()
        files4 = testingutils.get_version_files(r4)
        assert len(files4) == 4

        _validate_column_added(r4, 'new_col3')
        revs = r4.cmd.get_revisions('heads')
        assert len(revs) == 1
        rev4 = revs[0]
        assert len(rev4.down_revision) == 2
        down_revs = rev4.down_revision
        # rev 2 and 3 revs are the down_revision
        assert len([rev for rev in down_revs if rev == rev2.revision]) == 1
        assert len([rev for rev in down_revs if rev == rev3.revision]) == 1
        r4.run()

    @ pytest.mark.usefixtures("metadata_with_table")
    @ pytest.mark.parametrize(
        'squash_val, files_left, squash_raises',
        [
            (2, 2, False),
            (3, 1, False),
            (1, 3, True),
        ]
    )
    def test_squash(self, new_test_runner, metadata_with_table, squash_val, files_left, squash_raises):
        r: runner.Runner = new_test_runner(metadata_with_table)
        testingutils.run_and_validate_with_standard_metadata_tables(
            r, metadata_with_table)

        new_metadata = _add_column_to_metadata(metadata_with_table, 'new_col1')
        r2 = testingutils.new_runner_from_old(
            r,
            new_test_runner,
            new_metadata
        )
        r2.run()
        testingutils.assert_num_files(r2, 2)
        testingutils.validate_metadata_after_change(r2, new_metadata)

        new_metadata = _add_columns_to_metadata(
            metadata_with_table, ['new_col1', 'new_col2'])
        r3 = testingutils.new_runner_from_old(
            r2,
            new_test_runner,
            new_metadata
        )
        r3.run()
        testingutils.assert_num_files(r3, 3)
        testingutils.validate_metadata_after_change(r3, new_metadata)

        r3.metadata.reflect()
        if squash_raises:
            with pytest.raises(ValueError):
                r3.squash(squash_val)
        else:
            r3.squash(squash_val)

        # should be squashed down to X files after change
        testingutils.assert_num_files(r3, files_left)
        r3.metadata.reflect()
        testingutils.validate_metadata_after_change(r3, new_metadata)


class TestPostgresCommand(CommandTest):
    pass


# class TestSQLiteCommand(CommandTest):
#     pass
