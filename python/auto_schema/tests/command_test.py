from alembic.command import history
from auto_schema import runner
import pytest

from . import conftest
from . import testingutils


# there doesn't seem to be an api for this
def get_stamped_alembic_versions(r: runner.Runner):
    return [row['version_num'] for row in r.get_connection().execute('select * from alembic_version')]


class TestCommand(object):

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
    def test_downgrade(self, new_test_runner, metadata_with_table, migrate_rev, delete_files, new_file_count, expected_current_head):
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
