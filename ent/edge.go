package ent

import (
	"database/sql"
	"time"

	"github.com/lolopinto/ent/ent/cast"
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

// if not this, use reflection?
func (edge *Edge) FillFromMap(data map[string]interface{}) error {
	for k, v := range data {
		var err error
		switch k {
		case "id1":
			edge.ID1, err = cast.ToUUIDString(v)
			if err != nil {
				return err
			}
			break
		case "id1_type":
			id1Type, err := cast.ToString(v)
			if err != nil {
				return err
			}
			edge.ID1Type = NodeType(id1Type)
			break
		case "edge_type":
			id, err := cast.ToUUIDString(v)
			if err != nil {
				return err
			}
			edge.EdgeType = EdgeType(id)
			break
		case "id2":
			edge.ID2, err = cast.ToUUIDString(v)
			if err != nil {
				return err
			}
			break
		case "id2_type":
			id2Type, err := cast.ToString(v)
			if err != nil {
				return err
			}
			edge.ID2Type = NodeType(id2Type)
			break
		case "time":
			edge.Time, err = cast.ToTime(v)
			if err != nil {
				return err
			}
			break
		case "data":
			edge.Data, err = cast.ToString(v)
			if err != nil {
				return err
			}
			break
		}
	}
	return nil
}

// EdgeResult stores the result of loading an Edge concurrently
type EdgeResult struct {
	Edge  Edge
	Error error
}

// EdgesResult stores the result of loading a slice of edges concurrently
type EdgesResult struct {
	Edges []*Edge
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
		var err error
		switch k {
		case "edge_type":
			edgeData.EdgeType, err = cast.ToUUIDString(v)
			if err != nil {
				return err
			}
			break
		case "edge_name":
			edgeData.EdgeName, err = cast.ToString(v)
			if err != nil {
				return err
			}
			break
		case "symmetric_edge":
			edgeData.SymmetricEdge, err = cast.ToBool(v)
			if err != nil {
				return err
			}
			break
		case "inverse_edge_type":
			if v != nil {
				//				spew.Dump("inverse_edge_type",v)
				id, err := cast.ToUUIDString(v)
				if err != nil {
					return err
				}
				edgeData.InverseEdgeType = &sql.NullString{
					Valid:  true,
					String: id,
				}
			}
			break
		case "edge_table":
			edgeData.EdgeTable, err = cast.ToString(v)
			if err != nil {
				return err
			}
			break
		}
	}
	return nil
}
