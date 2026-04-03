CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE EXTENSION IF NOT EXISTS "postgis";

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

CREATE TABLE place_reviews (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    place_id UUID NOT NULL, 
    reviewer_id UUID NOT NULL, 
    rating INTEGER NOT NULL, 
    body TEXT, 
    CONSTRAINT place_reviews_id_pkey PRIMARY KEY (id)
);

CREATE TABLE place_reviews_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT place_reviews_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX place_reviews_edges_time_idx ON place_reviews_edges (time);

CREATE TABLE places (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    name TEXT NOT NULL, 
    slug TEXT NOT NULL, 
    description TEXT, 
    website TEXT, 
    category TEXT NOT NULL, 
    creator_id UUID NOT NULL, 
    location geography(Point,4326) NOT NULL, 
    CONSTRAINT places_id_pkey PRIMARY KEY (id), 
    CONSTRAINT places_unique_slug UNIQUE (slug)
);

CREATE INDEX places_location_gist ON places USING gist (location);

CREATE TABLE user_created_places_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_created_places_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_created_places_edges_time_idx ON user_created_places_edges (time);

CREATE TABLE user_favorite_places_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_favorite_places_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_favorite_places_edges_time_idx ON user_favorite_places_edges (time);

CREATE TABLE user_place_reviews_edges (
    id1 UUID NOT NULL, 
    id1_type TEXT NOT NULL, 
    edge_type UUID NOT NULL, 
    id2 UUID NOT NULL, 
    id2_type TEXT NOT NULL, 
    time TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    data TEXT, 
    CONSTRAINT user_place_reviews_edges_id1_edge_type_id2_pkey PRIMARY KEY (id1, edge_type, id2)
);

CREATE INDEX user_place_reviews_edges_time_idx ON user_place_reviews_edges (time);

CREATE TABLE users (
    id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    name TEXT NOT NULL, 
    slug TEXT NOT NULL, 
    bio TEXT, 
    CONSTRAINT users_id_pkey PRIMARY KEY (id), 
    CONSTRAINT users_unique_slug UNIQUE (slug)
);

INSERT INTO assoc_edge_config(edge_name, edge_type, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES('PlaceToFansEdge', '2896184f-1cf4-449a-86e9-ee264654bdd3', 'user_favorite_places_edges', false, 'edbb8c18-80d2-40b6-874a-5350a5e5506a', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('PlaceToReviewsEdge', '52594665-1d66-428f-a35d-cbfe162aef9b', 'place_reviews_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToCreatedPlacesEdge', '9fcba9cd-1a85-4de4-bdc2-e279fccd0ed8', 'user_created_places_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToFavoritePlacesEdge', 'edbb8c18-80d2-40b6-874a-5350a5e5506a', 'user_favorite_places_edges', false, '2896184f-1cf4-449a-86e9-ee264654bdd3', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'),
('UserToPlaceReviewsEdge', 'f5554d92-2939-47d1-86ef-8a6b4f1c8bad', 'user_place_reviews_edges', false, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC') ON CONFLICT DO NOTHING;

