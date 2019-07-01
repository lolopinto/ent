import os
import pytest
import shutil
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import sqlalchemy as sa

from auto_schema import runner

@pytest.fixture(scope="function")
def new_test_runner(request):
  
  def _make_new_test_runner(metadata, prev_runner=None):
    # by default, this will be none and create a temp directory where things should go
    # sometimes, when we want to test multiple revisions, we'll send the previous runner so we reuse the path
    if prev_runner is not None:
      schema_path = prev_runner.get_schema_path()
    else:
      schema_path = tempfile.mkdtemp()

    # unclear if best way but use name of class to determine postgres vs sqlite and use that
    # to make sure everything works for both
    if "Postgres" in request.cls.__name__:
      url = "postgresql://localhost/autoschema_test"
    else:
      url = "sqlite:///%s/%s" % (schema_path, "foo.db")
      #url = "sqlite:///bar.db" # if you want a local file to inspect for whatever reason

    # reuse connection if not None. same logic as schema_path above
    if prev_runner is None:
      engine = create_engine(url)
      connection = engine.connect()
      metadata.bind = connection
      transaction = connection.begin()
      session = Session(bind=connection)

      def rollback_everything():
        session.close()
        transaction.rollback()
        connection.close()
        #metadata.reflect(bind=connection)
        #metadata.drop_all(bind=connection)

      request.addfinalizer(rollback_everything)
    else:
      connection = prev_runner.get_connection()

    r = runner.Runner(metadata, connection, schema_path)

    def delete_path():
      path = r.get_schema_path()

      # delete temp directory which was created
      if os.path.isdir(path):
        shutil.rmtree(path)

    request.addfinalizer(delete_path)

    return r

  return _make_new_test_runner
  

@pytest.fixture
def empty_metadata():
  metadata = sa.MetaData()
  return metadata


@pytest.fixture
def metadata_with_table():
  metadata = sa.MetaData()
  sa.Table('accounts', metadata,
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email_address', sa.String(255), nullable=False), 
    sa.Column('first_name', sa.Text(), nullable=False),
    sa.Column('last_name', sa.Text(), nullable=False),
    sa.Column('created_at', sa.Date(), nullable=False),
    sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
    sa.PrimaryKeyConstraint("id", name='accounts_id_pkey'), # use named primary key constraint instead of what we had per-column
    sa.UniqueConstraint("email_address", name="accounts_unique_email_address"),
  )
  return metadata

# takes the account table and converts the email_address type from String(255) to Text()
def metadata_with_table_text_changed(metadata):
  return _metadata_with_col_changed(metadata, 'email_address', 'accounts', sa.Text())
 

# takes the account table and converts the created_at type from Date() to TIMESTAMP()
def metadata_with_timestamp_changed(metadata):
  return _metadata_with_col_changed(metadata, 'created_at', 'accounts', sa.TIMESTAMP())


def _metadata_with_col_changed(metadata, col_name, table_name, new_type):
 # takes the tables and modifies the type of a specific column from current type to given type
  def change_col_type(col):
    if col.name != col_name:
      return col
    
    col.type = new_type
    return col

  tables = [t for t in metadata.sorted_tables if t.name == table_name]
  if len(tables) > 0:
    table = tables[0]
    table.columns = [change_col_type(col) for col in table.columns]

  return metadata


@pytest.fixture
@pytest.mark.usefixtures("metadata_with_table")
def metadata_with_two_tables(metadata_with_table):
  messages_table(metadata_with_table)
  return metadata_with_table


@pytest.fixture
@pytest.mark.usefixtures("metadata_with_table")
def metadata_with_foreign_key(metadata_with_table):
  contacts_table(metadata_with_table)
  return metadata_with_table


def messages_table(metadata):
  sa.Table('messages', metadata,
    sa.Column('id', sa.Integer()),
    sa.Column('thread_id', sa.Integer(), nullable=False), 
    sa.Column('message', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name='messages_id_pkey'), 
  )


def contacts_table(metadata):
  sa.Table('contacts', metadata,
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('account_id', sa.Integer, nullable=False),
    sa.Column('name', sa.String(255), nullable=False),
    sa.PrimaryKeyConstraint("id", name="contacts_id_pkey"),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name="contacts_account_id_fkey", ondelete="CASCADE"),
  )
