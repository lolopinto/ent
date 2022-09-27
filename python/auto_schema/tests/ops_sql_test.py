from datetime import datetime
from auto_schema import ops
from unittest import mock

from . import conftest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
import io


def format_insert_stmt(obj, stmt):
    postgres = "Postgres" in type(obj).__name__
    if postgres:
        return stmt + " ON CONFLICT DO NOTHING;"
    return stmt + ";"


def validate_op(new_test_runner, get_op, sql):
    r = new_test_runner(sa.MetaData())
    f = io.StringIO()

    mc = MigrationContext.configure(
        connection=r.connection,
        opts={
            'as_sql': True,
            'output_buffer': f,
        }
    )
    operations = Operations(mc)
    get_op(operations)

    if not isinstance(sql, list):
        sql = [sql]

    values = f.getvalue().strip().split("\n\n")
    assert len(values) == len(sql)
    for v, exp in zip(values, sql):
        assert v == exp


def date_value(obj):
    postgres = "Postgres" in type(obj).__name__
    if postgres:
        return "now() AT TIME ZONE 'UTC'"
    else:
        return 'datetime()'


class OpsTest(object):
    def test_add_single_edge(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AddEdgesOp.add_edges(
                operations,
                [{
                    'edge_name': 'UserToFriendsEdge',
                    'edge_type': 1,
                    'symmetric_edge': True,
                    'edge_table': 'user_friends_edge',
                }]
            ),
            format_insert_stmt(
                self,
                "INSERT INTO assoc_edge_config(edge_name, edge_type, symmetric_edge, edge_table, created_at, updated_at) VALUES('UserToFriendsEdge', 1, true, 'user_friends_edge', %s, %s)" % (
                    date_value(self),
                    date_value(self),
                )
            )
        )

    def test_add_multiple_edges(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AddEdgesOp.add_edges(
                operations,
                [
                    {
                        'edge_name': 'UserToFriendsEdge',
                        'edge_type': 1,
                        'symmetric_edge': True,
                        'edge_table': 'user_friends_edge',
                    },
                    {
                        'edge_name': 'UserToFollowersEdge',
                        'edge_type': 2,
                        'symmetric_edge': False,
                        'edge_table': 'user_followers_edge',
                    },
                ]
            ),
            format_insert_stmt(
                self,
                "INSERT INTO assoc_edge_config(edge_name, edge_type, symmetric_edge, edge_table, created_at, updated_at) " +
                "VALUES" +
                "('UserToFriendsEdge', 1, true, 'user_friends_edge', %s, %s)" % (
                    date_value(self), date_value(self)
                ) +
                ",\n" +
                "('UserToFollowersEdge', 2, false, 'user_followers_edge', %s, %s)" % (
                    date_value(self), date_value(self)
                )
            )
        )

    def test_add_with_inverse(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AddEdgesOp.add_edges(
                operations,
                [
                    {
                        'edge_name': 'UserToFollowersEdge',
                        'edge_type': 1,
                        'symmetric_edge': False,
                        'inverse_edge_type': 2,
                        'edge_table': 'user_followers_edge',
                    },
                    {
                        'edge_name': 'UserToFolloweesEdge',
                        'edge_type': 2,
                        'symmetric_edge': False,
                        'inverse_edge_Type': 1,
                        'edge_table': 'user_followees_edge',
                    },
                ]
            ),
            format_insert_stmt(
                self,
                "INSERT INTO assoc_edge_config(edge_name, edge_type, symmetric_edge, inverse_edge_type, edge_table, created_at, updated_at) " +
                "VALUES" +
                "('UserToFollowersEdge', 1, false, 2, 'user_followers_edge', %s, %s)" % (
                    date_value(self), date_value(self)
                ) +
                ",\n" +
                "('UserToFolloweesEdge', 2, false, 1, 'user_followees_edge', %s, %s)" % (
                    date_value(self), date_value(self)
                )
            )
        )

    def test_delete_single_edge(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.RemoveEdgesOp.remove_edges(
                operations,
                [{
                    'edge_name': 'UserToFriendsEdge',
                    'edge_type': 1,
                    'symmetric_edge': True,
                    'edge_table': 'user_friends_edge',
                }]
            ),
            "DELETE FROM assoc_edge_config WHERE edge_type = 1;"
        )

    def test_delete_multiple_edges(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.RemoveEdgesOp.remove_edges(
                operations,
                [
                    {
                        'edge_name': 'UserToFriendsEdge',
                        'edge_type': 1,
                        'symmetric_edge': True,
                        'edge_table': 'user_friends_edge',
                    },
                    {
                        'edge_name': 'UserToFollowersEdge',
                        'edge_type': 2,
                        'symmetric_edge': False,
                        'edge_table': 'user_followers_edge',
                    },
                ]
            ),
            "DELETE FROM assoc_edge_config WHERE edge_type IN (1, 2);"
        )

    def test_modify_edge(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.ModifyEdgeOp.modify_edge(
                operations,
                1,
                {
                    'edge_name': 'UserToFriendsEdge',
                    'edge_type': 1,
                    'symmetric_edge': True,
                    'edge_table': 'user_friends_edge',
                },
            ),
            "UPDATE assoc_edge_config SET edge_name = 'UserToFriendsEdge', edge_type = 1, symmetric_edge = true, edge_table = 'user_friends_edge', updated_at = %s WHERE edge_type = 1;" % date_value(
                self)
        )

    def test_add_rows(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AddRowsOp.add_rows(
                operations,
                'requests',
                ['status'],
                [
                    {
                        'status': 'open',
                    },
                    {
                        'status': 'pending',
                    },
                    {
                        'status': 'closed',
                    }
                ],
            ),
            "INSERT INTO requests(status) VALUES('open'),\n('pending'),\n('closed');",
        )

    def test_remove_rows_one(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.RemoveRowsOp.remove_rows(
                operations,
                'requests',
                ['status'],
                [
                    {
                        'status': 'open',
                    },
                ],
            ),
            "DELETE FROM requests WHERE status = 'open';",
        )

    def test_remove_rows_multiple(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.RemoveRowsOp.remove_rows(
                operations,
                'requests',
                ['status'],
                [
                    {
                        'status': 'open',
                    },
                    {
                        'status': 'pending',
                    },
                ],
            ),
            "DELETE FROM requests WHERE status IN ('open', 'pending');",
        )

    def test_remove_rows_multiple_pkeys(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.RemoveRowsOp.remove_rows(
                operations,
                'group_members',
                ['group_id', 'user_id', 'role'],
                [
                    {
                        'group_id': 1, 'user_id': 100, 'role': 'admin',
                    },
                ],
            ),
            "DELETE FROM group_members WHERE group_id = 1 AND user_id = 100 AND role = 'admin';",
        )

    def test_remove_rows_multiple_pkeys_mult_rows(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.RemoveRowsOp.remove_rows(
                operations,
                'group_members',
                ['group_id', 'user_id', 'role'],
                [
                    {
                        'group_id': 1, 'user_id': 100, 'role': 'admin',
                    },
                    {
                        'group_id': 1, 'user_id': 200, 'role': 'member',
                    },
                    {
                        'group_id': 1, 'user_id': 200, 'role': 'admin',
                    },
                ],
            ),
            [
                "DELETE FROM group_members WHERE group_id = 1 AND user_id = 100 AND role = 'admin';",
                "DELETE FROM group_members WHERE group_id = 1 AND user_id = 200 AND role = 'member';",
                "DELETE FROM group_members WHERE group_id = 1 AND user_id = 200 AND role = 'admin';",
            ]
        )

    def test_modify_rows(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.ModifyRowsOp.modify_rows(
                operations,
                'group_members',
                ['group_id', 'user_id', 'role'],
                [
                    {
                        'group_id': 1, 'user_id': 100, 'role': 'admin', 'data': 123,
                    },
                ],
                # TODO we should use old_rows
                [],
            ),
            "UPDATE group_members SET group_id = 1, user_id = 100, role = 'admin', data = 123 WHERE group_id = 1 AND user_id = 100 AND role = 'admin';",
        )

    def test_modify_rows_multiple_rows(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.ModifyRowsOp.modify_rows(
                operations,
                'group_members',
                ['group_id', 'user_id', 'role'],
                [
                    {
                        'group_id': 1, 'user_id': 100, 'role': 'admin', 'data': 123,
                    },
                    {
                        'group_id': 1, 'user_id': 200, 'role': 'member', 'data': 345,
                    },
                    {
                        'group_id': 1, 'user_id': 200, 'role': 'admin', 'data': 534,
                    },
                ],
                # TODO we should use old_rows
                [],
            ),
            [
                "UPDATE group_members SET group_id = 1, user_id = 100, role = 'admin', data = 123 WHERE group_id = 1 AND user_id = 100 AND role = 'admin';",
                "UPDATE group_members SET group_id = 1, user_id = 200, role = 'member', data = 345 WHERE group_id = 1 AND user_id = 200 AND role = 'member';",
                "UPDATE group_members SET group_id = 1, user_id = 200, role = 'admin', data = 534 WHERE group_id = 1 AND user_id = 200 AND role = 'admin';",
            ]
        )


class TestPostgres(OpsTest):
    def test_create_enum(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AddEnumOp.add_enum_type(
                operations, 'rainbow', [
                    'red',
                    'orange',
                    'yellow',
                    'green',
                    'blue',
                    'indigo',
                    'violet']),
            "CREATE TYPE rainbow AS ENUM ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet');"
        )

    def test_drop_enum(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.DropEnumOp.drop_enum_type(
                operations, 'rainbow', [
                    'red',
                    'orange',
                    'yellow',
                    'green',
                    'blue',
                    'indigo',
                    'violet']),
            "DROP TYPE rainbow;"
        )

    def test_alter_enum(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AlterEnumOp.alter_enum(
                operations, 'rainbow', 'purple'
            ),
            "ALTER TYPE rainbow ADD VALUE 'purple';"
        )

    def test_alter_enum_before(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.AlterEnumOp.alter_enum(
                operations, 'rainbow', 'purple',
                before='yellow'
            ),
            "ALTER TYPE rainbow ADD VALUE 'purple' BEFORE 'yellow';"
        )

    def test_create_full_text_index(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.CreateFullTextIndexOp.create_full_text_index(
                operations,
                'full_text_idx',
                'users',
                info={
                    'postgresql_using': 'gin',
                    'postgresql_using_internals': 'fullname'
                },
            ),
            'CREATE INDEX full_text_idx ON users USING gin (fullname);'
        )

    def test_create_full_text_index_complicated(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.CreateFullTextIndexOp.create_full_text_index(
                operations,
                'full_text_idx',
                'users',
                info={
                    'postgresql_using': 'gin',
                    'postgresql_using_internals': "to_tsvector('english', first_name)"
                },
            ),
            "CREATE INDEX full_text_idx ON users USING gin (to_tsvector('english', first_name));"
        )

    def test_drop_full_text_index(self, new_test_runner):
        validate_op(
            new_test_runner,
            lambda operations:
            ops.DropFullTextIndexOp.drop_full_text_index(
                operations,
                'full_text_idx',
                'users',
                info={
                    'postgresql_using': 'gin',
                    'postgresql_using_internals': 'fullname'
                },
            ),
            'DROP INDEX full_text_idx;'
        )


class TestSQLite(OpsTest):
    pass
