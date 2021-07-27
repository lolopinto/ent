package ent

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/util"
)

// AssocEdge is the information about an edge between two Nodes
// It's generic enough so that it applies across all types.
// Doesn't care what table it's stored in.
type AssocEdge struct {
	ID1      string         `db:"id1"`
	ID1Type  NodeType       `db:"id1_type"`
	EdgeType EdgeType       `db:"edge_type"`
	ID2      string         `db:"id2"`
	ID2Type  NodeType       `db:"id2_type"`
	Time     time.Time      `db:"time"`
	Data     sql.NullString `db:"data"`
}

// DBFields is used by the ent framework to load the edge from the underlying database
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
			return edge.Data.Scan(v)
		},
	}
}

// GetID returns a unique id for this ent
// TODO ola. audit where this is used right now
func (edge *AssocEdge) GetID() string {
	util.GoSchemaKill(fmt.Sprintf("AssocEdge.GetID called for edge %s", edge.EdgeType))
	return ""
	//	return string(edge.EdgeType)
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

// AssocEdgeData is corresponding ent for AssocEdgeConfig
type AssocEdgeData struct {
	EdgeType        EdgeType       `db:"edge_type" pkey:"true"` // if you have a pkey, don't add id uuid since we already have one...
	EdgeName        string         `db:"edge_name"`
	SymmetricEdge   bool           `db:"symmetric_edge"`
	InverseEdgeType sql.NullString `db:"inverse_edge_type"`
	EdgeTable       string         `db:"edge_table"`
	Timestamps
}

// DBFields is used by the ent framework to load the ent from the underlying database
func (edgeData *AssocEdgeData) DBFields() DBFields {
	// can cache AssocEdgeData though :/
	// however leaving as-is because probably better for when this comes from a different cache
	return DBFields{
		"edge_type": func(v interface{}) error {
			edgeType, err := cast.ToUUIDString(v)
			edgeData.EdgeType = EdgeType(edgeType)
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
			return edgeData.InverseEdgeType.Scan(id)
		},
		"edge_table": func(v interface{}) error {
			var err error
			edgeData.EdgeTable, err = cast.ToString(v)
			return err
		},
		"created_at": func(v interface{}) error {
			var err error
			edgeData.CreatedAt, err = cast.ToTime(v)
			return err
		},
		"updated_at": func(v interface{}) error {
			var err error
			edgeData.UpdatedAt, err = cast.ToTime(v)
			return err
		},
	}
}

// GetPrimaryKey is used to let the ent framework know what column is being edited
func (edgeData *AssocEdgeData) GetPrimaryKey() string {
	return "edge_type"
}

// TODO.... all of these exist just to write the ent
// we need to break this up for tests
// or worst case translate AssocEdgeData to a fake object that is an ent for use by node_map_test.go
func (edgeData *AssocEdgeData) GetID() string {
	return string(edgeData.EdgeType)
}

func (edgeData *AssocEdgeData) GetPrivacyPolicy() PrivacyPolicy {
	util.GoSchemaKill("AssocEdgedata.GetPrivacyPolicy called")
	return nil
}

func (edgeData *AssocEdgeData) GetType() NodeType {
	util.GoSchemaKill("AssocEdgedata.GetType called")
	return ""
}

func (edgeData *AssocEdgeData) GetViewer() viewer.ViewerContext {
	util.GoSchemaKill("AssocEdgedata.GetViewer called")
	return nil
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

// AssocEdgeLoader is used to load AssocEdgeData. implements Loader interface
type AssocEdgeLoader struct {
	results []*AssocEdgeData
}

// GetNewInstance reutrns a new AssocEdgeData to be used to retrieve data from database
func (res *AssocEdgeLoader) GetNewInstance() DBObject {
	var edge AssocEdgeData
	res.results = append(res.results, &edge)
	return &edge
}

// GetMap returns a map of EdgeType to AssocEdgeData
// Provides a non-list API for the loaded data
func (res *AssocEdgeLoader) GetMap() map[EdgeType]*AssocEdgeData {
	m := make(map[EdgeType]*AssocEdgeData, len(res.results))
	for _, edge := range res.results {
		m[edge.EdgeType] = edge
	}
	return m
}

// GetPrimaryKey indicates which column is the primary key in the assoc_edge_config table
func (res *AssocEdgeLoader) GetPrimaryKey() string {
	return "edge_type"
}

// GetConfig returns the config/scheme for this object
func (res *AssocEdgeLoader) GetConfig() Config {
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
