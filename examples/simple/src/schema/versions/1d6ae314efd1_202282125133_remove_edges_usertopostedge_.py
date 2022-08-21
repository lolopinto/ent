# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""remove edges UserToPostEdge, UserToUserToHostedEventsEdge

Revision ID: 1d6ae314efd1
Revises: 3ff8496dfdb9
Create Date: 2022-08-21 02:51:33.527001+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '1d6ae314efd1'
down_revision = '3ff8496dfdb9'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.remove_edges([
        {'edge_type': 'e5555185-91bf-4322-8130-d0a00eb605b7', 'edge_name': 'UserToUserToHostedEventsEdge',
            'symmetric_edge': False, 'inverse_edge_type': 'ebe3e709-845c-4723-ac9c-29f983f2b8ea', 'edge_table': 'event_hosts_edges'},
        {'edge_type': '4b725578-e9f5-472c-8e57-e47481c9e1b8', 'edge_name': 'UserToPostEdge', 'symmetric_edge': False,
            'inverse_edge_type': '8caba9c4-8035-447f-9eb1-4dd09a2d250c', 'edge_table': 'object_comments_edges'},
    ])

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_edges([
        {'edge_type': 'e5555185-91bf-4322-8130-d0a00eb605b7', 'edge_name': 'UserToUserToHostedEventsEdge',
            'symmetric_edge': False, 'inverse_edge_type': 'ebe3e709-845c-4723-ac9c-29f983f2b8ea', 'edge_table': 'event_hosts_edges'},
        {'edge_type': '4b725578-e9f5-472c-8e57-e47481c9e1b8', 'edge_name': 'UserToPostEdge', 'symmetric_edge': False,
            'inverse_edge_type': '8caba9c4-8035-447f-9eb1-4dd09a2d250c', 'edge_table': 'object_comments_edges'},
    ])

    # ### end Alembic commands ###
