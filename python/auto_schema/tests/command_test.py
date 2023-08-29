from alembic import command
import alembic
from alembic.util.exc import CommandError
import alembic.operations.ops as alembicops
from auto_schema import runner
from auto_schema.change_type import ChangeType
from sqlalchemy.sql.sqltypes import String
import pytest
import sqlalchemy as sa

from . import conftest
from . import testingutils
from typing import List
import os


# there doesn't seem to be an api for this
def get_stamped_alembic_versions(r: runner.Runner):
    return [row._asdict()['version_num'] for row in r.get_connection().execute(sa.text('select * from alembic_version'))]


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
    r3.metadata.reflect(bind=r3.get_connection())

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
    def test_squash_n(self, new_test_runner, metadata_with_table, squash_val, files_left, squash_raises):
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

        r3.metadata.reflect(bind=r3.get_connection())
        if squash_raises:
            with pytest.raises(ValueError):
                r3.squash(squash_val)
        else:
            r3.squash(squash_val)

        # should be squashed down to X files after change
        testingutils.assert_num_files(r3, files_left)
        r3.metadata.reflect(bind=r3.get_connection())
        testingutils.validate_metadata_after_change(r3, new_metadata)

    @ pytest.mark.parametrize(
        'include, exclude, squash_raises',
        [
            # exclude is true so anything that flags as should be excluded will be excluded in squash when exclude is True
            (False, True, None), 
            # include and make sure we throw by including something that will cause an error because the table doesn't exist anymore
            (True, False, 'relation "contacts" does not exist'), 
            # if we include, there should be no error since events trigger is included
            (True, False, None),
            # no include or exclude, we throw 
            (False, False, 'relation "contacts" does not exist')
        ]

    ) 
    def test_squash_all(self, new_test_runner, include, exclude, squash_raises):
        def add_table(table_name, metadata):
            sa.Table(
                table_name, 
                metadata, 
                sa.Column('id', sa.Integer, primary_key=True),
                sa.Column('name', sa.String(255), nullable=False),
                sa.PrimaryKeyConstraint('id', name = '%s_pkey' % table_name),
            )
            
        def add_column(table_name, column_name, metadata):
            sa.Table(
                table_name, 
                metadata, 
                sa.Column(column_name, sa.String(255), nullable=False),
                extend_existing=True,
            )
        
        def add_nullable_column(table_name, column_name, metadata):
            sa.Table(
                table_name, 
                metadata, 
                sa.Column(column_name, sa.String(255), nullable=True),
                extend_existing=True,
            )
            
        def add_nullable_column(table_name, column_name, metadata):
            sa.Table(
                table_name, 
                metadata, 
                sa.Column(column_name, sa.String(255), nullable=True),
                extend_existing=True,
            )
            
        def drop_column(table_name, column_name, metadata):
            cols = [col.name for col in metadata.tables[table_name].columns if col.name != column_name]
            
            # eureka! how to drop columns            
            sa.Table(table_name, metadata, extend_existing=True, include_columns=cols)
            
        def drop_table(table_name, metadata):
            metadata.remove(metadata.tables[table_name])
            
        def custom_sql_without_contacts(include, exclude, squash_raises, c):
            if exclude and not squash_raises:
                c["exclude_if_excluding"] = True
                return

            if include and squash_raises:
                c["include_if_including"] = True
                return
        
        def custom_sql_with_events(include, exclude, squash_raises, c):
            if include:
                c["include_if_including"] = True

        changes = [
            {
                "change": ChangeType.ADD_TABLE,
                "metadata_lambda": lambda metadata: add_table('accounts', metadata),
                "tables": ['accounts'],
            },
            {
                "change": ChangeType.ADD_COLUMN,
                "metadata_lambda": lambda metadata: add_column('accounts', 'bio', metadata),
                "tables": ['accounts'],
            },
            {
                "change": ChangeType.ADD_TABLE,
                "metadata_lambda": lambda metadata: add_table('contacts', metadata),
                "tables": ['accounts', 'contacts'],
            },
            {
                "change": ChangeType.ADD_COLUMN,
                "metadata_lambda": lambda metadata: add_nullable_column('contacts', 'email_address', metadata),
                "tables": ['accounts', 'contacts'],
            },
            {
                "change": ChangeType.DROP_COLUMN,
                "metadata_lambda": lambda metadata: drop_column('contacts', 'email_address', metadata),
                "tables": ['accounts', 'contacts'],
            },
            {
                "change": ChangeType.EXECUTE_SQL,
                "tables": ['accounts', 'contacts'],
                # nothing 
                "runner_lambda": lambda r: testingutils.create_custom_revision(
                    r,
                    "custom change",
                    len(testingutils.get_version_files(r)) + 1,
                    """op.execute_sql(\"""CREATE OR REPLACE FUNCTION contacts_name_change()
RETURNS trigger AS
$$
BEGIN
  IF (NEW.name <> OLD.name) THEN
    PERFORM pg_notify('contact_name_change', row_to_json(NEW)::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';
 
CREATE OR REPLACE TRIGGER contacts_name_change_trigger BEFORE UPDATE 
       ON contacts
       FOR EACH ROW EXECUTE PROCEDURE contacts_name_change();\""")""",
                    """op.execute_sql("DROP TRIGGER IF EXISTS contacts_name_change_trigger ON contacts")
    op.execute_sql("DROP FUNCTION IF EXISTS contacts_name_change")""",
                ),
                "dynamic_lambda": lambda include, exclude, squash_raises, c:  custom_sql_without_contacts(include, exclude, squash_raises, c),
            },
            {
                "change": ChangeType.DROP_TABLE,
                "desc": "drop table contacts",
                "metadata_lambda": lambda metadata: drop_table('contacts', metadata),
                "tables": ['accounts'],
            },
            {
                "change": ChangeType.ADD_TABLE,
                "metadata_lambda": lambda metadata: add_table('events', metadata),
                "tables": ['accounts', 'events'],
            },
            {
                "change": ChangeType.EXECUTE_SQL,
                "tables": ['accounts', 'events'],
                "runner_lambda": lambda r: testingutils.create_custom_revision(
                    r,
                    "custom change",
                    len(testingutils.get_version_files(r)) + 1,
                    """op.execute_sql(\"""CREATE OR REPLACE FUNCTION events_name_change()
RETURNS trigger AS
$$
BEGIN
  IF (NEW.name <> OLD.name) THEN
    PERFORM pg_notify('event_name_change', row_to_json(NEW)::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';
 
CREATE OR REPLACE TRIGGER events_name_change_trigger BEFORE UPDATE 
       ON events
       FOR EACH ROW EXECUTE PROCEDURE events_name_change();\""")""",
                    """op.execute_sql("DROP TRIGGER IF EXISTS events_name_change_trigger ON events")
    op.execute_sql("DROP FUNCTION IF EXISTS events_name_change")""",
                ),
                "dynamic_lambda": lambda include, exclude, squash_raises, c:  custom_sql_with_events(include, exclude, squash_raises, c),
            },
            {
                "change": ChangeType.EXECUTE_SQL,
                "tables": ['accounts', 'events'],
                "runner_lambda": lambda r: testingutils.create_custom_revision(
                    r,
                    "custom change",
                    len(testingutils.get_version_files(r)) + 1,
                    """op.execute_sql("CREATE TYPE rainbow as ENUM ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')")""",
                    """op.execute_sql("DROP TYPE rainbow")""",
                ),
                "validate_lambda": lambda r: testingutils.get_enums(r) == ["rainbow"]
            },
            {
                "change": ChangeType.EXECUTE_SQL,
                "tables": ['accounts', 'events'],
                "runner_lambda": lambda r: testingutils.create_custom_revision(
                    r,
                    "custom change again",
                    len(testingutils.get_version_files(r)) + 1,
                    """op.execute_sql("DROP TYPE rainbow")""",
                    """op.execute_sql("CREATE TYPE rainbow as ENUM ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')")""",
                ),
                "validate_lambda": lambda r: testingutils.get_enums(r) == []
            },
            # TODO downgrade in custom_sql needs to be added
        ]
        
        metadata = sa.MetaData()
        prev = None
        count = 0
        
        def process_change(c, prev, num_files):
            lam = c.setdefault('metadata_lambda', None)
            if lam is not None:
                lam(metadata)
                

            if prev is None:
                r: runner.Runner = new_test_runner(metadata)
            else:
                r = testingutils.new_runner_from_old(
                    prev,
                    new_test_runner,
                    metadata
                )
                
            lam = c.setdefault('runner_lambda', None)
            # make custom changes to runner here e.g. execute sql
            if lam is not None:
                lam(r)
            
            r.run()
            # upgrade again just case in we don't go through autogenerate flow and have to upgrade if it was 
            # done manually via execute_sql
            r.upgrade()
            testingutils.assert_num_files(r, num_files)
            return verify_change(c, r)
            
        def verify_change(c, r):
            tables = ['alembic_version']
            [tables.append(t) for t in c['tables']]
            tables.sort()
            testingutils.assert_num_tables(r, len(tables), tables)
                
            testingutils.validate_metadata_after_change(r, metadata)

            lam = c.setdefault('validate_lambda', None)
            if lam is not None:
                lam(r)
                
            return r

        include_list = []
        exclude_list = []
        for c in changes:
            count += 1
            r = process_change(c, prev, count)

            stamped = get_stamped_alembic_versions(r) 
            assert len(stamped) == 1
            
            if c.setdefault('dynamic_lambda', None) is not None:
                c['dynamic_lambda'](include, exclude, squash_raises, c)

            if include and c.setdefault('include_if_including', False):
                include_list.append(stamped[0])
            if exclude and c.setdefault('exclude_if_excluding', False):
                exclude_list.append(stamped[0])

            prev = r
            
        stamped = get_stamped_alembic_versions(prev)
        assert len(stamped) == 1
    
        # add to info
        r2 = testingutils.new_runner_from_old(
            prev,
            new_test_runner,
            metadata
        )
        
        metadata.info["custom_sql_include"] = {
            'public': include_list
        }
        metadata.info["custom_sql_exclude"] = {
            'public': exclude_list
        }

        r2.squash_all("squash all")
        testingutils.assert_num_files(r2, 1)
        
        assert get_stamped_alembic_versions(r2) == stamped

        # downgrade the squash to base
        assert len(get_stamped_alembic_versions(r2)) == 1
        
        # nothing here!
        r2.downgrade('-1', False)
                
        new_metadata = testingutils._get_new_metadata_for_runner(r2)
        assert len(new_metadata.sorted_tables) == 1 and new_metadata.sorted_tables[0].name == 'alembic_version'
        
        assert get_stamped_alembic_versions(r2) == []

        # upgrade everything
        
        if squash_raises is not None:
            with pytest.raises(Exception, match=squash_raises):
                r2.upgrade()
        else:
            r2.upgrade()
        
            assert get_stamped_alembic_versions(r2) == stamped
            
            last_change = changes[-1]
            # verify the last change
            verify_change(last_change, r2)
            
            # can create a new change and squash again and it works
            new_change = {
                "change": ChangeType.ADD_TABLE,
                "metadata_lambda": lambda metadata: add_table('contact_emails', metadata),
                "tables": ['accounts', 'events', 'contact_emails'],
            }
            
            # process new change, we should have 2 files now
            r3 = process_change(new_change, r2, 2)
            
            r3.squash_all("squash all")
            testingutils.assert_num_files(r3, 1)

            # run all_sql into schema.sql to verify that that keeps working
            file = os.path.join(r.get_schema_path(), 'schema.sql')
            r3.all_sql(file=file)
            
            r4 = new_test_runner(metadata, new_database=True)

            # write sql file to new database
            conn = r4.get_connection()
            with open(file, 'r') as f:
                # shouldn't have duplicates so writing it should work
                conn.execute(sa.text(f.read()))
                # conn.execute(sa.text('create table foo (id int); create table bar (id int); create table foo(id int);'))

            
            testingutils.validate_metadata_after_change(r4, metadata)

    
class TestPostgresCommand(CommandTest):
    pass


# class TestSQLiteCommand(CommandTest):
#     pass
