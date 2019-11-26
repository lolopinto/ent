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

    # test default sqlite
    sa.Column('meaning_of_life', sa.Integer(), nullable=False, server_default='42'), 

    sa.Column('phone_number', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
    sa.PrimaryKeyConstraint("id", name='accounts_id_pkey'), # use named primary key constraint instead of what we had per-column
    sa.UniqueConstraint("phone_number", name="accounts_unique_phone_number"), # support unique constraint as part of initial table creation
  )
  return metadata


@pytest.fixture
def metadata_with_nullable_fields():
  metadata = sa.MetaData()
  sa.Table("accounts", metadata,
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('phone_number', sa.String(255), nullable=False),
    sa.Column('bio', sa.String(255), nullable=True),
    sa.Column('date_of_birth', sa.TIMESTAMP(), nullable=True),
    sa.Column('show_bio_on_profile', sa.Boolean(), nullable=True),
    sa.Column('pi', sa.Float(), nullable=True),

    sa.PrimaryKeyConstraint("id", name='accounts_id_pkey'), 
    sa.UniqueConstraint("phone_number", name="accounts_unique_phone_number"), 
  )
  return metadata
  

def metadata_with_unique_constraint_added(metadata):
  return _add_constraint_to_metadata(
    metadata,    # and then unique constraint added afterwards
    sa.UniqueConstraint("email_address", name="accounts_unique_email_address"),
  )


# takes the account table and converts the email_address type from String(255) to Text()
def metadata_with_table_text_changed(metadata):
  return _metadata_with_col_changed(metadata, 'email_address', 'accounts', sa.Text())
 

# takes the account table and converts the created_at type from Date() to TIMESTAMP()
def metadata_with_timestamp_changed(metadata):
  return _metadata_with_col_changed(metadata, 'created_at', 'accounts', sa.TIMESTAMP())


# takes the account table and conversts the last_name table to nullable
def metadata_with_nullable_changed(metadata):
  return _metadata_with_nullable_changed(metadata, 'last_name', 'accounts', True)


def _metadata_with_nullable_changed(metadata, col_name, table_name, nullable_value):
  def change_nullable_type(col):
    if col.name != col_name:
      return col
    
    col.nullable = nullable_value
    return col

  return _apply_func_on_metadata(metadata, table_name, change_nullable_type)


def _metadata_with_col_changed(metadata, col_name, table_name, new_type):
 # takes the tables and modifies the type of a specific column from current type to given type
  def change_col_type(col):
    if col.name != col_name:
      return col
    
    col.type = new_type
    return col

  return _apply_func_on_metadata(metadata, table_name, change_col_type)


def _apply_func_on_metadata(metadata, table_name, fn):
  tables = [t for t in metadata.sorted_tables if t.name == table_name]
  if len(tables) > 0:
    table = tables[0]
    table.columns = [fn(col) for col in table.columns]

  return metadata


@pytest.fixture
@pytest.mark.usefixtures("metadata_with_table")
def metadata_with_table_with_index(metadata_with_table):
  return _add_constraint_to_metadata(
    metadata_with_table,     
    sa.Index("accounts_first_name_idx", "first_name"), #index the first name because we support searching for some reason
  )


@pytest.fixture
@pytest.mark.usefixtures("metadata_with_table")
def test_metadata_with_multi_column_index(metadata_with_table):
  return _add_constraint_to_metadata(
    metadata_with_table,     
    sa.Index("accounts_first_name_last_name_idx", "first_name", "last_name"), #index the first and last name because we support searching by that
  )

@pytest.fixture
def metadata_with_multi_column_constraint():
  metadata = sa.MetaData()
  sa.Table('user_friends_edge', metadata,
    sa.Column('id1', sa.Integer(), nullable=False),
    sa.Column('id1_type', sa.Text(), nullable=False), 
    sa.Column('edge_type', sa.Integer(), nullable=False),
    sa.Column('id2', sa.Integer(), nullable=False),
    sa.Column('id2_type', sa.Text(), nullable=False),
    sa.Column('time', sa.TIMESTAMP(), nullable=False),
    sa.Column('data', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="accounts_friends_edge_id1_edge_type_id2_pkey"), 
  )
  return metadata


@pytest.fixture
def metadata_with_foreign_key_to_same_table():
  return metadata_assoc_edge_config()


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


def metadata_assoc_edge_config():
  metadata = sa.MetaData()
  assoc_edge_config_table(metadata)
  return metadata


@pytest.fixture
def metadata_with_no_edges():
  metadata = metadata_assoc_edge_config()
  metadata.info.setdefault("edges", {})
  return metadata


@pytest.fixture
def metadata_with_one_edge():
  metadata = metadata_assoc_edge_config()
  # 1 edge, no inverse
  edges = {
    'public': {
      'UserToFollowersEdge': user_to_followers_edge(),
    }
  }

  metadata.info.setdefault("edges", edges)
  return metadata

@pytest.fixture
def metadata_with_symmetric_edge():
  metadata = metadata_assoc_edge_config()
  # 1 edge, no inverse
  edges = {
    'public': {
      'UserToFriendsEdge': {
        'edge_name': 'UserToFriendsEdge',
        'edge_type': 10,
        'symmetric_edge': True,
        'edge_table': 'user_friends_edge',
      }
    }
  }

  metadata.info.setdefault("edges", edges)
  return metadata


@pytest.fixture
def metadata_with_inverse_edge():
  metadata = metadata_assoc_edge_config()
  # 2 edges, inverse of each other
  edges = {
    'public': {
      'UserToFollowersEdge': user_to_followers_edge(inverse_edge_type=2),
      'UserToFolloweesEdge': users_to_followees_edge(inverse_edge_type=1),
    }
  }

  metadata.info.setdefault("edges", edges)
  return metadata
  

def user_to_followers_edge(edge_type = 1, inverse_edge_type=None):
  return {
    'edge_name': 'UserToFollowersEdge',
    'edge_type': edge_type,
    'edge_table': 'user_followers_edge',
    'symmetric_edge': False,
    'inverse_edge_type': inverse_edge_type,
  }


def users_to_followees_edge(edge_type = 2, inverse_edge_type=None):
  return {
    'edge_name': 'UserToFolloweesEdge',
    'edge_type': edge_type,
    'edge_table': 'user_followers_edge',
    'symmetric_edge': False,
    'inverse_edge_type': inverse_edge_type,
  }


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


# this is the structure that's automatically created by ent
# TODO: should test this so that if the generation changes, we catch this
# need an integration test of some sort
# this doesn't quite match because i'm doing integer instead of uuid
# todo: one postgres test with uuid
def assoc_edge_config_table(metadata):
  sa.Table('assoc_edge_config', metadata,
    sa.Column('edge_type', sa.Integer(), nullable=False),
    sa.Column('edge_name', sa.Text(), nullable=False),
    sa.Column('symmetric_edge', sa.Boolean(), nullable=False, server_default='false'), # use false instead of FALSE to avoid the need for craziness here
    sa.Column('inverse_edge_type', sa.Integer(), nullable=True),
    sa.Column('edge_table', sa.Text(), nullable=False),
    sa.Column('created_at', sa.TIMESTAMP(), nullable=False),
    sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
    sa.PrimaryKeyConstraint("edge_type", name="assoc_edge_config_edge_type_pkey"),
    sa.ForeignKeyConstraint(['inverse_edge_type'], ['assoc_edge_config.edge_type'], name="assoc_edge_config_inverse_edge_type_fkey", ondelete="RESTRICT"),
  )


def _add_constraint_to_metadata(metadata, constraint, table_name="accounts"):
  tables = [t for t in metadata.sorted_tables if t.name == table_name]
  table = tables[0]

  table.append_constraint(constraint)
  return metadata

