package ent

import (
	"database/sql"
	"time"

	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/viewer"
)

// AssocEdge is the information about an edge between two Nodes
// It's generic enough so that it applies across all types.
// Doesn't care what table it's stored in.
// TODO fix comment about where edges are stored.
// By default, edges are stored in the `edges_info` table but we
// can have custom edge tables for specific edges where we know
// there'll be a lot of data
type AssocEdge struct {
	ID1      string    `db:"id1"`
	ID1Type  NodeType  `db:"id1_type"`
	EdgeType EdgeType  `db:"edge_type"`
	ID2      string    `db:"id2"`
	ID2Type  NodeType  `db:"id2_type"`
	Time     time.Time `db:"time"`
	Data     string    `db:"data"` // nullable TODO nullable strings
}

func (edge *AssocEdge) DBFields() DBFields {
	return DBFields{
		"id1": func(v interface{}) error {
			var err error
			edge.ID1, err = cast.ToUUIDString(v)
			return err
		},
		"id1_type": func(v interface{}) error {
			id1Type, err := cast.ToString(v)
			edge.ID1Type = NodeType(id1Type)
			return err
		},
		"edge_type": func(v interface{}) error {
			id, err := cast.ToUUIDString(v)
			edge.EdgeType = EdgeType(id)
			return err
		},
		"id2": func(v interface{}) error {
			var err error
			edge.ID2, err = cast.ToUUIDString(v)
			return err
		},
		"id2_type": func(v interface{}) error {
			id2Type, err := cast.ToString(v)
			edge.ID2Type = NodeType(id2Type)
			return err
		},
		"time": func(v interface{}) error {
			var err error
			edge.Time, err = cast.ToTime(v)
			return err
		},
		"data": func(v interface{}) error {
			var err error
			edge.Data, err = cast.ToString(v)
			return err
		},
	}
}

// TODO...
func (edge *AssocEdge) GetID() string {
	return edge.ID1
}

// AssocEdgeResult stores the result of loading an Edge concurrently
type AssocEdgeResult struct {
	Edge *AssocEdge
	Err  error
}

func (res *AssocEdgeResult) Error() string {
	return res.Err.Error()
}

// AssocEdgesResult stores the result of loading a slice of edges concurrently
type AssocEdgesResult struct {
	Edges []*AssocEdge
	Err   error
}

func (res *AssocEdgesResult) Error() string {
	return res.Err.Error()
}

func (res *AssocEdgesResult) GetNewInstance() *AssocEdge {
	var edge AssocEdge
	return &edge
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

func (edgeData *AssocEdgeData) DBFields() DBFields {
	// can cache AssocEdgeData though :/
	// however leaving as-is because probably better for when this comes from a different cache
	return DBFields{
		"edge_type": func(v interface{}) error {
			var err error
			edgeData.EdgeType, err = cast.ToUUIDString(v)
			return err
		},
		"edge_name": func(v interface{}) error {
			var err error
			edgeData.EdgeName, err = cast.ToString(v)
			return err
		},
		"symmetric_edge": func(v interface{}) error {
			var err error
			edgeData.SymmetricEdge, err = cast.ToBool(v)
			return err
		},
		"inverse_edge_type": func(v interface{}) error {
			id, err := cast.ToUUIDString(v)
			if err != nil {
				return err
			}
			// empty string. nothing to do here since this is nullable
			if id == "" {
				return nil
			}
			edgeData.InverseEdgeType = &sql.NullString{
				Valid:  true,
				String: id,
			}
			return nil
		},
		"edge_table": func(v interface{}) error {
			var err error
			edgeData.EdgeTable, err = cast.ToString(v)
			return err
		},
	}
}

func (edgeData *AssocEdgeData) GetPrimaryKey() string {
	return "edge_type"
}

// TODO.... all of these exist just to write the ent
// we need to break this up for tests
// or worst case translate AssocEdgeData to a fake object that is an ent for use by node_map_test.go
func (edgeData *AssocEdgeData) GetID() string {
	return edgeData.EdgeType
}

func (edgeData *AssocEdgeData) GetPrivacyPolicy() PrivacyPolicy {
	panic("ss")
}

func (edgeData *AssocEdgeData) GetType() NodeType {
	panic("ss")
}

func (edgeData *AssocEdgeData) GetViewer() viewer.ViewerContext {
	panic("ss")
}

func (edgeData *AssocEdgeData) GetConfig() Config {
	return &AssocEdgeConfig{}
}

// AssocEdgeConfig is configuration used to configure edges in the ent-framework
type AssocEdgeConfig struct {
	EdgeType        string `db:"edge_type"`
	EdgeName        string `db:"edge_type"`
	SymmetricEdge   bool   `db:"symmetric_edge"`
	InverseEdgeType string `db:"inverse_edge_type"`
	EdgeTable       string `db:"edge_table"`
}

// GetTableName returns the underyling database table the model's data is stored
func (config *AssocEdgeConfig) GetTableName() string {
	return "assoc_edge_config"
}

type assocEdgeLoader struct {
	results []*AssocEdgeData
}

func (res *assocEdgeLoader) GetNewInstance() DBObject {
	var edge AssocEdgeData
	res.results = append(res.results, &edge)
	return &edge
}

func (res *assocEdgeLoader) GetConfig() Config {
	return &AssocEdgeConfig{}
}

// AssocEdgeDataResult stores the result of loading AssocEdgeData
type AssocEdgeDataResult struct {
	EdgeData *AssocEdgeData
	Err      error
}

func (res *AssocEdgeDataResult) Error() string {
	return res.Err.Error()
}

// AssocEdgeDatasResult stores the result of loading all assoc edges concurrently
type AssocEdgeDatasResult struct {
	Edges []*AssocEdgeData
	Err   error
}

func (res *AssocEdgeDatasResult) Error() string {
	return res.Err.Error()
}
