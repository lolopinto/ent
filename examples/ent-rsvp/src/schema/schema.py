# Code generated by github.com/lolopinto/ent/ent, DO NOT edit. (TODO figure out correct pythonic way of doing this)

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

metadata = sa.MetaData()

 
sa.Table("event_activities", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.Column("start_time", sa.TIMESTAMP(), nullable=False),
    sa.Column("end_time", sa.TIMESTAMP(), nullable=True),
    sa.Column("location", sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="event_activities_id_pkey"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="event_activities_event_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("events", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("creator_id", postgresql.UUID(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="events_id_pkey"),
    sa.ForeignKeyConstraint(["creator_id"], ["users.id"], name="events_creator_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("guest_groups", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("invitation_name", sa.Text(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="guest_groups_id_pkey"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="guest_groups_event_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("guests", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("first_name", sa.Text(), nullable=False),
    sa.Column("last_name", sa.Text(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.Column("guest_group_id", postgresql.UUID(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="guests_id_pkey"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="guests_event_id_fkey", ondelete="CASCADE"),
    sa.ForeignKeyConstraint(["guest_group_id"], ["guest_groups.id"], name="guests_guest_group_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("users", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("first_name", sa.Text(), nullable=False),
    sa.Column("last_name", sa.Text(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="users_id_pkey"),
    sa.UniqueConstraint("email_address", name="users_unique_email_address"),
)
  

metadata.info["edges"] = {
  'public': {
  }
}



def get_metadata():
  return metadata
