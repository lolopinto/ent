# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""add index event_time_indices to events

Revision ID: 2ac3ae2f7d33
Revises: d6647e96ccb9
Create Date: 2023-03-14 21:50:39.366380+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '2ac3ae2f7d33'
down_revision = 'd6647e96ccb9'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_index('event_time_indices', 'events', [
                    'start_time', 'end_time'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('event_time_indices', table_name='events')
    # ### end Alembic commands ###
