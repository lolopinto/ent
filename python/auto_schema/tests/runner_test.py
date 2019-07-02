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

  for db_table in new_metadata.sorted_tables:
    schema_table = next((t for t in old_metadata.sorted_tables if db_table.name == t.name), None)

    if schema_table is not None:
      validate_table(schema_table, db_table)
    else:
      # no need to do too much testing on this since we'll just have to trust that alembic works. 
      assert db_table.name == 'alembic_version'


def run_and_validate_with_standard_metadata_table(r, metadata_with_table):
  r.run()
  
  # should have the expected file with the expected tables
  assert_num_files(r, 1)
  assert_num_tables(r, 2, ['accounts', 'alembic_version'])

  validate_metadata_after_change(r, metadata_with_table)


def recreate_with_new_metadata(r, new_test_runner, metadata_with_table, metadata_func):
  metadata_func(metadata_with_table)
  # recreate and run
  r2 = new_test_runner(metadata_with_table, r)
  assert r.get_schema_path() == r2.get_schema_path()
  return r2


def validate_table(schema_table, db_table):
  assert schema_table != db_table
  assert id(schema_table) != id(db_table)

  assert schema_table.name == db_table.name

  validate_columns(schema_table, db_table)
  validate_constraints(schema_table, db_table)
  validate_indexes(schema_table, db_table)


def validate_columns(schema_table, db_table):
  schema_columns = schema_table.columns
  db_columns = db_table.columns
  assert len(schema_columns) == len(db_columns)
  for schema_column, db_column in zip(schema_columns, db_columns):
    validate_column(schema_column, db_column)


def validate_column(schema_column, db_column):
  assert schema_column != db_column
  assert(id(schema_column)) != id(db_column)

  assert schema_column.name == db_column.name
  validate_column_type(schema_column, db_column)
  assert schema_column.primary_key == db_column.primary_key
  assert schema_column.nullable == db_column.nullable

  validate_foreign_key(schema_column, db_column)

  # we don't actually support all these below yet but when we do, it should start failing and we should know that
  assert schema_column.default == db_column.default
  assert schema_column.index == db_column.index
  assert schema_column.unique == db_column.unique
  #assert schema_column.autoincrement == db_column.autoincrement # ignore autoincrement for now as there's differences btw default behavior and postgres
  assert schema_column.key == db_column.key
  assert schema_column.onupdate == db_column.onupdate
  assert schema_column.constraints == db_column.constraints
  assert schema_column.comment == db_column.comment


def validate_column_type(schema_column, db_column):
  #print(type(schema_column.type).__name__, schema_column.type, db_column.type, schema_column.type == db_column.type, str(schema_column.type) == str(db_column.type))

  if isinstance(schema_column.type, TIMESTAMP):
    assert schema_column.type.timezone == db_column.type.timezone
  else:
    # compare types by using the string version of the types. 
    # seems to account for differences btw Integer and INTEGER, String(255) and VARCHAR(255) etc
  
    assert str(schema_column.type) == str(db_column.type) 

def sort_fn(item): 
  return item.name

def validate_indexes(schema_table, db_table):
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
      validate_column(schema_column, db_column)


def validate_constraints(schema_table, db_table):
  # sort constraints so that the order for both are the same
  schema_constraints = sorted(schema_table.constraints, key=sort_fn)
  db_constraints = sorted(db_table.constraints, key=sort_fn)

  assert len(schema_constraints) == len(db_constraints)

  for schema_constraint, db_constraint in zip(schema_constraints, db_constraints):
    # constraint names should be equal
    assert schema_constraint.name == db_constraint.name

    schema_constraint_columns = schema_constraint.columns
    db_constraint_columns = db_constraint.columns

    assert len(schema_constraint_columns) == len(db_constraint_columns)
    for schema_column, db_column in zip(schema_constraint_columns, db_constraint_columns):
      validate_column(schema_column, db_column)


def validate_foreign_key(schema_column, db_column):
  assert len(schema_column.foreign_keys) == len(schema_column.foreign_keys)

  for db_fkey, schema_fkey in zip(db_column.foreign_keys, schema_column.foreign_keys):
    assert str(db_fkey.column) == str(schema_fkey.column) # similar to what we do in validate_table on column.type
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

    r2 = recreate_with_new_metadata(r, new_test_runner, metadata_with_table, conftest.messages_table)
    
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
    run_and_validate_with_standard_metadata_table(r, metadata_with_table)


  @pytest.mark.usefixtures("metadata_with_table")
  def test_sequential_table_adds(self, new_test_runner, metadata_with_table):
    r = new_test_runner(metadata_with_table)
    run_and_validate_with_standard_metadata_table(r, metadata_with_table)

    # recreate runner with last runner 
    r2 = recreate_with_new_metadata(r, new_test_runner, metadata_with_table, conftest.messages_table)
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


  # only in postgres because "No support for ALTER of constraints in SQLite dialect"
  @pytest.mark.usefixtures("metadata_with_table")
  def test_unique_constraint_added(self, new_test_runner, metadata_with_table):
    r = new_test_runner(metadata_with_table)
    run_and_validate_with_standard_metadata_table(r, metadata_with_table)

    r2 = recreate_with_new_metadata(r, new_test_runner, metadata_with_table, conftest.metadata_with_unique_constraint_added)

    message = r2.revision_message()
    assert message == "add unique constraint accounts_unique_email_address"

    r2.run()

    # should have the expected files with the expected tables
    assert_num_files(r2, 2)
    assert_num_tables(r2, 2, ['accounts', 'alembic_version'])
    validate_metadata_after_change(r2, r2.get_metadata())


  
class TestSqliteRunner(BaseTestRunner):
  pass

