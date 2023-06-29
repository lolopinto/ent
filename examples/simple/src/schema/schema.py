# Code generated by github.com/lolopinto/ent/ent, DO NOT edit. (TODO figure out correct pythonic way of doing this)

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from auto_schema.schema_item import FullTextIndex

metadata = sa.MetaData()

 
sa.Table("address_hosted_events_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="address_hosted_events_edges_id1_edge_type_id2_pkey"),
    sa.Index("address_hosted_events_edges_time_idx", "time"),
)
   
sa.Table("addresses", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("street_name", sa.Text(), nullable=False),
    sa.Column("city", sa.Text(), nullable=False),
    sa.Column("state", sa.Text(), nullable=False),
    sa.Column("zip", sa.Text(), nullable=False),
    sa.Column("apartment", sa.Text(), nullable=True),
    sa.Column("country", sa.Text(), nullable=False, server_default='US'),
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
   
sa.Table("auth_codes", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("code", sa.Text(), nullable=False),
    sa.Column("user_id", postgresql.UUID(), nullable=False),
    sa.Column("email_address", sa.Text(), nullable=True),
    sa.Column("phone_number", sa.Text(), nullable=True),
    sa.Index("auth_codes_user_id_idx", "user_id"),
    sa.PrimaryKeyConstraint("id", name="auth_codes_id_pkey"),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="auth_codes_user_id_fkey", ondelete="CASCADE"),
    sa.UniqueConstraint("email_address", "code", name="uniqueCode"),
    sa.UniqueConstraint("phone_number", "code", name="uniquePhoneCode"),
)
   
sa.Table("comments", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("author_id", postgresql.UUID(), nullable=False),
    sa.Column("body", sa.Text(), nullable=False),
    sa.Column("article_id", postgresql.UUID(), nullable=False),
    sa.Column("article_type", sa.Text(), nullable=False),
    sa.Column("attachment_id", postgresql.UUID(), nullable=True),
    sa.Column("attachment_type", sa.Text(), nullable=True),
    sa.Column("sticker_id", postgresql.UUID(), nullable=True),
    sa.Column("sticker_type", sa.Text(), nullable=True),
    sa.Index("comments_author_id_idx", "author_id"),
    sa.Index("comments_article_id_idx", "article_id"),
    sa.Index("comments_attachment_id_idx", "attachment_id"),
    sa.PrimaryKeyConstraint("id", name="comments_id_pkey"),
)
   
sa.Table("contact_emails", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("extra", postgresql.JSONB, nullable=True),
    sa.Column("email_address", sa.Text(), nullable=False),
    sa.Column("label", sa.Text(), nullable=False),
    sa.Column("contact_id", postgresql.UUID(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="contact_emails_id_pkey"),
)
   
sa.Table("contact_phone_numbers", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("extra", postgresql.JSONB, nullable=True),
    sa.Column("phone_number", sa.Text(), nullable=False),
    sa.Column("label", sa.Text(), nullable=False),
    sa.Column("contact_id", postgresql.UUID(), nullable=False),
    sa.PrimaryKeyConstraint("id", name="contact_phone_numbers_id_pkey"),
)
   
sa.Table("contacts", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("email_ids", postgresql.ARRAY(postgresql.UUID()), nullable=False),
    sa.Column("phone_number_ids", postgresql.ARRAY(postgresql.UUID()), nullable=False),
    sa.Column("first_name", sa.Text(), nullable=False),
    sa.Column("last_name", sa.Text(), nullable=False),
    sa.Column("user_id", postgresql.UUID(), nullable=False),
    sa.Index("contacts_created_at_idx", "created_at"),
    sa.Index("contacts_email_ids_idx", "email_ids", postgresql_using="gin"),
    sa.Index("contacts_phone_number_ids_idx", "phone_number_ids", postgresql_using="gin"),
    sa.Index("contacts_user_id_idx", "user_id"),
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
    sa.Index("event_hosts_edges_time_idx", "time"),
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
    sa.Index("event_rsvps_edges_time_idx", "time"),
)
   
sa.Table("events", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("user_id", postgresql.UUID(), nullable=False),
    sa.Column("start_time", sa.TIMESTAMP(), nullable=False),
    sa.Column("end_time", sa.TIMESTAMP(), nullable=True),
    sa.Column("location", sa.Text(), nullable=False),
    sa.Column("address_id", postgresql.UUID(), nullable=True),
    sa.Column("local_utc_offset", sa.Text(), nullable=True),
    sa.Index("events_user_id_idx", "user_id"),
    sa.PrimaryKeyConstraint("id", name="events_id_pkey"),
    sa.Index("event_time_indices", "start_time", "end_time"),
)
   
sa.Table("global_login_auth_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="global_login_auth_edges_id1_edge_type_id2_pkey"),
    sa.Index("global_login_auth_edges_time_idx", "time"),
)
   
sa.Table("holidays", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column("day_of_week", sa.Text(), nullable=False),
    sa.Column("day_of_week_alt", sa.Text(), nullable=False),
    sa.Column("label", sa.Text(), nullable=False),
    sa.Column("date", sa.Date(), nullable=False, server_default='2020-02-01'),
    sa.PrimaryKeyConstraint("id", name="holidays_id_pkey"),
)
   
sa.Table("hours_of_operations", metadata,
    sa.Column("id", postgresql.UUID(), nullable=False),
    sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column("day_of_week", sa.Text(), nullable=False),
    sa.Column("day_of_week_alt", sa.Text(), nullable=True),
    sa.Column("open", sa.Time(), nullable=False),
    sa.Column("close", sa.Time(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint("id", name="hours_of_operations_id_pkey"),
)
   
sa.Table("object_comments_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="object_comments_edges_id1_edge_type_id2_pkey"),
    sa.Index("object_comments_edges_time_idx", "time"),
)
   
sa.Table("object_likers_edges", metadata,
    sa.Column("id1", postgresql.UUID(), nullable=False),
    sa.Column("id1_type", sa.Text(), nullable=False),
    sa.Column("edge_type", postgresql.UUID(), nullable=False),
    sa.Column("id2", postgresql.UUID(), nullable=False),
    sa.Column("id2_type", sa.Text(), nullable=False),
    sa.Column("time", sa.TIMESTAMP(), nullable=False),
    sa.Column("data", sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint("id1", "edge_type", "id2", name="object_likers_edges_id1_edge_type_id2_pkey"),
    sa.Index("object_likers_edges_time_idx", "time"),
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
    sa.Index("user_created_events_edges_time_idx", "time"),
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
    sa.Index("user_friends_edges_time_idx", "time"),
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
    sa.Index("user_self_contact_edges_time_idx", "time"),
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
    sa.Column("email_verified", sa.Boolean(), nullable=False, server_default='false'),
    sa.Column("bio", sa.Text(), nullable=True),
    sa.Column("nicknames", postgresql.ARRAY(sa.Text()), nullable=True),
    sa.Column("prefs", postgresql.JSONB, nullable=True),
    sa.Column("prefs_list", postgresql.JSONB, nullable=True),
    sa.Column("prefs_diff", postgresql.JSON, nullable=True),
    sa.Column("days_off", postgresql.ARRAY(sa.Text()), nullable=True),
    sa.Column("preferred_shift", postgresql.ARRAY(sa.Text()), nullable=True),
    sa.Column("time_in_ms", sa.BigInteger(), nullable=True),
    sa.Column("fun_uuids", postgresql.ARRAY(postgresql.UUID()), nullable=True),
    sa.Column("new_col", sa.Text(), nullable=True),
    sa.Column("new_col_2", sa.Text(), nullable=True),
    sa.Column("super_nested_object", postgresql.JSONB, nullable=True),
    sa.Column("nested_list", postgresql.ARRAY(postgresql.JSONB), nullable=True),
    sa.Column("int_enum", sa.Integer(), nullable=True),
    sa.Column("name_idx", postgresql.TSVECTOR, sa.Computed("to_tsvector('simple', coalesce(first_name, '') || ' ' || coalesce(last_name, ''))")),
    sa.PrimaryKeyConstraint("id", name="users_id_pkey"),
    sa.UniqueConstraint("email_address", name="users_unique_email_address"),
    sa.UniqueConstraint("phone_number", name="users_unique_phone_number"),
    sa.Index("user_name_idx", "name_idx", postgresql_using='gin'),
)
  

metadata.info["edges"] = {
  'public': {
    'AddressToHostedEventsEdge': {"edge_name":"AddressToHostedEventsEdge", "edge_type":"d1979d4b-d033-4562-b078-cc528fec25bb", "edge_table":"address_hosted_events_edges", "symmetric_edge":False, "inverse_edge_type":None},
    'CommentToPostEdge': {"edge_name":"CommentToPostEdge", "edge_type":"f430af94-d38a-4aaa-a92f-cfc56b6f811b", "edge_table":"object_comments_edges", "symmetric_edge":False, "inverse_edge_type":"8caba9c4-8035-447f-9eb1-4dd09a2d250c"},
    'EventToAttendingEdge': {"edge_name":"EventToAttendingEdge", "edge_type":"6ebc0c47-ea29-4635-b991-95e44162174d", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"2a98ba02-e342-4bb4-93f6-5d7ed02f5c48"},
    'EventToDeclinedEdge': {"edge_name":"EventToDeclinedEdge", "edge_type":"db8d2454-f7b2-4147-aae1-e666daf3f3c3", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"1c7c173b-63ce-4002-b121-4a87f82047dd"},
    'EventToHostsEdge': {"edge_name":"EventToHostsEdge", "edge_type":"ebe3e709-845c-4723-ac9c-29f983f2b8ea", "edge_table":"event_hosts_edges", "symmetric_edge":False, "inverse_edge_type":"cf6542a4-8bae-427f-8a1f-01194047afb3"},
    'EventToInvitedEdge': {"edge_name":"EventToInvitedEdge", "edge_type":"a72f5f64-3580-44fd-9bd0-d1335b803a46", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"e439f2b2-d93a-4d1a-83f0-865bda5c8337"},
    'EventToMaybeEdge': {"edge_name":"EventToMaybeEdge", "edge_type":"b0f6311b-fdab-4c26-b6bf-b751e0997735", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"8d5b1dee-ce65-452e-9f8d-78eca1993800"},
    'GlobalToLoginAuthEdge': {"edge_name":"GlobalToLoginAuthEdge", "edge_type":"13eb6687-d226-4272-ba65-d5e33e00954c", "edge_table":"global_login_auth_edges", "symmetric_edge":False, "inverse_edge_type":None},
    'ObjectToCommentsEdge': {"edge_name":"ObjectToCommentsEdge", "edge_type":"8caba9c4-8035-447f-9eb1-4dd09a2d250c", "edge_table":"object_comments_edges", "symmetric_edge":False, "inverse_edge_type":"f430af94-d38a-4aaa-a92f-cfc56b6f811b"},
    'ObjectToLikersEdge': {"edge_name":"ObjectToLikersEdge", "edge_type":"c9ccdad9-7aff-40e4-9a69-2c29cfa19763", "edge_table":"object_likers_edges", "symmetric_edge":False, "inverse_edge_type":"745a20bf-4fdc-4862-b39f-569c4451db8f"},
    'UserToCreatedEventsEdge': {"edge_name":"UserToCreatedEventsEdge", "edge_type":"daa3b2a3-8245-40ca-ae77-25bfb82578a7", "edge_table":"user_created_events_edges", "symmetric_edge":False, "inverse_edge_type":None},
    'UserToDeclinedEventsEdge': {"edge_name":"UserToDeclinedEventsEdge", "edge_type":"1c7c173b-63ce-4002-b121-4a87f82047dd", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"db8d2454-f7b2-4147-aae1-e666daf3f3c3"},
    'UserToEventsAttendingEdge': {"edge_name":"UserToEventsAttendingEdge", "edge_type":"2a98ba02-e342-4bb4-93f6-5d7ed02f5c48", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"6ebc0c47-ea29-4635-b991-95e44162174d"},
    'UserToFriendsEdge': {"edge_name":"UserToFriendsEdge", "edge_type":"d1a9316d-090f-4b02-b393-fd9372e2c905", "edge_table":"user_friends_edges", "symmetric_edge":True, "inverse_edge_type":None},
    'UserToHostedEventsEdge': {"edge_name":"UserToHostedEventsEdge", "edge_type":"cf6542a4-8bae-427f-8a1f-01194047afb3", "edge_table":"event_hosts_edges", "symmetric_edge":False, "inverse_edge_type":"ebe3e709-845c-4723-ac9c-29f983f2b8ea"},
    'UserToInvitedEventsEdge': {"edge_name":"UserToInvitedEventsEdge", "edge_type":"e439f2b2-d93a-4d1a-83f0-865bda5c8337", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"a72f5f64-3580-44fd-9bd0-d1335b803a46"},
    'UserToLikesEdge': {"edge_name":"UserToLikesEdge", "edge_type":"745a20bf-4fdc-4862-b39f-569c4451db8f", "edge_table":"object_likers_edges", "symmetric_edge":False, "inverse_edge_type":"c9ccdad9-7aff-40e4-9a69-2c29cfa19763"},
    'UserToMaybeEventsEdge': {"edge_name":"UserToMaybeEventsEdge", "edge_type":"8d5b1dee-ce65-452e-9f8d-78eca1993800", "edge_table":"event_rsvps_edges", "symmetric_edge":False, "inverse_edge_type":"b0f6311b-fdab-4c26-b6bf-b751e0997735"},
    'UserToSelfContactEdge': {"edge_name":"UserToSelfContactEdge", "edge_type":"d504201d-cf3f-4eef-b6a0-0b46a7ae186b", "edge_table":"user_self_contact_edges", "symmetric_edge":False, "inverse_edge_type":None},
  }
}



def get_metadata():
  return metadata
