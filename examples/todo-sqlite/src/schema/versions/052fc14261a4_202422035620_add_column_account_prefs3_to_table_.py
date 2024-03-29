# Code generated by github.com/lolopinto/ent/ent, DO NOT edit. 

"""add column account_prefs3 to table accounts
drop column account_prefs_3 from table accounts

Revision ID: 052fc14261a4
Revises: f1f2638506ca
Create Date: 2024-02-20 03:56:20.905341+00:00

"""
from alembic import op #noqa
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '052fc14261a4'
down_revision = 'f1f2638506ca'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('accounts', sa.Column('account_prefs3', sa.Text(), server_default='{"finished_nux":false,"enable_notifs":false,"preferred_language":"en_US"}', nullable=False))
    op.drop_column('accounts', 'account_prefs_3')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('accounts', sa.Column('account_prefs_3', sa.TEXT(), server_default=sa.text('\'{"finished_nux"NULL,"enable_notifs"NULL,"preferred_language":"en_US"}\''), nullable=False))
    op.drop_column('accounts', 'account_prefs3')
    # ### end Alembic commands ###
