import os
import random
import string
import pytest
import shutil
import uuid
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.dialects import postgresql

import sqlalchemy as sa

from auto_schema import runner
from typing import List

from auto_schema.schema_item import FullTextIndex
from auto_schema import compare


class Postgres:
    def __init__(self) -> None:
        self._randomDB = self.randomDB()
        self._globalConnection = None
        self._globalEngine = None

        self._conn = None
        self._engine = None

    def randomDB(self):
        return random.choice(string.ascii_lowercase) + ''.join(random.SystemRandom().choice(
            string.ascii_lowercase + string.digits) for _ in range(20))

    def _get_url(self, _schema_path):
        return os.getenv("DB_CONNECTION_STRING", "postgresql://localhost")

    def create_connection(self, schema_path):
        engine = create_engine(self._get_url(schema_path),
                               isolation_level='AUTOCOMMIT')
        self._globalEngine = engine
        self._globalConnection = engine.connect()
        self._globalConnection.execute('CREATE DATABASE %s' % self._randomDB)
        engine = create_engine("%s/%s" %
                               (self._get_url(schema_path), self._randomDB))
        self._engine = engine
        self._conn = engine.connect()

        return self._conn

    def get_finalizer(self):
        def fn():
            self._conn.close()
            self._engine.dispose()

            self._globalConnection.execute('DROP DATABASE %s' % self._randomDB)
            self._globalConnection.close()
            self._globalEngine.dispose()

        return fn


class SQLite:

    def __init__(self) -> None:
        self._conn = None

    def _get_url(self, schema_path):
        return "sqlite:///%s/%s" % (schema_path, "foo.db")
        # return "sqlite:///bar.db"  # if you want a local file to inspect for whatever reason

    def create_connection(self, schema_path):
        engine = create_engine(self._get_url(schema_path))
        self._conn = engine.connect()
        return self._conn

    def get_finalizer(self):
        def fn():
            self._conn.close()

        return fn


def postgres_dialect_from_request(request):
    return "Postgres" in request.cls.__name__


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
        dialect = None
        if postgres_dialect_from_request(request):
            dialect = Postgres()
        else:
            dialect = SQLite()

        # reuse connection if not None. same logic as schema_path above
        if prev_runner is None:
            connection = dialect.create_connection(schema_path)
            metadata.bind = connection

            request.addfinalizer(dialect.get_finalizer())
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


def default_children_of_table():
    return [
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email_address', sa.String(255), nullable=False),
        sa.Column('first_name', sa.Text(), nullable=False),
        sa.Column('last_name', sa.Text(), nullable=False),
        sa.Column('created_at', sa.Date(), nullable=False),

        # test default sqlite
        sa.Column('meaning_of_life', sa.Integer(),
                  nullable=False, server_default='42'),
        sa.Column('email_verified', sa.Boolean(),
                  nullable=False, server_default='false'),

        sa.Column('phone_number', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
        sa.PrimaryKeyConstraint("id", name='accounts_id_pkey'),
        # support unique constraint as part of initial table creation
        sa.UniqueConstraint(
            "phone_number", name="accounts_unique_phone_number"
        ),
    ]


@pytest.fixture
def metadata_with_table():
    return metadata_with_base_table_restored()


def metadata_with_cols_added_to_table(metadata):
    return metadata_with_given_cols_added_to_table(
        metadata,
        [
            sa.Column('rainbow', sa.Text(), nullable=True),
            sa.Column('new_column', sa.Integer(), nullable=True),
        ]
    )


def metadata_with_given_cols_added_to_table(metadata: sa.MetaData, cols: List[sa.Column]):
    changes = default_children_of_table()

    [changes.append(col) for col in cols]
    metadata = sa.MetaData()
    sa.Table('accounts', metadata,
             *changes,
             )

    return metadata


def metadata_with_base_table_restored():
    metadata = sa.MetaData()
    changes = default_children_of_table()
    sa.Table('accounts', metadata,
             *changes,
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
             sa.UniqueConstraint(
                 "phone_number", name="accounts_unique_phone_number"),
             )
    return metadata


@pytest.fixture()
def address_metadata_table():
    metadata = sa.MetaData()
    sa.Table("addresses", metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column("street_name", sa.Text(), nullable=False),
             sa.Column("city", sa.Text(), nullable=False),
             sa.Column("zip", sa.Text(), nullable=False),
             sa.Column("apartment", sa.Text(), nullable=True),
             sa.Column("country", sa.Text(),
                       nullable=False, server_default="US"),
             sa.Column("state", sa.Text(), nullable=False),
             sa.PrimaryKeyConstraint("id", name='addresses_id_pkey'),
             )
    return metadata


@pytest.fixture()
def table_with_timestamptz_plus_date():
    metadata = sa.MetaData()
    sa.Table("accounts", metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('email_address', sa.String(255), nullable=False),
             sa.Column('first_name', sa.Text(), nullable=False),
             sa.Column('last_name', sa.Text(), nullable=False),
             sa.Column('created_at', sa.TIMESTAMP(), nullable=False),
             sa.Column('phone_number', sa.Text(), nullable=False),
             sa.Column('updated_at', sa.TIMESTAMP(
                 timezone=True), nullable=False),
             sa.PrimaryKeyConstraint("id", name='accounts_id_pkey'),
             )
    return metadata


@pytest.fixture()
def metadata_table_with_time():
    metadata = sa.MetaData()
    sa.Table("hours", metadata,
             sa.Column('day_of_week', sa.String(255), nullable=False),
             sa.Column('open', sa.Time(), nullable=False),
             sa.Column('close', sa.Time(), nullable=False),
             )
    return metadata


@pytest.fixture()
def metadata_table_with_timetz():
    metadata = sa.MetaData()
    sa.Table("hours", metadata,
             sa.Column('day_of_week', sa.String(255), nullable=False),
             sa.Column('open', sa.Time(timezone=True), nullable=False),
             sa.Column('close', sa.Time(timezone=True), nullable=False),
             )
    return metadata


@pytest.fixture
def metadata_with_arrays():
    metadata = sa.MetaData()
    sa.Table("tbl", metadata,
             sa.Column('string_list', postgresql.ARRAY(
                 sa.Text), nullable=False),
             sa.Column('string_list_2', postgresql.ARRAY(
                 sa.Text()), nullable=False),
             sa.Column('int_list', postgresql.ARRAY(
                 sa.Integer), nullable=False),
             sa.Column('bool_list', postgresql.ARRAY(
                 sa.Boolean), nullable=False),
             sa.Column('date_list', postgresql.ARRAY(sa.Date), nullable=False),
             sa.Column('time_list', postgresql.ARRAY(sa.Time), nullable=False),
             sa.Column('timetz_list', postgresql.ARRAY(
                 sa.Time(timezone=True)), nullable=False),
             sa.Column('timestamp_list', postgresql.ARRAY(
                 sa.TIMESTAMP), nullable=False),
             sa.Column('timestamptz_list', postgresql.ARRAY(
                 sa.TIMESTAMP(timezone=True)), nullable=False),
             # TODO https://github.com/lolopinto/ent/issues/1029 support gist here
             # need to support operators...
             sa.Column('float_list', postgresql.ARRAY(
                 sa.Float), nullable=False),
             sa.Column('uuid_list', postgresql.ARRAY(
                 postgresql.UUID), nullable=False),
             sa.Index('tbl_string_list_idx', 'string_list',
                      postgresql_using='gin'),
             sa.Index('tbl_uuid_list_idx', 'uuid_list',
                      postgresql_using='gin'),
             sa.Index('tbl_int_list_idx', 'int_list',
                      postgresql_using='gin'),
             sa.Index('tbl_time_list_idx', 'time_list',
                      postgresql_using='gin'),
             sa.Index('tbl_timetz_list_idx', 'timetz_list',
                      postgresql_using='gin'),
             # just to confirm btree works...
             sa.Index('tbl_float_list_idx', 'float_list',
                      postgresql_using='btree'),
             # index with no type..
             sa.Index('tbl_date_list_idx', 'date_list'),

             )
    return metadata


@ pytest.fixture
def metadata_with_json():
    metadata = sa.MetaData()
    sa.Table("tbl", metadata,
             # json indexes need work...
             sa.Column('jsonb', postgresql.JSONB, nullable=False),
             sa.Column('jsonb_null', postgresql.JSONB, nullable=True),
             sa.Column('jsonb2_null', postgresql.JSONB, nullable=True),
             sa.Column('json', postgresql.JSON, nullable=False),
             sa.Column('json_null', postgresql.JSON, nullable=True),
             sa.Index('tbl_jsonb_idx', 'jsonb', postgresql_using='gin'),
             # just to confirm btree works
             sa.Index('tbl_nullable_jsonb_idx', 'jsonb_null',
                      postgresql_using='btree'),
             # index with no type..
             sa.Index('tbl_default_jsonb_idx', 'jsonb2_null'),
             )
    return metadata


@ pytest.fixture
def metadata_with_bigint():
    metadata = sa.MetaData()
    sa.Table("tbl", metadata,
             sa.Column('bigint', sa.BigInteger, nullable=False),
             sa.Column('bigint_null', sa.BigInteger, nullable=True),
             )
    return metadata


def identity_metadata_func(metadata):
    return metadata


def metadata_with_server_default_changed_string(metadata):
    return _metadata_with_server_default_changed(metadata, 'country', 'addresses', 'UK')


def metadata_with_server_default_dropped(metadata):
    return _metadata_with_server_default_changed(metadata, 'country', 'addresses', None)


def metadata_with_unique_constraint_added(metadata):
    sa.Table('accounts', metadata,
             sa.UniqueConstraint(
                 "email_address", name="accounts_unique_email_address"),
             extend_existing=True
             )
    return metadata


# takes the account table and converts the email_address type from String(255) to Text()
def metadata_with_table_text_changed(metadata):
    return _metadata_with_col_changed(metadata, 'email_address', 'accounts', sa.Text())


# takes the account table and converts the created_at type from Date() to TIMESTAMP()
def metadata_with_timestamp_changed(metadata):
    return _metadata_with_col_changed(metadata, 'created_at', 'accounts', sa.TIMESTAMP())


# takes the account table and converts the last_name column to nullable
def metadata_with_nullable_changed(metadata):
    return _metadata_with_nullable_changed(metadata, 'last_name', 'accounts', True)


# takes the account table and converts the default value of meaning_of_life column from 42 to 35
def metadata_with_server_default_changed_int(metadata):
    return _metadata_with_server_default_changed(metadata, 'meaning_of_life', 'accounts', '35')


def metadata_with_server_default_changed_bool(metadata):
    return _metadata_with_server_default_changed(metadata, 'email_verified', 'accounts', 'TRUE')


def metadata_with_created_at_default_changed(metadata):
    return _metadata_with_server_default_changed(metadata, 'created_at', 'accounts', sa.text('now()'))


def _metadata_with_nullable_changed(metadata, col_name, table_name, nullable_value):
    def change_nullable_type(col):
        col.nullable = nullable_value
        return col

    return _apply_func_on_metadata(metadata, col_name, table_name, change_nullable_type)


def _metadata_with_server_default_changed(metadata, col_name, table_name, new_value):
    def change_server_default(col):
        # print(col, col_name, new_value, repr(new_value))
        col.server_default = new_value
        return col

    return _apply_func_on_metadata(metadata, col_name, table_name, change_server_default)


def _metadata_with_col_changed(metadata, col_name, table_name, new_type):
    def change_col_type(col):
        col.type = new_type
        return col

    return _apply_func_on_metadata(metadata, col_name, table_name, change_col_type)


def _apply_func_on_metadata(metadata, col_name, table_name, fn):
    tables = [t for t in metadata.sorted_tables if t.name == table_name]

    def apply_fn(col):
        if col.name != col_name:
            return col
        return fn(col)

    if len(tables) > 0:
        table = tables[0]
        table.columns = [apply_fn(col) for col in table.columns]

    return metadata


def metadata_with_table_with_index(metadata_with_table):
    sa.Table('accounts',
             metadata_with_table,
             # index the first name because we support searching for some reason
             sa.Index("accounts_first_name_idx", "first_name"),
             extend_existing=True
             )
    return metadata_with_table


def metadata_with_multi_column_index(metadata_with_table):
    sa.Table('accounts',
             metadata_with_table,
             # index the first and last name because we support searching by that
             sa.Index("accounts_first_name_last_name_idx",
                      "first_name", "last_name"),
             extend_existing=True
             )
    return metadata_with_table


def metadata_with_fulltext_search_index(metadata_with_table):
    sa.Table('accounts',
             metadata_with_table,
             FullTextIndex("accounts_first_name_idx",
                           info={
                               'postgresql_using': 'gin',
                               'postgresql_using_internals': "to_tsvector('english', first_name)",
                               'column': 'first_name',
                           }
                           ),
             extend_existing=True
             )
    return metadata_with_table


def metadata_with_multicolumn_fulltext_search_index(metadata_with_table):
    sa.Table('accounts',
             metadata_with_table,
             FullTextIndex("accounts_full_text_idx",
                           info={
                               'postgresql_using': 'gin',
                               'postgresql_using_internals': "to_tsvector('english', first_name || ' ' || last_name)",
                               'columns': ['first_name', 'last_name'],
                           }
                           ),
             extend_existing=True
             )
    return metadata_with_table


@ pytest.fixture
def metadata_with_multicolumn_fulltext_search():
    metadata = metadata_with_base_table_restored()
    sa.Table('accounts',
             metadata,
             FullTextIndex("accounts_full_text_idx",
                           info={
                               'postgresql_using': 'gin',
                               'postgresql_using_internals': "to_tsvector('english', first_name || ' ' || last_name)",
                               'columns': ['first_name', 'last_name'],
                           }
                           ),
             extend_existing=True
             )
    return metadata


def metadata_with_multicolumn_fulltext_search_index_gist(metadata_with_table):
    sa.Table('accounts',
             metadata_with_table,
             FullTextIndex("accounts_full_text_idx",
                           info={
                               'postgresql_using': 'gist',
                               'postgresql_using_internals': "to_tsvector('english', first_name || ' ' || last_name)",
                               'columns': ['first_name', 'last_name'],
                           }
                           ),
             extend_existing=True
             )
    return metadata_with_table


def metadata_with_multicolumn_fulltext_search_index_btree(metadata_with_table):
    sa.Table('accounts',
             metadata_with_table,
             FullTextIndex("accounts_full_text_idx",
                           info={
                               'postgresql_using': 'btree',
                               'postgresql_using_internals': "to_tsvector('english', first_name || ' ' || last_name)",
                               'columns': ['first_name', 'last_name'],
                           }
                           ),
             extend_existing=True
             )
    return metadata_with_table


def metadata_with_generated_col_fulltext_search_index(metadata_with_table):
    sa.Table('accounts', metadata_with_table,
             sa.Column('full_name', postgresql.TSVECTOR(), sa.Computed(
                 "to_tsvector('english', first_name || ' ' || last_name)")),
             sa.Index('accounts_full_text_idx',
                      'full_name', postgresql_using='gin'),

             extend_existing=True)

    return metadata_with_table


def metadata_with_generated_col_fulltext_search_index_gist(metadata_with_table):
    sa.Table('accounts', metadata_with_table,
             sa.Column('full_name', postgresql.TSVECTOR(), sa.Computed(
                 "to_tsvector('english', first_name || ' ' || last_name)")),
             sa.Index('accounts_full_text_idx',
                      'full_name', postgresql_using='gist'),

             extend_existing=True)

    return metadata_with_table


@ pytest.fixture
def metadata_with_multi_column_pkey_constraint(request):
    edge_type_col = sa.Integer()
    if postgres_dialect_from_request(request):
        edge_type_col = postgresql.UUID

    metadata = sa.MetaData()
    sa.Table('user_friends_edge', metadata,
             sa.Column('id1', sa.Integer(), nullable=False),
             sa.Column('id1_type', sa.Text(), nullable=False),
             sa.Column('edge_type', edge_type_col, nullable=False),
             sa.Column('id2', sa.Integer(), nullable=False),
             sa.Column('id2_type', sa.Text(), nullable=False),
             sa.Column('time', sa.TIMESTAMP(), nullable=False),
             sa.Column('data', sa.Text(), nullable=True),
             sa.PrimaryKeyConstraint(
                 "id1", "edge_type", "id2", name="user_friends_edge_id1_edge_type_id2_pkey"),
             )
    return metadata


@ pytest.fixture()
def metadata_with_multi_column_unique_constraint():
    metadata = metadata_with_contacts_table_with_no_unique_constraint()
    sa.Table('contacts', metadata,
             sa.UniqueConstraint(
                 "email_address", "user_id", name="contacts_unique_email_per_contact"
             ),
             extend_existing=True
             )
    return metadata


def metadata_with_contacts_table_with_no_unique_constraint():
    metadata = sa.MetaData()
    table = sa.Table('contacts', metadata,
                     sa.Column('id', sa.Integer(), nullable=False),
                     sa.Column('email_address', sa.Text(), nullable=False),
                     sa.Column('first_name', sa.Text(), nullable=False),
                     sa.Column('last_name', sa.Text(), nullable=False),
                     # ignoring the fkey here
                     sa.Column('user_id', sa.Integer(), nullable=False),
                     sa.PrimaryKeyConstraint(
                         "id", name="contacts_pkey",
                     ),
                     )
    return metadata


@ pytest.fixture()
def metadata_with_multi_column_fkey_constraint():
    metadata = sa.MetaData()
    sa.Table('t1', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('c1', sa.Integer(), nullable=False),
             sa.Column('c2', sa.Integer(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t1_pkey",
             ),
             sa.UniqueConstraint(
                 "c1", "c2", name="unique"
             )
             )

    sa.Table('t2', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('c1', sa.Integer(), nullable=False),
             sa.Column('c2', sa.Integer(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t2_pkey",
             ),
             sa.ForeignKeyConstraint(
                 ['c1', 'c2'], ['t1.c1', 't1.c2'], name="t2_fkey", ondelete="RESTRICT"
             ),
             )
    return metadata


def metadata_with_multi_column_fkey_constraint_removed():
    metadata = sa.MetaData()
    sa.Table('t1', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('c1', sa.Integer(), nullable=False),
             sa.Column('c2', sa.Integer(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t1_pkey",
             ),
             sa.UniqueConstraint(
                 "c1", "c2", name="unique"
             )
             )

    sa.Table('t2', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('c1', sa.Integer(), nullable=False),
             sa.Column('c2', sa.Integer(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t2_pkey",
             ),
             )
    return metadata


@ pytest.fixture()
def metadata_with_multi_column_fkey_constraint_no_constraint_reference_table():
    metadata = sa.MetaData()
    sa.Table('t1', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('c1', sa.Integer(), nullable=False),
             sa.Column('c2', sa.Integer(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t1_pkey",
             ),
             )

    sa.Table('t2', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('c1', sa.Integer(), nullable=False),
             sa.Column('c2', sa.Integer(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t2_pkey",
             ),
             sa.ForeignKeyConstraint(
                 ['c1', 'c2'], ['t1.c1', 't1.c2'], name="t2_fkey", ondelete="RESTRICT"
             ),
             )
    return metadata


@ pytest.fixture()
def metadata_with_column_check_constraint():
    metadata = sa.MetaData()
    sa.Table('t1', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('price', sa.Numeric(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t1_pkey",
             ),
             sa.CheckConstraint('price > 0', 'positive_price'),
             )
    return metadata


def metadata_with_constraint_added_after(metadata):
    sa.Table('accounts',
             metadata,
             sa.CheckConstraint('meaning_of_life = 42',
                                'meaning_of_life_correct'),
             extend_existing=True
             )
    return metadata


@ pytest.fixture()
def metadata_with_multi_column_check_constraint():
    metadata = sa.MetaData()
    sa.Table('t1', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('price', sa.Numeric(),
                       nullable=False),
             sa.Column('discounted_price', sa.Numeric(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "id", name="t1_pkey",
             ),
             # we don't do inline constraints in columns because it's harder to test since it ends up being converted from schema column constraints
             # to db table constraints which are harder to figure out so we just do everything
             # like this because easier to programmatically confirm they're the same
             sa.CheckConstraint('price > 0', 'positive_price'),
             sa.CheckConstraint('discounted_price > 0',
                                'positive_discounted_price'),
             sa.CheckConstraint('discounted_price > price', 'price_check'),
             )
    return metadata


@ pytest.fixture
def metadata_with_foreign_key_to_same_table(request):
    return _metadata_assoc_edge_config(request)


@ pytest.fixture
@ pytest.mark.usefixtures("metadata_with_table")
def metadata_with_two_tables(metadata_with_table):
    messages_table(metadata_with_table)
    return metadata_with_table


@ pytest.fixture
@ pytest.mark.usefixtures("metadata_with_table")
def metadata_with_foreign_key(metadata_with_table):
    contacts_table(metadata_with_table)
    return metadata_with_table


def _metadata_assoc_edge_config(request):
    metadata = sa.MetaData()
    assoc_edge_config_table(metadata, request)
    return metadata


@ pytest.fixture
def metadata_with_assoc_edge_config(request):
    return _metadata_assoc_edge_config(request)


@ pytest.fixture
def metadata_with_no_edges(request):
    metadata = _metadata_assoc_edge_config(request)
    metadata.info["edges"] = {}
    return metadata


# hardcoded so that we don't create new values with each call
# inverse edge is created each time tho because we don't need to hardcode it
FOLLOWERS_EDGE = uuid.UUID('afff1bc5-aa09-406b-b146-687b6217239b')


@ pytest.fixture
def metadata_with_one_edge(request):
    edge_type = 1
    if postgres_dialect_from_request(request):
        edge_type = FOLLOWERS_EDGE

    metadata = _metadata_assoc_edge_config(request)
    # 1 edge, no inverse
    edges = {
        'public': {
            'UserToFollowersEdge': user_to_followers_edge(edge_type),
        }
    }

    metadata.info["edges"] = edges
    return metadata


@ pytest.fixture
def metadata_with_symmetric_edge(request):
    edge_type = 10
    if postgres_dialect_from_request(request):
        edge_type = uuid.uuid4()

    metadata = _metadata_assoc_edge_config(request)
    # 1 edge, no inverse
    edges = {
        'public': {
            'UserToFriendsEdge': {
                'edge_name': 'UserToFriendsEdge',
                'edge_type': edge_type,
                'symmetric_edge': True,
                'edge_table': 'user_friends_edge',
            }
        }
    }

    metadata.info["edges"] = edges
    return metadata


@ pytest.fixture
def metadata_with_inverse_edge(request):
    # 2 edges, inverse of each other
    followers_edge = 1
    followees_edge = 2
    if postgres_dialect_from_request(request):
        followers_edge = FOLLOWERS_EDGE
        followees_edge = uuid.uuid4()

    metadata = _metadata_assoc_edge_config(request)
    edges = {
        'public': {
            'UserToFollowersEdge': user_to_followers_edge(followers_edge, inverse_edge_type=followees_edge),
            'UserToFolloweesEdge': users_to_followees_edge(followees_edge, inverse_edge_type=followers_edge),
        }
    }

    metadata.info["edges"] = edges
    return metadata


def default_enum_values():
    return ['open', 'pending', 'closed']


def status_table_info(l):
    return {
        'pkeys': ['status'],
        'rows': [{'status': v} for v in l]
    }


@ pytest.fixture
def metadata_with_request_data():
    metadata = metdata_enum_table()
    data = {
        'public': {
            'request_statuses': status_table_info(default_enum_values())
        }
    }
    metadata.info["data"] = data
    return metadata


def metadata_with_row_removed(metadata):
    enums = default_enum_values()
    enums.remove('open')

    data = {
        'public': {
            'request_statuses': status_table_info(enums)
        }
    }
    metadata.info["data"] = data
    return metadata


def metadata_with_rows_added(metadata):
    enums = default_enum_values()
    enums.remove('open')  # putting this here since done from above
    enums.append('initial')  # e.g. open -> initial
    enums.append('reviewed')

    data = {
        'public': {
            'request_statuses': status_table_info(enums)
        }
    }
    metadata.info["data"] = data
    return metadata


@ pytest.fixture
def metadata_with_multiple_data_tables():
    metadata = metdata_enum_table()
    complex_enum_table(metadata)

    data = {
        'public': {
            'request_statuses': status_table_info(default_enum_values()),
            'rainbows': {
                'pkeys': ['color'],
                'rows': [
                    {'color': 'red', 'description': "Red"},
                    {'color': 'orange', 'description': "Orange"},
                    {'color': 'yellow', 'description': "Yellow"},
                    {'color': 'green', 'description': "Green"},
                    {'color': 'blue', 'description': "Blue"},
                    {'color': 'indigo', 'description': "Indigo"},
                    {'color': 'violet', 'description': "Violet"},
                ]
            }
        }
    }
    metadata.info["data"] = data
    return metadata


def metadata_with_rainbows_enum_changed(metadata):
    data = metadata.info['data']
    rows = data['public']['rainbows']['rows']
    rows[3]['description'] = 'Really Green'
    rows[4]['description'] = 'Navy Blue'

    return metadata


def metdata_enum_table():
    metadata = sa.MetaData()
    enum_table(metadata)
    return metadata


def enum_table(metadata):
    sa.Table('request_statuses', metadata,
             sa.Column('status', sa.String(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "status", name="request_status_pkey"),
             )


def complex_enum_table(metadata):
    sa.Table('rainbows', metadata,
             sa.Column('color', sa.String(), nullable=False),
             sa.Column('description', sa.String(), nullable=False),
             sa.PrimaryKeyConstraint('color', name='rainbows_color_pkey')
             )


def roles_table(metadata):
    sa.Table('roles', metadata,
             sa.Column('role', sa.String(), nullable=False),
             sa.PrimaryKeyConstraint('role', name='roles_role_pkey'))


def group_members_table(metadata):
    sa.Table('group_members', metadata,
             sa.Column('group_id', sa.Integer(), nullable=False),
             sa.Column('user_id', sa.Integer(), nullable=False),
             sa.Column('role', sa.String(), nullable=False),
             sa.Column('data', sa.Text(), nullable=True),
             # triple primary key!
             # with a foreign key also
             sa.PrimaryKeyConstraint(
                 'group_id', 'user_id', 'role', name='group_member_roles_pkey'),
             sa.ForeignKeyConstraint(['role'], [
                                     'roles.role'], name="roles_role_fkey", ondelete="CASCADE"),
             )


def roles_table_info():
    return {
        'pkeys': ['role'],
        'rows': [{'role': v} for v in ['admin', 'member', 'archived_member']]
    }


@ pytest.fixture()
def metadata_with_triple_pkey():
    metadata = sa.MetaData()
    roles_table(metadata)
    group_members_table(metadata)

    data = {
        'public': {
            'roles': roles_table_info(),
            'group_members': {
                'pkeys': ['group_id', 'user_id', 'role'],
                'rows': [
                    {
                        'group_id': 1, 'user_id': 100, 'role': 'admin',
                    },
                    {
                        'group_id': 1, 'user_id': 200, 'role': 'member',
                    },
                    {
                        'group_id': 1, 'user_id': 200, 'role': 'admin',
                    },
                ]
            }
        }
    }
    metadata.info['data'] = data
    return metadata


def metadata_with_triple_pkey_with_rows_removed(metadata):
    data = {
        'public': {
            'roles': roles_table_info(),
            'group_members': {
                'pkeys': ['group_id', 'user_id', 'role'],
                'rows': [
                    {
                        'group_id': 1, 'user_id': 100, 'role': 'admin',
                    },
                    # remove everything with user 200
                ]
            }
        }
    }
    metadata.info['data'] = data

    return metadata


def metadata_with_triple_pkey_with_rows_changed(metadata):
    data = {
        'public': {
            'roles': roles_table_info(),
            'group_members': {
                'pkeys': ['group_id', 'user_id', 'role'],
                'rows': [
                    {
                        # add data which wasn't previously there
                        'group_id': 1, 'user_id': 100, 'role': 'admin', 'data': '123'
                    },
                ]
            }
        }
    }
    metadata.info['data'] = data

    return metadata


@ pytest.fixture
def metadata_with_enum_type():
    metadata = sa.MetaData()

    rainbow = ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')
    enum = postgresql.ENUM(*rainbow, name='rainbow_type')

    sa.Table('accounts', metadata,
             sa.Column('id', sa.Integer(), nullable=False),
             sa.Column('rainbow', enum, nullable=False),
             sa.PrimaryKeyConstraint("id", name='accounts_id_pkey'),
             )
    return metadata


def _apply_func_on_enum(metadata, fn):
    return _apply_func_on_metadata(metadata, 'rainbow', 'accounts', fn)


def metadata_with_new_enum_value(metadata_with_enum):
    def add_purple(col):
        col.type.enums.append('purple')
        return col

    return _apply_func_on_enum(metadata_with_enum, add_purple)


def metadata_with_enum_value_before_first_pos(metadata_with_enum):
    def insert_purple(col):
        col.type.enums.insert(0, 'purple')
        return col

    return _apply_func_on_enum(metadata_with_enum, insert_purple)


def metadata_with_multiple_new_values_before(metadata_with_enum):
    def insert_colors(col):
        col.type.enums.insert(2, 'purple')
        col.type.enums.insert(4, 'black')
        return col

    return _apply_func_on_enum(metadata_with_enum, insert_colors)


def metadata_with_multiple_new_enum_values(metadata_with_enum):
    def append_colors(col):
        col.type.enums.append('purple')
        col.type.enums.append('black')
        return col

    return _apply_func_on_enum(metadata_with_enum, append_colors)


def metadata_with_multiple_new_enum_values_at_diff_pos(metadata_with_enum):
    def change_colors(col):
        col.type.enums.insert(3, 'purple')
        col.type.enums.append('black')
        return col

    return _apply_func_on_enum(metadata_with_enum, change_colors)


def metadata_with_removed_enum_value(metadata_with_enum):
    def remove_color(col):
        col.type.enums.remove('green')
        return col

    return _apply_func_on_enum(metadata_with_enum, remove_color)


def metadata_with_removed_column():
    changes = default_children_of_table()

    cols = [c for c in changes if isinstance(
        c, sa.Column) and c.name == 'meaning_of_life']
    col = cols[0]
    changes.remove(col)

    metadata = sa.MetaData()
    sa.Table('accounts', metadata,
             *changes,
             )
    return metadata


def metadata_with_new_enum_column():
    changes = default_children_of_table()

    rainbow = ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')
    enum = postgresql.ENUM(*rainbow, name='rainbow_type')

    changes.append(
        sa.Column('rainbow', enum, nullable=False)
    )
    metadata = sa.MetaData()
    sa.Table('accounts', metadata,
             *changes,
             )

    return metadata


def user_to_followers_edge(edge_type, inverse_edge_type=None):
    return {
        'edge_name': 'UserToFollowersEdge',
        'edge_type': edge_type,
        'edge_table': 'user_followers_edge',
        'symmetric_edge': False,
        'inverse_edge_type': inverse_edge_type,
    }


def users_to_followees_edge(edge_type, inverse_edge_type=None):
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
             sa.ForeignKeyConstraint(['account_id'], [
                                     'accounts.id'], name="contacts_account_id_fkey", ondelete="CASCADE"),
             )


# this is the structure that's automatically created by ent
# TODO: should test this so that if the generation changes, we catch this
# need an integration test of some sort
# this doesn't quite match because i'm doing integer instead of uuid
# todo: one postgres test with uuid
def assoc_edge_config_table(metadata, request):
    edge_type_col = sa.Integer()
    if postgres_dialect_from_request(request):
        edge_type_col = postgresql.UUID()

    sa.Table('assoc_edge_config', metadata,
             sa.Column('edge_type', edge_type_col, nullable=False,
                       sqlite_on_conflict_primary_key='IGNORE'),
             sa.Column('edge_name', sa.Text(), nullable=False),
             # use false instead of FALSE to avoid the need for craziness here
             sa.Column('symmetric_edge', sa.Boolean(),
                       nullable=False, server_default='false'),
             sa.Column('inverse_edge_type', edge_type_col, nullable=True),
             sa.Column('edge_table', sa.Text(), nullable=False),
             sa.Column('created_at', sa.TIMESTAMP(), nullable=False),
             sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "edge_type", name="assoc_edge_config_edge_type_pkey"),
             sa.ForeignKeyConstraint(['inverse_edge_type'], ['assoc_edge_config.edge_type'],
                                     name="assoc_edge_config_inverse_edge_type_fkey", ondelete="RESTRICT"),
             )
