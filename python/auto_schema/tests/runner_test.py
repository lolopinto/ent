import pprint
import pytest
import os

from sqlalchemy import (create_engine, MetaData, TIMESTAMP)

from . import conftest

def get_new_metadata_for_runner(r):
  #metadata = r.get_metadata()
  # don't reflect but in fact get a new object so that we can reflect corectly
  new_metadata = MetaData()
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
    assert expected_count == 0 #if versions directory is 0, we better make sure expected_count is 0


def assert_num_tables(r, expected_count, tables=None):
  new_metadata = get_new_metadata_for_runner(r)

  # sometimes, alembic_version is created in between revisions, we don't care about that case here 
  # so just write it away
  sorted_tables = new_metadata.sorted_tables
  if expected_count == 0:
    sorted_tables = list(filter(lambda t: t.name != 'alembic_version', new_metadata.sorted_tables))

  assert len(sorted_tables) == expected_count

  if expected_count > 0 and tables is not None:
    table_names = list(map(lambda table: table.name, sorted_tables))
    assert table_names == tables


def assert_no_changes_made(r):
  assert_num_files(r, 0)
  assert_num_tables(r, 0)


def validate_metadata_after_change(r, old_metadata):
  new_metadata = get_new_metadata_for_runner(r)
  assert new_metadata != old_metadata

  assert(len(old_metadata.sorted_tables)) != len(new_metadata.sorted_tables)

  for table in new_metadata.sorted_tables:
    orig_table = next((t for t in old_metadata.sorted_tables if table.name == t.name), None)

    if orig_table is not None:
      validate_table(orig_table, table)
    else:
      # no need to do too much testing on this since we'll just have to trust that alembic works. 
      assert table.name == 'alembic_version'


def run_and_validate_with_standard_metadata_table(r, metadata_with_table):
  r.run()
  
  # should have the expected file with the expected tables
  assert_num_files(r, 1)
  assert_num_tables(r, 2, ['accounts', 'alembic_version'])

  validate_metadata_after_change(r, metadata_with_table)


def validate_table(orig_table, table):
  assert orig_table != table
  assert id(orig_table) != id(table)

  assert orig_table.name == table.name

  assert len(orig_table.columns) == len(table.columns)

  for orig_column, column in zip(orig_table.columns, table.columns):
    assert orig_column != column
    assert(id(orig_column)) != id(column)

    assert orig_column.name == column.name
    validate_column_type(orig_column, column)
    assert orig_column.primary_key == column.primary_key
    assert orig_column.nullable == column.nullable

    validate_foreign_key(orig_column, column)

    # we don't actually support all these below yet but when we do, it should start failing and we should know that
    assert orig_column.default == column.default
    assert orig_column.index == column.index
    assert orig_column.unique == column.unique
    #assert orig_column.autoincrement == column.autoincrement # ignore autoincrement for now as there's differences btw default behavior and postgres
    assert orig_column.key == column.key
    assert orig_column.onupdate == column.onupdate
    assert orig_column.constraints == column.constraints
    assert orig_column.comment == column.comment


def validate_column_type(orig_column, column):
  #print(type(orig_column.type).__name__, orig_column.type, column.type, orig_column.type == column.type, str(orig_column.type) == str(column.type))

  if isinstance(orig_column.type, TIMESTAMP):
    assert orig_column.type.timezone == column.type.timezone
  else:
    # compare types by using the string version of the types. 
    # seems to account for differences btw Integer and INTEGER, String(255) and VARCHAR(255) etc
  
    assert str(orig_column.type) == str(column.type) 

def validate_foreign_key(orig_column, column):
  assert len(orig_column.foreign_keys) == len(orig_column.foreign_keys)

  for fkey, orig_fkey in zip(column.foreign_keys, orig_column.foreign_keys):
    assert str(fkey.column) == str(orig_fkey.column) # similar to what we do in validate_table on column.type
    assert fkey.name == orig_fkey.name
    assert fkey.ondelete == orig_fkey.ondelete
    assert fkey.onupdate == orig_fkey.onupdate

    # we don't actually support all these below yet but when we do, it should start failing and we should know that
    assert fkey.deferrable == orig_fkey.deferrable
    assert fkey.initially == orig_fkey.initially
   # assert fkey.link_to_name == orig_fkey.link_to_name # this seems like it's expected to change. TODO figure this out more
    assert fkey.use_alter == orig_fkey.use_alter
    assert fkey.match == orig_fkey.match
    assert fkey.info == orig_fkey.info
    assert str(fkey.parent) == str(orig_fkey.parent)


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

    # get the message table
    conftest.messages_table(metadata_with_table)

    # recreate runner with last path and modified metadata
    r2 = new_test_runner(metadata_with_table, r)
    assert r.get_schema_path() == r2.get_schema_path()
    
    r2.revision()

    # we should have a 2nd schema path
    assert_num_files(r2, 2)

    # upgrade the schema and let's confirm it works
    r.upgrade()

    # confirm that a 3rd table was created
    assert_num_tables(r, 3, ['accounts', 'alembic_version', 'messages'])


  @pytest.mark.usefixtures("metadata_with_table")
  def test_sequential_table_adds(self, new_test_runner, metadata_with_table):
    r = new_test_runner(metadata_with_table)
    run_and_validate_with_standard_metadata_table(r, metadata_with_table)

    # get the message table
    conftest.messages_table(metadata_with_table)

    # recreate runner with last path and modified metadata
    r2 = new_test_runner(metadata_with_table, r)
    assert r.get_schema_path() == r2.get_schema_path()

    r2.run()

    # should have the expected files with the expected tables
    assert_num_files(r, 2)
    assert_num_tables(r, 3, ['accounts', 'alembic_version', 'messages'])

    validate_metadata_after_change(r, metadata_with_table)


  @pytest.mark.usefixtures("metadata_with_two_tables")
  def test_multiple_tables_added(self, new_test_runner, metadata_with_two_tables):
    r = new_test_runner(metadata_with_two_tables)
    r.run()
    
    # should have the expected file with the expected tables
    assert_num_files(r, 1) # because 2 new tables added at the same time, only one schema file needed
    assert_num_tables(r, 3, ['accounts', 'alembic_version', 'messages'])

    validate_metadata_after_change(r, metadata_with_two_tables)

  @pytest.mark.usefixtures("metadata_with_foreign_key")
  def test_multiple_tables_added_with_foreign_key(self, new_test_runner, metadata_with_foreign_key):
    r = new_test_runner(metadata_with_foreign_key)
    r.run()
    
    # should have the expected file with the expected tables
    assert_num_files(r, 1) # because 2 new tables added at the same time, only one schema file needed
    assert_num_tables(r, 3, ['accounts', 'alembic_version', 'contacts'])

    validate_metadata_after_change(r, metadata_with_foreign_key)

class TestPostgresRunner(BaseTestRunner):

  # only in postgres because modifying columns not supported by Sqlite
  @pytest.mark.usefixtures("metadata_with_table")
  @pytest.mark.parametrize(
    "new_metadata_func, expected_message", 
    [(conftest.metadata_with_table_text_changed, "modify type from VARCHAR(255) to TEXT" ),
    (conftest.metadata_with_timestamp_changed, "modify type from DATE to TIMESTAMP")]
    )
  def test_column_type_change(self, new_test_runner, metadata_with_table, new_metadata_func, expected_message):
    r = new_test_runner(metadata_with_table)
    run_and_validate_with_standard_metadata_table(r, metadata_with_table)

    # recreate runner with last path and modified metadata
    new_metadata_func(metadata_with_table)
    r2 = new_test_runner(metadata_with_table, r)

    diff = r2.compute_changes()
    pprint.pprint(diff, indent=2, width=30)

    assert len(diff) == 1

    assert r2.revision_message() == expected_message

    r.run()

    validate_metadata_after_change(r, metadata_with_table)

  
class TestSqliteRunner(BaseTestRunner):
  pass

