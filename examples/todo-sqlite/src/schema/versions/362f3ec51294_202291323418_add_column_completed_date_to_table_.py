# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""add column completed_date to table todos
add index todos_completed_date_idx to todos

Revision ID: 362f3ec51294
Revises: 4525b9665334
Create Date: 2022-09-13 23:41:08.090645+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '362f3ec51294'
down_revision = '4525b9665334'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('todos', sa.Column(
        'completed_date', sa.TIMESTAMP(), nullable=True))
    op.create_index('todos_completed_date_idx', 'todos',
                    ['completed_date'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('todos_completed_date_idx', table_name='todos')
    op.drop_column('todos', 'completed_date')
    # ### end Alembic commands ###
