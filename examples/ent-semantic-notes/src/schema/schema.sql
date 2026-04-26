CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE EXTENSION IF NOT EXISTS "vector";

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

CREATE TABLE note_chunks (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    note_id UUID NOT NULL, 
    workspace_id UUID NOT NULL, 
    ordinal INTEGER NOT NULL, 
    content TEXT NOT NULL, 
    token_count INTEGER, 
    embedding vector(6), 
    CONSTRAINT note_chunks_id_pkey PRIMARY KEY (id)
);

CREATE INDEX note_chunks_note_id_idx ON note_chunks (note_id);

CREATE UNIQUE INDEX note_chunks_unique_ordinal ON note_chunks (note_id, ordinal);

CREATE INDEX note_chunks_workspace_id_idx ON note_chunks (workspace_id);

CREATE TABLE note_chunks_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT note_chunks_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX note_chunks_edges_time_idx ON note_chunks_edges (time);

CREATE TABLE note_saved_by_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT note_saved_by_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX note_saved_by_edges_time_idx ON note_saved_by_edges (time);

CREATE TABLE note_tags_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT note_tags_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX note_tags_edges_time_idx ON note_tags_edges (time);

CREATE TABLE notes (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    workspace_id UUID NOT NULL, 
    author_id UUID NOT NULL, 
    title TEXT NOT NULL, 
    body TEXT NOT NULL, 
    summary TEXT, 
    status TEXT DEFAULT 'DRAFT' NOT NULL, 
    CONSTRAINT notes_id_pkey PRIMARY KEY (id)
);

CREATE INDEX notes_author_id_idx ON notes (author_id);

CREATE INDEX notes_workspace_id_idx ON notes (workspace_id);

CREATE INDEX workspace_notes_status_idx ON notes (workspace_id, status);

CREATE TABLE tags (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    workspace_id UUID NOT NULL, 
    name TEXT NOT NULL, 
    color TEXT, 
    CONSTRAINT tags_id_pkey PRIMARY KEY (id)
);

CREATE INDEX tags_workspace_id_idx ON tags (workspace_id);

CREATE UNIQUE INDEX workspace_tags_unique_name ON tags (workspace_id, name);

CREATE TABLE user_created_workspaces_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_created_workspaces_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_created_workspaces_edges_time_idx ON user_created_workspaces_edges (time);

CREATE TABLE user_notes_authored_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_notes_authored_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_notes_authored_edges_time_idx ON user_notes_authored_edges (time);

CREATE TABLE users (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    name TEXT NOT NULL, 
    email_address TEXT NOT NULL, 
    bio TEXT, 
    CONSTRAINT users_id_pkey PRIMARY KEY (id), 
    CONSTRAINT users_unique_email_address UNIQUE (email_address)
);

CREATE TABLE workspace_members_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT workspace_members_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX workspace_members_edges_time_idx ON workspace_members_edges (time);

CREATE TABLE workspace_note_chunks_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT workspace_note_chunks_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX workspace_note_chunks_edges_time_idx ON workspace_note_chunks_edges (time);

CREATE TABLE workspace_notes_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT workspace_notes_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX workspace_notes_edges_time_idx ON workspace_notes_edges (time);

CREATE TABLE workspace_tags_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT workspace_tags_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX workspace_tags_edges_time_idx ON workspace_tags_edges (time);

CREATE TABLE workspaces (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    name TEXT NOT NULL, 
    slug TEXT NOT NULL, 
    description TEXT, 
    creator_id UUID NOT NULL, 
    embedding_model TEXT DEFAULT 'text-embedding-3-small' NOT NULL, 
    CONSTRAINT workspaces_id_pkey PRIMARY KEY (id), 
    CONSTRAINT workspaces_unique_slug UNIQUE (slug)
);

CREATE INDEX workspaces_creator_id_idx ON workspaces (creator_id);

INSERT INTO assoc_edge_config(edge_name, edge_type, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES('NoteToChunksEdge', 'eb12d548-7ce4-45d5-bab0-a30daaeae141', 'note_chunks_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('NoteToSavedByEdge', '18fe105e-31b2-47fa-846a-61f8f8014697', 'note_saved_by_edges', false, 'b6dfcb48-24c4-47b6-8cf8-0e2bc1044d61', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('NoteToTagsEdge', '1e6c4bae-ec0d-483e-9622-6a2f5d86344a', 'note_tags_edges', false, '23466598-29d2-4610-9f35-b785afb25f93', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('TagToNotesEdge', '23466598-29d2-4610-9f35-b785afb25f93', 'note_tags_edges', false, '1e6c4bae-ec0d-483e-9622-6a2f5d86344a', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToCreatedWorkspacesEdge', '59d27b35-fb81-4ed2-b2db-165bbc08bb64', 'user_created_workspaces_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToNotesAuthoredEdge', 'd8a450e8-6827-44a5-a3f1-ec608d42eb3e', 'user_notes_authored_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToSavedNotesEdge', 'b6dfcb48-24c4-47b6-8cf8-0e2bc1044d61', 'note_saved_by_edges', false, '18fe105e-31b2-47fa-846a-61f8f8014697', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToWorkspacesEdge', '91c248cf-d0fd-4dec-a631-358f96fcacc7', 'workspace_members_edges', false, '95c5bb94-6c48-4503-93ef-5d66df08a7fe', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('WorkspaceToMembersEdge', '95c5bb94-6c48-4503-93ef-5d66df08a7fe', 'workspace_members_edges', false, '91c248cf-d0fd-4dec-a631-358f96fcacc7', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('WorkspaceToNoteChunksEdge', '4663a6e9-8193-47bc-ad9e-14933d2e6295', 'workspace_note_chunks_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('WorkspaceToNotesEdge', '707b0be4-6855-419d-af29-12551c3adf63', 'workspace_notes_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('WorkspaceToTagsEdge', 'efb4678b-f768-4ba1-b9a1-913c9beb2ec5', 'workspace_tags_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC') ON CONFLICT DO NOTHING;

