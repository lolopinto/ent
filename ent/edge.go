package ent

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/pkg/errors"
)

// Edge is the information about an edge between two Nodes
// It's generic enough so that it applies across all types.
// Doesn't care what table it's stored in.
// TODO fix comment about where edges are stored.
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

// AssocEdgeData is corresponding ent for AssocEdgeConfig
type AssocEdgeData struct {
	EdgeType        string          `db:"edge_type" pkey:"true"` // if you have a pkey, don't add id uuid since we already have one...
	EdgeName        string          `db:"edge_name"`
	SymmetricEdge   bool            `db:"symmetric_edge"`
	InverseEdgeType *sql.NullString `db:"inverse_edge_type"`
	EdgeTable       string          `db:"edge_table"`
	Timestamps
}

func (edgeData *AssocEdgeData) FillFromMap(data map[string]interface{}) error {
	// can cache AssocEdgeData though :/
	// however leaving as-is because probably better for when this comes from a different cache
	for k, v := range data {
		switch k {
		case "edge_type":
			id := uuid.UUID{}
			if err := id.Scan(v); err != nil {
				return err
			}
			edgeData.EdgeType = id.String()
			break
		case "edge_name":
			var ok bool
			edgeData.EdgeName, ok = v.(string)
			if !ok {
				return errors.New("could not convert edge_name field to appropriate type")
			}
			break
		case "symmetric_edge":
			var ok bool
			edgeData.SymmetricEdge, ok = v.(bool)
			if !ok {
				return errors.New("could not convert symmetric_edge field to appropriate type")
			}
			break
		case "inverse_edge_type":
			if v != nil {
				id := uuid.UUID{}
				if err := id.Scan(v); err != nil {
					return err
				}
				edgeData.InverseEdgeType = &sql.NullString{
					Valid:  true,
					String: id.String(),
				}
			}
			break
		case "edge_table":
			var ok bool
			edgeData.EdgeTable, ok = v.(string)
			if !ok {
				return errors.New("could not convert edge_table field to appropriate type")
			}
			break
		}
	}
	return nil
}
