import os
import pytest
import shutil
import tempfile

from sqlalchemy import (Column, MetaData, Integer, Date, String, Table)

from auto_schema import runner

@pytest.fixture(scope="module")
def new_test_runner():
  runners = []

  def _make_new_test_runner(metadata, schema_path=None):
    # by default, this will be none and create a temp directory where things should go
    # sometimes, when we want to test multiple revisions, we'll send the previous path 
    # so we don't reuse it.
    if schema_path is None:
      schema_path = tempfile.mkdtemp()

    # put the sqlite file in the same location as all the other generated files
    url = "sqlite:///%s/%s" % (schema_path, "foo.db")
    #url = "sqlite:///bar.db" # if you want a local file to inspect for whatever reason

    r = runner.Runner(metadata, url, schema_path)
    runners.append(r)
    return r

  yield _make_new_test_runner

  # delete temp directory which was created
  for r in runners:
    path = r.get_schema_path()
    if os.path.isdir(path):
      shutil.rmtree(path)
  

@pytest.fixture
def empty_metadata():
  metadata = MetaData()
  return metadata


@pytest.fixture
def metadata_with_table():
  metadata = MetaData()
  Table('accounts', metadata,
    Column('id', Integer, primary_key=True),
    Column('email_address', String(255), nullable=False), 
    Column('first_name', String(255), nullable=False),
    Column('last_name', String(255), nullable=False),
    Column('created_at', Date, nullable=False),
  )
  return metadata


@pytest.fixture
@pytest.mark.usefixtures("metadata_with_table")
def metadata_with_two_tables(metadata_with_table):
  message_table(metadata_with_table)
  return metadata_with_table


def message_table(metadata):
  Table('messages', metadata,
    Column('id', Integer, primary_key=True),
    Column('account_id', Integer, nullable=False), 
    Column('message', String(5000), nullable=False),
  )
  return message_table