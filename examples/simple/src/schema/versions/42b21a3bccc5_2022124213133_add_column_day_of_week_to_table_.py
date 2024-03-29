# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""add column day_of_week to table holidays
add column day_of_week_alt to table holidays

Revision ID: 42b21a3bccc5
Revises: a5184ce57a3b
Create Date: 2022-01-24 21:31:33.894567+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '42b21a3bccc5'
down_revision = 'a5184ce57a3b'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('holidays', sa.Column(
        'day_of_week', sa.Text(), nullable=False))
    op.add_column('holidays', sa.Column(
        'day_of_week_alt', sa.Text(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('holidays', 'day_of_week_alt')
    op.drop_column('holidays', 'day_of_week')
    # ### end Alembic commands ###
