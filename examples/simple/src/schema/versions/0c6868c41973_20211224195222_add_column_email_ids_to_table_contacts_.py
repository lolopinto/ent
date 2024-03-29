# Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

"""add column email_ids to table contacts
add column phone_number_ids to table contacts
drop column email_address from table contacts

Revision ID: 0c6868c41973
Revises: 92217f34d33b
Create Date: 2021-12-24 19:52:22.003748+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0c6868c41973'
down_revision = '92217f34d33b'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('contacts', sa.Column(
        'email_ids', postgresql.ARRAY(postgresql.UUID()), nullable=False))
    op.add_column('contacts', sa.Column('phone_number_ids',
                                        postgresql.ARRAY(postgresql.UUID()), nullable=False))
    op.drop_column('contacts', 'email_address')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('contacts', sa.Column('email_address',
                                        sa.TEXT(), autoincrement=False, nullable=False))
    op.drop_column('contacts', 'phone_number_ids')
    op.drop_column('contacts', 'email_ids')
    # ### end Alembic commands ###
