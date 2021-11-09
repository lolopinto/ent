# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""add comments table
add edge CommentToPostEdge
modify edge ObjectToCommentsEdge

Revision ID: 810b35739813
Revises: cc022c10fa00
Create Date: 2021-09-21 07:03:16.369618+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '810b35739813'
down_revision = 'cc022c10fa00'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('comments',
                    sa.Column('id', postgresql.UUID(), nullable=False),
                    sa.Column('created_at', sa.TIMESTAMP(), nullable=False),
                    sa.Column('updated_at', sa.TIMESTAMP(), nullable=False),
                    sa.Column('author_id', postgresql.UUID(), nullable=False),
                    sa.Column('body', sa.Text(), nullable=False),
                    sa.PrimaryKeyConstraint('id', name='comments_id_pkey')
                    )
    op.add_edges([
        {'edge_name': 'CommentToPostEdge', 'edge_type': 'f430af94-d38a-4aaa-a92f-cfc56b6f811b', 'edge_table': 'object_comments_edges',
            'symmetric_edge': False, 'inverse_edge_type': '8caba9c4-8035-447f-9eb1-4dd09a2d250c'},
    ])

    op.modify_edge(
        '8caba9c4-8035-447f-9eb1-4dd09a2d250c',
        {'edge_name': 'ObjectToCommentsEdge', 'edge_type': '8caba9c4-8035-447f-9eb1-4dd09a2d250c',
            'edge_table': 'object_comments_edges', 'symmetric_edge': False, 'inverse_edge_type': 'f430af94-d38a-4aaa-a92f-cfc56b6f811b'},

    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.modify_edge(
        '8caba9c4-8035-447f-9eb1-4dd09a2d250c',
        {'edge_type': '8caba9c4-8035-447f-9eb1-4dd09a2d250c', 'edge_name': 'ObjectToCommentsEdge', 'symmetric_edge': False,
         'inverse_edge_type': '4b725578-e9f5-472c-8e57-e47481c9e1b8', 'edge_table': 'object_comments_edges'},

    )
    op.remove_edges([
        {'edge_name': 'CommentToPostEdge', 'edge_type': 'f430af94-d38a-4aaa-a92f-cfc56b6f811b', 'edge_table': 'object_comments_edges',
            'symmetric_edge': False, 'inverse_edge_type': '8caba9c4-8035-447f-9eb1-4dd09a2d250c'},
    ])

    op.drop_table('comments')
    # ### end Alembic commands ###
