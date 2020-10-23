# Code generated by github.com/lolopinto/ent/ent, DO NOT edit. (TODO figure out correct pythonic way of doing this)

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

metadata = sa.MetaData()

 
sa.Table("addresses", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("street_name", sa.Text(), nullable=False),
    sa.Column("city", sa.Text(), nullable=False),
    sa.Column("zip", sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="addresses_id_pkey"),
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
   
sa.Table("contacts", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.Column("first_name", sa.Text(), nullable=False),
    sa.Column("last_name", sa.Text(), nullable=False),
    sa.Column("user_id", postgresql.UUID(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="contacts_id_pkey"),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="contacts_user_id_fkey", ondelete="CASCADE"),
)
   
sa.Table("event_hosts_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="event_hosts_edges_id1_edge_type_id2_pkey"),
)
   
sa.Table("event_rsvps_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="event_rsvps_edges_id1_edge_type_id2_pkey"),
)
   
sa.Table("events", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("user_id", sa.Text(), nullable=False),
    sa.Column("start_time", sa.TIMESTAMP(), nullable=False),
    sa.Column("end_time", sa.TIMESTAMP(), nullable=True),
    sa.Column("location", sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="events_id_pkey"),
)
   
sa.Table("user_created_events_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="user_created_events_edges_id1_edge_type_id2_pkey"),
)
   
sa.Table("user_friends_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="user_friends_edges_id1_edge_type_id2_pkey"),
)
   
sa.Table("user_self_contact_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="user_self_contact_edges_id1_edge_type_id2_pkey"),
    sa.UniqueConstraint("id1", "edge_type", name="user_self_contact_edges_unique_id1_edge_type"),
)
   
sa.Table("users", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("first_name", sa.Text(), nullable=False),
    sa.Column("last_name", sa.Text(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.Column("phone_number", sa.Text(), nullable=True),
    sa.Column("password", sa.Text(), nullable=True),
    sa.Column("account_status", sa.Text(), nullable=True),
    sa.Column("email_verified", sa.Boolean(), nullable=False, server_default='FALSE'),
    sa.PrimaryKeyConstraint("id", name="users_id_pkey"),
    sa.UniqueConstraint("email_address", name="users_unique_email_address"),
    sa.UniqueConstraint("phone_number", name="users_unique_phone_number"),
)
  

metadata.info["edges"] = {
  'public': {
    'EventToAttendingEdge': {"edge_name":"EventToAttendingEdge", "edge_type":"6ebc0c47-ea29-4635-b991-95e44162174d", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"2a98ba02-e342-4bb4-93f6-5d7ed02f5c48"},
    'EventToDeclinedEdge': {"edge_name":"EventToDeclinedEdge", "edge_type":"db8d2454-f7b2-4147-aae1-e666daf3f3c3", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"1c7c173b-63ce-4002-b121-4a87f82047dd"},
    'EventToHostsEdge': {"edge_name":"EventToHostsEdge", "edge_type":"ebe3e709-845c-4723-ac9c-29f983f2b8ea", "edge_table":"event_hosts_edges", "symmetric_edge":False, "inverse_edge_type":"e5555185-91bf-4322-8130-d0a00eb605b7"},
    'EventToInvitedEdge': {"edge_name":"EventToInvitedEdge", "edge_type":"a72f5f64-3580-44fd-9bd0-d1335b803a46", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"e439f2b2-d93a-4d1a-83f0-865bda5c8337"},
    'EventToMaybeEdge': {"edge_name":"EventToMaybeEdge", "edge_type":"b0f6311b-fdab-4c26-b6bf-b751e0997735", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"8d5b1dee-ce65-452e-9f8d-78eca1993800"},
    'UserToCreatedEventsEdge': {"edge_name":"UserToCreatedEventsEdge", "edge_type":"daa3b2a3-8245-40ca-ae77-25bfb82578a7", "edge_table":"user_created_events_edges", "symmetric_edge":False, "inverse_edge_type":None},
    'UserToDeclinedEventsEdge': {"edge_name":"UserToDeclinedEventsEdge", "edge_type":"1c7c173b-63ce-4002-b121-4a87f82047dd", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"db8d2454-f7b2-4147-aae1-e666daf3f3c3"},
    'UserToEventsAttendingEdge': {"edge_name":"UserToEventsAttendingEdge", "edge_type":"2a98ba02-e342-4bb4-93f6-5d7ed02f5c48", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"6ebc0c47-ea29-4635-b991-95e44162174d"},
    'UserToFriendsEdge': {"edge_name":"UserToFriendsEdge", "edge_type":"d1a9316d-090f-4b02-b393-fd9372e2c905", "edge_table":"user_friends_edges", "symmetric_edge":True, "inverse_edge_type":None},
    'UserToInvitedEventsEdge': {"edge_name":"UserToInvitedEventsEdge", "edge_type":"e439f2b2-d93a-4d1a-83f0-865bda5c8337", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"a72f5f64-3580-44fd-9bd0-d1335b803a46"},
    'UserToMaybeEventsEdge': {"edge_name":"UserToMaybeEventsEdge", "edge_type":"8d5b1dee-ce65-452e-9f8d-78eca1993800", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"b0f6311b-fdab-4c26-b6bf-b751e0997735"},
    'UserToSelfContactEdge': {"edge_name":"UserToSelfContactEdge", "edge_type":"d504201d-cf3f-4eef-b6a0-0b46a7ae186b", "edge_table":"user_self_contact_edges", "symmetric_edge":False, "inverse_edge_type":None},
    'UserToUserToHostedEventsEdge': {"edge_name":"UserToUserToHostedEventsEdge", "edge_type":"e5555185-91bf-4322-8130-d0a00eb605b7", "edge_table":"event_hosts_edges", "symmetric_edge":False, "inverse_edge_type":"ebe3e709-845c-4723-ac9c-29f983f2b8ea"},
  }
}



def get_metadata():
  return metadata
