# Code generated by github.com/lolopinto/ent/ent, DO NOT edit. (TODO figure out correct pythonic way of doing this)

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from auto_schema.schema_item import FullTextIndex

metadata = sa.MetaData()

 
sa.Table("addresses", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("street", sa.Text(), nullable=False),
    sa.Column("city", sa.Text(), nullable=False),
    sa.Column("state", sa.Text(), nullable=False),
    sa.Column("zip_code", sa.Text(), nullable=False),
    sa.Column("apartment", sa.Text(), nullable=True),
    sa.Column("owner_id", postgresql.UUID(), nullable=False),
    sa.Column("owner_type", sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="addresses_id_pkey"),
    sa.UniqueConstraint("owner_id", name="addresses_unique_owner_id"),
)
   
sa.Table("assoc_edge_config", metadata,
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("edge_name", sa.Text(), nullable=False),
    sa.Column("symmetric_edge", sa.Boolean(), nullable=False, server_default='false'),
    sa.Column("inverse_edge_type", postgresql.UUID(), nullable=True),
    sa.Column("edge_table", sa.Text(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.PrimaryKeyConstraint("edge_type", name="assoc_edge_config_edge_type_pkey"),
    sa.UniqueConstraint("edge_name", name="assoc_edge_config_unique_edge_name"),
    sa.ForeignKeyConstraint(["inverse_edge_type"], ["assoc_edge_config.edge_type"], name="assoc_edge_config_inverse_edge_type_fkey", ondelete="RESTRICT"),
)
   
sa.Table("auth_codes", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("code", sa.Text(), nullable=False),
    sa.Column("guest_id", postgresql.UUID(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.Column("sent_code", sa.Boolean(), nullable=False, server_default='FALSE'),
    sa.PrimaryKeyConstraint("id", name="auth_codes_id_pkey"),
    sa.UniqueConstraint("guest_id", name="auth_codes_unique_guest_id"),
    sa.ForeignKeyConstraint(["guest_id"], ["guests.id"], name="auth_codes_guest_id_fkey", ondelete="CASCADE"),
    sa.UniqueConstraint("email_address", "code", name="uniqueCode"),
)
   
sa.Table("event_activities", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("address_id", postgresql.UUID(), nullable=True),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.Column("start_time", sa.TIMESTAMP(), nullable=False),
    sa.Column("end_time", sa.TIMESTAMP(), nullable=True),
    sa.Column("location", sa.Text(), nullable=False),
    sa.Column("description", sa.Text(), nullable=True),
    sa.Column("invite_all_guests", sa.Boolean(), nullable=False, server_default='FALSE'),
    sa.Index("event_activities_event_id_idx", "event_id"),
    sa.PrimaryKeyConstraint("id", name="event_activities_id_pkey"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="event_activities_event_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("event_rsvps", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="event_rsvps_id1_edge_type_id2_pkey"),
    sa.Index("event_rsvps_time_idx", "time"),
)
   
sa.Table("events", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("slug", sa.Text(), nullable=True),
    sa.Column("creator_id", postgresql.UUID(), nullable=False),
    sa.Index("events_creator_id_idx", "creator_id"),
    sa.PrimaryKeyConstraint("id", name="events_id_pkey"),
    sa.UniqueConstraint("slug", name="events_unique_slug"),
    sa.ForeignKeyConstraint(["creator_id"], ["users.id"], name="events_creator_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("guest_data", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("guest_id", postgresql.UUID(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.Column("dietary_restrictions", sa.Text(), nullable=False),
    sa.Column("source", sa.Text(), nullable=True),
    sa.Index("guest_data_guest_id_idx", "guest_id"),
    sa.Index("guest_data_event_id_idx", "event_id"),
    sa.PrimaryKeyConstraint("id", name="guest_data_id_pkey"),
    sa.ForeignKeyConstraint(["guest_id"], ["guests.id"], name="guest_data_guest_id_fkey", ondelete="CASCADE"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="guest_data_event_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("guest_groups", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("invitation_name", sa.Text(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.Index("guest_groups_event_id_idx", "event_id"),
    sa.PrimaryKeyConstraint("id", name="guest_groups_id_pkey"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="guest_groups_event_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("guests", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("address_id", postgresql.UUID(), nullable=True),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("event_id", postgresql.UUID(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=True),
    sa.Column("guest_group_id", postgresql.UUID(), nullable=False),
    sa.Column("title", sa.Text(), nullable=True),
    sa.Index("guests_event_id_idx", "event_id"),
    sa.Index("guests_guest_group_id_idx", "guest_group_id"),
    sa.PrimaryKeyConstraint("id", name="guests_id_pkey"),
    sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="guests_event_id_fkey", ondelete="CASCADE"),
    sa.ForeignKeyConstraint(["guest_group_id"], ["guest_groups.id"], name="guests_guest_group_id_fkey", ondelete="CASCADE"),
    sa.UniqueConstraint("event_id", "email_address", name="uniqueEmail"),
)
   
sa.Table("users", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("first_name", sa.Text(), nullable=False),
    sa.Column("last_name", sa.Text(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.Column("password", sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="users_id_pkey"),
    sa.UniqueConstraint("email_address", name="users_unique_email_address"),
)
  

metadata.info["edges"] = {
  'public': {
    'EventActivityToAttendingEdge': {"edge_name":"EventActivityToAttendingEdge", "edge_type":"8025c416-c0a9-42dd-9bf4-f97f283d31a2", "edge_table":"event_rsvps", "symmetric_edge":False, "inverse_edge_type":"ea0de57e-25de-47ab-8ddc-324f41c892a3"},
    'EventActivityToDeclinedEdge': {"edge_name":"EventActivityToDeclinedEdge", "edge_type":"f3ff6b74-c055-4562-b5dd-07e4e2d8c8e3", "edge_table":"event_rsvps", "symmetric_edge":False, "inverse_edge_type":"5798e422-75d3-42ac-9ef8-30bd35e34f9f"},
    'EventActivityToInvitesEdge': {"edge_name":"EventActivityToInvitesEdge", "edge_type":"64ef93f6-7edf-42ce-a3e4-8c30d9851645", "edge_table":"event_rsvps", "symmetric_edge":False, "inverse_edge_type":"759e4abe-f866-41b7-aae8-40be4e8ab21e"},
    'GuestGroupToInvitedEventsEdge': {"edge_name":"GuestGroupToInvitedEventsEdge", "edge_type":"759e4abe-f866-41b7-aae8-40be4e8ab21e", "edge_table":"event_rsvps", "symmetric_edge":False, "inverse_edge_type":"64ef93f6-7edf-42ce-a3e4-8c30d9851645"},
    'GuestToAttendingEventsEdge': {"edge_name":"GuestToAttendingEventsEdge", "edge_type":"ea0de57e-25de-47ab-8ddc-324f41c892a3", "edge_table":"event_rsvps", "symmetric_edge":False, "inverse_edge_type":"8025c416-c0a9-42dd-9bf4-f97f283d31a2"},
    'GuestToDeclinedEventsEdge': {"edge_name":"GuestToDeclinedEventsEdge", "edge_type":"5798e422-75d3-42ac-9ef8-30bd35e34f9f", "edge_table":"event_rsvps", "symmetric_edge":False, "inverse_edge_type":"f3ff6b74-c055-4562-b5dd-07e4e2d8c8e3"},
  }
}



def get_metadata():
  return metadata
