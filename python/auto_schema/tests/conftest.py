import os
import pytest
import shutil
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.dialects import postgresql

import sqlalchemy as sa

from auto_schema import runner


class Postgres:
    def get_url(self, _schema_path):
        return "postgresql://localhost/autoschema_test"

    def get_finalizer(self, metadata, session, connection, transaction, engine):
        def fn():
            session.close()
            metadata.reflect()
            metadata.drop_all(bind=connection)
            # need to commit because we sometimes commit separately because of alter type ddls
            transaction.commit()

            # get any newly added enum types and drop it
            # \dT not working :(
            for row in connection.execute("select distinct pg_type.typname as enumtype from pg_type join pg_enum on pg_enum.enumtypid = pg_type.oid;"):
                connection.execute('drop type %s' % row['enumtype'])

        return fn


class SQLite:
    def get_url(self, schema_path):
        return "sqlite:///%s/%s" % (schema_path, "foo.db")
        # return "sqlite:///bar.db"  # if you want a local file to inspect for whatever reason

    def get_finalizer(self, metadata, session, connection, transaction, engine):
        def fn():
            session.close()
            transaction.rollback()
            connection.close()

        return fn


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
        if "Postgres" in request.cls.__name__:
            dialect = Postgres()
        else:
            dialect = SQLite()

        # reuse connection if not None. same logic as schema_path above
        if prev_runner is None:
            engine = create_engine(dialect.get_url(schema_path))
            connection = engine.connect()
            metadata.bind = connection
            transaction = connection.begin()
            session = Session(bind=connection)

            request.addfinalizer(dialect.get_finalizer(
                metadata, session, connection, transaction, engine))
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


def metadata_with_unique_constraint_added(metadata):
    return _add_constraint_to_metadata(
        metadata,    # and then unique constraint added afterwards
        sa.UniqueConstraint(
            "email_address", name="accounts_unique_email_address"),
    )


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
    return _add_constraint_to_metadata(
        metadata_with_table,
        # index the first name because we support searching for some reason
        sa.Index("accounts_first_name_idx", "first_name"),
    )


def metadata_with_multi_column_index(metadata_with_table):
    return _add_constraint_to_metadata(
        metadata_with_table,
        # index the first and last name because we support searching by that
        sa.Index("accounts_first_name_last_name_idx",
                 "first_name", "last_name"),
    )


@pytest.fixture
def metadata_with_multi_column_pkey_constraint():
    metadata = sa.MetaData()
    sa.Table('user_friends_edge', metadata,
             sa.Column('id1', sa.Integer(), nullable=False),
             sa.Column('id1_type', sa.Text(), nullable=False),
             sa.Column('edge_type', sa.Integer(), nullable=False),
             sa.Column('id2', sa.Integer(), nullable=False),
             sa.Column('id2_type', sa.Text(), nullable=False),
             sa.Column('time', sa.TIMESTAMP(), nullable=False),
             sa.Column('data', sa.Text(), nullable=True),
             sa.PrimaryKeyConstraint(
                 "id1", "edge_type", "id2", name="user_friends_edge_id1_edge_type_id2_pkey"),
             )
    return metadata


@pytest.fixture()
def metadata_with_multi_column_unique_constraint():
    metadata = metadata_with_contacts_table_with_no_unique_constraint()
    return _add_constraint_to_metadata(metadata,
                                       sa.UniqueConstraint(
                                           "email_address", "user_id", name="contacts_unique_email_per_contact"
                                       ), table_name='contacts'
                                       )


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


@pytest.fixture()
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


@pytest.fixture()
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


@pytest.fixture()
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
    return _add_constraint_to_metadata(
        metadata,
        sa.CheckConstraint('meaning_of_life = 42', 'meaning_of_life_correct'),
    )


@pytest.fixture()
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
    metadata.info["edges"] = {}
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

    metadata.info["edges"] = edges
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

    metadata.info["edges"] = edges
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

    metadata.info["edges"] = edges
    return metadata


def default_enum_values():
    return ['open', 'pending', 'closed']


def status_table_info(l):
    return {
        'pkeys': ['status'],
        'rows': [{'status': v} for v in l]
    }


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture()
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


@pytest.fixture
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


def user_to_followers_edge(edge_type=1, inverse_edge_type=None):
    return {
        'edge_name': 'UserToFollowersEdge',
        'edge_type': edge_type,
        'edge_table': 'user_followers_edge',
        'symmetric_edge': False,
        'inverse_edge_type': inverse_edge_type,
    }


def users_to_followees_edge(edge_type=2, inverse_edge_type=None):
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
def assoc_edge_config_table(metadata):
    sa.Table('assoc_edge_config', metadata,
             sa.Column('edge_type', sa.Integer(), nullable=False),
             sa.Column('edge_name', sa.Text(), nullable=False),
             # use false instead of FALSE to avoid the need for craziness here
             sa.Column('symmetric_edge', sa.Boolean(),
                       nullable=False, server_default='false'),
             sa.Column('inverse_edge_type', sa.Integer(), nullable=True),
             sa.Column('edge_table', sa.Text(), nullable=False),
             sa.Column('created_at', sa.TIMESTAMP(), nullable=False),
             sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
             sa.PrimaryKeyConstraint(
                 "edge_type", name="assoc_edge_config_edge_type_pkey"),
             sa.ForeignKeyConstraint(['inverse_edge_type'], ['assoc_edge_config.edge_type'],
                                     name="assoc_edge_config_inverse_edge_type_fkey", ondelete="RESTRICT"),
             )


def _add_constraint_to_metadata(metadata, constraint, table_name="accounts"):
    tables = [t for t in metadata.sorted_tables if t.name == table_name]
    table = tables[0]

    table.append_constraint(constraint)
    return metadata
