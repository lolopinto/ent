# Code generated by github.com/lolopinto/ent/ent, DO NOT edit. 

"""add edge ContactToSelfContactForUserEdge
modify edge UserToSelfContactEdge

Revision ID: 2d2537e44009
Revises: efb5231162ba
Create Date: 2024-02-25 20:53:09.478801+00:00

"""
from alembic import op #noqa


# revision identifiers, used by Alembic.
revision = '2d2537e44009'
down_revision = 'efb5231162ba'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_edges([
    {'edge_name': 'ContactToSelfContactForUserEdge', 'edge_type': '71483ce5-06f3-4468-bf05-afecd3a430e2', 'edge_table': 'user_self_contact_edges', 'symmetric_edge': False, 'inverse_edge_type': 'd504201d-cf3f-4eef-b6a0-0b46a7ae186b'},
    ])

    op.modify_edge(
    'd504201d-cf3f-4eef-b6a0-0b46a7ae186b',
    {'edge_name': 'UserToSelfContactEdge', 'edge_type': 'd504201d-cf3f-4eef-b6a0-0b46a7ae186b', 'edge_table': 'user_self_contact_edges', 'symmetric_edge': False, 'inverse_edge_type': '71483ce5-06f3-4468-bf05-afecd3a430e2'},

    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.modify_edge(
    'd504201d-cf3f-4eef-b6a0-0b46a7ae186b',
    {'edge_type': 'd504201d-cf3f-4eef-b6a0-0b46a7ae186b', 'edge_name': 'UserToSelfContactEdge', 'symmetric_edge': False, 'inverse_edge_type': None, 'edge_table': 'user_self_contact_edges'},

    )
    op.remove_edges([
    {'edge_name': 'ContactToSelfContactForUserEdge', 'edge_type': '71483ce5-06f3-4468-bf05-afecd3a430e2', 'edge_table': 'user_self_contact_edges', 'symmetric_edge': False, 'inverse_edge_type': 'd504201d-cf3f-4eef-b6a0-0b46a7ae186b'},
    ])

    # ### end Alembic commands ###