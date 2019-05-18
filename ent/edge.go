package ent

import "time"

// Edge is the information about an edge between two Nodes
// It's generic enough so that it applies across all types.
// Doesn't care what table it's stored in.
// By default, edges are stored in the `edges_info` table but we
// can have custom edge tables for specific edges where we know
// there'll be a lot of data
type Edge struct {
	ID1      string    `db:"id1"`
	ID1Type  NodeType  `db:"id1_type"`
	EdgeType EdgeType  `db:"edge_type"`
	ID2      string    `db:"id2"`
	ID2Type  NodeType  `db:"id2_type"`
	Time     time.Time `db:"time"`
	Data     string    `db:"data"` // nullable TODO nullable strings
}

// EdgeResult stores the result of loading an Edge concurrently
type EdgeResult struct {
	Edge  Edge
	Error error
}

// EdgesResult stores the result of loading a slice of edges concurrently
type EdgesResult struct {
	Edges []Edge
	Error error
}
