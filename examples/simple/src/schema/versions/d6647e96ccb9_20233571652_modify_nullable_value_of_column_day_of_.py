# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""modify nullable value of column day_of_week_alt from True to False

Revision ID: d6647e96ccb9
Revises: d8a7c0c65d36
Create Date: 2023-03-05 07:16:52.988041+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd6647e96ccb9'
down_revision = 'd8a7c0c65d36'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('holidays', 'day_of_week_alt',
                    existing_type=sa.TEXT(),
                    nullable=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('holidays', 'day_of_week_alt',
                    existing_type=sa.TEXT(),
                    nullable=True)
    # ### end Alembic commands ###
