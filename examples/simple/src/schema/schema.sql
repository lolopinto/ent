CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TABLE address_hosted_events_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT address_hosted_events_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX address_hosted_events_edges_time_idx ON address_hosted_events_edges (time);

CREATE TABLE addresses (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    street_name TEXT NOT NULL, 
    city TEXT NOT NULL, 
    state TEXT NOT NULL, 
    zip TEXT NOT NULL, 
    apartment TEXT, 
    country TEXT DEFAULT 'US' NOT NULL, 
    CONSTRAINT addresses_id_pkey PRIMARY KEY (id)
);

CREATE TABLE assoc_edge_config (
    edge_type UUID NOT NULL, 
    edge_name TEXT NOT NULL, 
    symmetric_edge BOOLEAN DEFAULT 'false' NOT NULL, 
    inverse_edge_type UUID, 
    edge_table TEXT NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT assoc_edge_config_edge_type_pkey PRIMARY KEY (edge_type), 
    CONSTRAINT assoc_edge_config_inverse_edge_type_fkey FOREIGN KEY(inverse_edge_type) REFERENCES assoc_edge_config (edge_type) ON DELETE RESTRICT, 
    CONSTRAINT assoc_edge_config_unique_edge_name UNIQUE (edge_name)
);

CREATE TABLE comments (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    author_id UUID NOT NULL, 
    body TEXT NOT NULL, 
    article_id UUID NOT NULL, 
    article_type TEXT NOT NULL, 
    CONSTRAINT comments_id_pkey PRIMARY KEY (id)
);

CREATE INDEX comments_article_id_idx ON comments (article_id);

CREATE TABLE contact_emails (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    email_address TEXT NOT NULL, 
    label TEXT NOT NULL, 
    contact_id UUID NOT NULL, 
    CONSTRAINT contact_emails_id_pkey PRIMARY KEY (id)
);

CREATE TABLE contact_phone_numbers (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    phone_number TEXT NOT NULL, 
    label TEXT NOT NULL, 
    contact_id UUID NOT NULL, 
    CONSTRAINT contact_phone_numbers_id_pkey PRIMARY KEY (id)
);

CREATE TABLE event_hosts_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT event_hosts_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX event_hosts_edges_time_idx ON event_hosts_edges (time);

CREATE TABLE event_rsvps_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT event_rsvps_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX event_rsvps_edges_time_idx ON event_rsvps_edges (time);

CREATE TABLE events (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    name TEXT NOT NULL, 
    user_id UUID NOT NULL, 
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    end_time TIMESTAMP WITHOUT TIME ZONE, 
    location TEXT NOT NULL, 
    address_id UUID, 
    CONSTRAINT events_id_pkey PRIMARY KEY (id)
);

CREATE TABLE holidays (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    day_of_week TEXT NOT NULL, 
    day_of_week_alt TEXT, 
    label TEXT NOT NULL, 
    date DATE NOT NULL, 
    CONSTRAINT holidays_id_pkey PRIMARY KEY (id)
);

CREATE TABLE hours_of_operations (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    day_of_week TEXT NOT NULL, 
    day_of_week_alt TEXT, 
    open TIME WITHOUT TIME ZONE NOT NULL, 
    close TIME WITH TIME ZONE NOT NULL, 
    CONSTRAINT hours_of_operations_id_pkey PRIMARY KEY (id)
);

CREATE TABLE object_comments_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT object_comments_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX object_comments_edges_time_idx ON object_comments_edges (time);

CREATE TABLE object_likers_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT object_likers_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX object_likers_edges_time_idx ON object_likers_edges (time);

CREATE TABLE user_created_events_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_created_events_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_created_events_edges_time_idx ON user_created_events_edges (time);

CREATE TABLE user_friends_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_friends_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_friends_edges_time_idx ON user_friends_edges (time);

CREATE TABLE user_self_contact_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_self_contact_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2), 
    CONSTRAINT user_self_contact_edges_unique_id1_edge_type UNIQUE (id1, edge_type)
);

CREATE INDEX user_self_contact_edges_time_idx ON user_self_contact_edges (time);

CREATE TABLE users (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    first_name TEXT NOT NULL, 
    last_name TEXT NOT NULL, 
    email_address TEXT NOT NULL, 
    phone_number TEXT, 
    password TEXT, 
    account_status TEXT, 
    email_verified BOOLEAN DEFAULT 'FALSE' NOT NULL, 
    bio TEXT, 
    nicknames TEXT[], 
    prefs JSONB, 
    prefs_list JSONB[], 
    prefs_diff JSON, 
    days_off TEXT[], 
    preferred_shift TEXT[], 
    time_in_ms BIGINT, 
    fun_uuids UUID[], 
    new_col TEXT, 
    new_col_2 TEXT, 
    super_nested_object JSONB, 
    nested_list JSONB[], 
    int_enum INTEGER, 
    name_idx TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) STORED, 
    CONSTRAINT users_id_pkey PRIMARY KEY (id), 
    CONSTRAINT users_unique_email_address UNIQUE (email_address), 
    CONSTRAINT users_unique_phone_number UNIQUE (phone_number)
);

CREATE INDEX user_name_idx ON users USING gin (name_idx);

CREATE TABLE auth_codes (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    code TEXT NOT NULL, 
    user_id UUID NOT NULL, 
    email_address TEXT, 
    phone_number TEXT, 
    CONSTRAINT auth_codes_id_pkey PRIMARY KEY (id), 
    CONSTRAINT auth_codes_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT "uniqueCode" UNIQUE (email_address, code), 
    CONSTRAINT "uniquePhoneCode" UNIQUE (phone_number, code)
);

CREATE INDEX auth_codes_user_id_idx ON auth_codes (user_id);

CREATE TABLE contacts (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    email_ids UUID[] NOT NULL, 
    phone_number_ids UUID[] NOT NULL, 
    first_name TEXT NOT NULL, 
    last_name TEXT NOT NULL, 
    user_id UUID NOT NULL, 
    CONSTRAINT contacts_id_pkey PRIMARY KEY (id), 
    CONSTRAINT contacts_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX contacts_email_ids_idx ON contacts USING gin (email_ids);

CREATE INDEX contacts_phone_number_ids_idx ON contacts USING gin (phone_number_ids);

CREATE INDEX contacts_user_id_idx ON contacts (user_id);

INSERT INTO assoc_edge_config(edge_name, edge_type, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES('AddressToHostedEventsEdge', 'd1979d4b-d033-4562-b078-cc528fec25bb', 'address_hosted_events_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('CommentToPostEdge', 'f430af94-d38a-4aaa-a92f-cfc56b6f811b', 'object_comments_edges', false, '8caba9c4-8035-447f-9eb1-4dd09a2d250c', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('EventToAttendingEdge', '6ebc0c47-ea29-4635-b991-95e44162174d', 'event_rsvps_edges', false, '2a98ba02-e342-4bb4-93f6-5d7ed02f5c48', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('EventToDeclinedEdge', 'db8d2454-f7b2-4147-aae1-e666daf3f3c3', 'event_rsvps_edges', false, '1c7c173b-63ce-4002-b121-4a87f82047dd', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('EventToHostsEdge', 'ebe3e709-845c-4723-ac9c-29f983f2b8ea', 'event_hosts_edges', false, 'cf6542a4-8bae-427f-8a1f-01194047afb3', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('EventToInvitedEdge', 'a72f5f64-3580-44fd-9bd0-d1335b803a46', 'event_rsvps_edges', false, 'e439f2b2-d93a-4d1a-83f0-865bda5c8337', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('EventToMaybeEdge', 'b0f6311b-fdab-4c26-b6bf-b751e0997735', 'event_rsvps_edges', false, '8d5b1dee-ce65-452e-9f8d-78eca1993800', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('ObjectToCommentsEdge', '8caba9c4-8035-447f-9eb1-4dd09a2d250c', 'object_comments_edges', false, 'f430af94-d38a-4aaa-a92f-cfc56b6f811b', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('ObjectToLikersEdge', 'c9ccdad9-7aff-40e4-9a69-2c29cfa19763', 'object_likers_edges', false, '745a20bf-4fdc-4862-b39f-569c4451db8f', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToCreatedEventsEdge', 'daa3b2a3-8245-40ca-ae77-25bfb82578a7', 'user_created_events_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToDeclinedEventsEdge', '1c7c173b-63ce-4002-b121-4a87f82047dd', 'event_rsvps_edges', false, 'db8d2454-f7b2-4147-aae1-e666daf3f3c3', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToEventsAttendingEdge', '2a98ba02-e342-4bb4-93f6-5d7ed02f5c48', 'event_rsvps_edges', false, '6ebc0c47-ea29-4635-b991-95e44162174d', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToFriendsEdge', 'd1a9316d-090f-4b02-b393-fd9372e2c905', 'user_friends_edges', true, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToHostedEventsEdge', 'cf6542a4-8bae-427f-8a1f-01194047afb3', 'event_hosts_edges', false, 'ebe3e709-845c-4723-ac9c-29f983f2b8ea', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToInvitedEventsEdge', 'e439f2b2-d93a-4d1a-83f0-865bda5c8337', 'event_rsvps_edges', false, 'a72f5f64-3580-44fd-9bd0-d1335b803a46', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToLikesEdge', '745a20bf-4fdc-4862-b39f-569c4451db8f', 'object_likers_edges', false, 'c9ccdad9-7aff-40e4-9a69-2c29cfa19763', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToMaybeEventsEdge', '8d5b1dee-ce65-452e-9f8d-78eca1993800', 'event_rsvps_edges', false, 'b0f6311b-fdab-4c26-b6bf-b751e0997735', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToPostEdge', '4b725578-e9f5-472c-8e57-e47481c9e1b8', 'object_comments_edges', false, '8caba9c4-8035-447f-9eb1-4dd09a2d250c', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToSelfContactEdge', 'd504201d-cf3f-4eef-b6a0-0b46a7ae186b', 'user_self_contact_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'), ('UserToUserToHostedEventsEdge', 'e5555185-91bf-4322-8130-d0a00eb605b7', 'event_hosts_edges', false, 'ebe3e709-845c-4723-ac9c-29f983f2b8ea', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC') ON CONFLICT DO NOTHING;

