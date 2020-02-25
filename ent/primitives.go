package ent

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/lolopinto/ent/ent/sql"
)

// LoadNodeRawData is the public API to load the raw data for an ent without privacy checks
func LoadNodeRawData(id string, entLoader Loader) (map[string]interface{}, error) {
	l := &loadNodeLoader{
		id:        id,
		entLoader: entLoader,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRow, err
}

// LoadNodesRawData loads raw data for multiple objects given their ids
func LoadNodesRawData(ids []string, entLoader Loader) ([]map[string]interface{}, error) {
	l := &loadNodesLoader{
		ids:       ids,
		entLoader: entLoader,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRows, err
}

// LoadNodesRawDataViaQueryClause takes a query clause e.g. sql.Eq("id", "{id of foreign key here}")
// and returns the raw data for all nodes that map to that
func LoadNodesRawDataViaQueryClause(entLoader Loader, clause sql.QueryClause) ([]map[string]interface{}, error) {
	l := &loadNodesLoader{
		entLoader: entLoader,
		clause:    clause,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRows, err
}

// LoadNodeRawDataViaQueryClause takes a query clause e.g. sql.Eq("email_address", "test@email.com")
// and returns the raw data for a (the) node that maps to that
func LoadNodeRawDataViaQueryClause(entLoader Loader, clause sql.QueryClause) (map[string]interface{}, error) {
	l := &loadNodeLoader{
		entLoader: entLoader,
		clause:    clause,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRow, err
}

// LoadRawNodesByType loads the nodes at the end of an edge
func LoadRawNodesByType(id string, edgeType EdgeType, entLoader Loader) ([]map[string]interface{}, error) {
	// options... once we do EntQuery
	l := &loadNodesLoader{
		entLoader: entLoader,
		rawData:   true,
	}
	err := chainLoaders(
		[]loader{
			&loadEdgesByType{
				id:         id,
				edgeType:   edgeType,
				outputID2s: true,
			},
			l,
		},
	)
	return l.dataRows, err
}

// LoadEdgesByType loads the edges for a given type
func LoadEdgesByType(id string, edgeType EdgeType, options ...func(*LoadEdgeConfig)) ([]*AssocEdge, error) {
	l := &loadEdgesByType{
		id:       id,
		edgeType: edgeType,
		options:  options,
	}
	return l.LoadData()
}

// GenLoadEdgesByType handles loading of edges concurrently.
// Because we get strong typing across all edges and for a consistent API with loading Nodes,
// we use the EdgesResult struct here
func GenLoadEdgesByType(id string, edgeType EdgeType, options ...func(*LoadEdgeConfig)) <-chan *AssocEdgesResult {
	res := make(chan *AssocEdgesResult)
	go func() {
		edges, err := LoadEdgesByType(id, edgeType, options...)
		res <- &AssocEdgesResult{
			Edges: edges,
			Err:   err,
		}
	}()
	return res
}

// LoadUniqueEdgeByType loads the unique edge for a given type.
// Applies a limit 1 to the query
func LoadUniqueEdgeByType(id string, edgeType EdgeType) (*AssocEdge, error) {
	edges, err := LoadEdgesByType(id, edgeType, Limit(1))
	if err != nil {
		return nil, err
	}
	return edges[0], err
}

// GenLoadUniqueEdgeByType is the concurrent version of LoadUniqueEdgeByType
func GenLoadUniqueEdgeByType(id string, edgeType EdgeType) <-chan *AssocEdgeResult {
	res := make(chan *AssocEdgeResult)
	go func() {
		edge, err := LoadUniqueEdgeByType(id, edgeType)
		res <- &AssocEdgeResult{
			Edge: edge,
			Err:  err,
		}
	}()
	return res
}

// GenLoadEdgeByType is the concurrent version of LoadEdgeByType
func GenLoadEdgeByType(id1, id2 string, edgeType EdgeType) <-chan *AssocEdgeResult {
	res := make(chan *AssocEdgeResult)
	go func() {
		edge, err := LoadEdgeByType(id1, id2, edgeType)
		res <- &AssocEdgeResult{
			Edge: edge,
			Err:  err,
		}

	}()
	return res
}

// LoadEdgeByType checks if an edge exists between 2 ids
func LoadEdgeByType(id string, id2 string, edgeType EdgeType) (*AssocEdge, error) {
	// TODO 2/25/2020 the logic we eventually want here is if count is less than say 10,000 or whatever we decide the cache limit
	// is, load that, and do a check for id2 in memory
	// otherwise, if no cache or if count is a lot bigger than the limit,
	// need to do a check in the database directly
	// probably not worth having cache for each edge by default.
	// need to provide a way for places to override it as needed
	edges, err := LoadEdgesByType(id, edgeType)
	if err != nil {
		return nil, err
	}
	for _, edge := range edges {
		if edge.ID2 == id2 {
			return edge, nil
		}
	}
	// no edge
	return nil, nil
}

// EdgeOptions is a struct that can be used to configure an edge.
// Time refers to the time associated with the edge. If not specified, defaults to current time
// Data refers to whatever information that needs to be stored/associated with the edge
// It's up to 255 characters (hmm not true right now)
type EdgeOptions struct {
	Time time.Time
	Data string
}

// LoadEdgeConfig configures the way to load edges
// This will eventually be used in EntQuery but allows us to start testing and building some things...
type LoadEdgeConfig struct {
	limit *int
}

func (cfg *LoadEdgeConfig) getKey() string {
	if cfg.limit == nil {
		return ""
	}
	return fmt.Sprintf("limit:%d", cfg.limit)
}

// Limit is an option passed to edge queries to limit the number of edges returned
func Limit(limit int) func(*LoadEdgeConfig) {
	return func(cfg *LoadEdgeConfig) {
		cfg.limit = &limit
	}
}

// GetEdgeInfo gets the edge information for a given edgeType
// TODO figure out correct long-term API here
// this is the single get of GenLoadAssocEdges so shouldn't be too hard
func GetEdgeInfo(edgeType EdgeType, tx *sqlx.Tx) (*AssocEdgeData, error) {
	l := &loadNodeLoader{
		id:        string(edgeType),
		entLoader: &AssocEdgeLoader{},
	}
	err := loadData(l, cfgtx(tx))
	if err != nil {
		return nil, err
	}
	return l.GetEntity().(*AssocEdgeData), nil
}

// GetEdgeInfos gets the edge information for a list of edges
func GetEdgeInfos(edgeTypes []string) (map[EdgeType]*AssocEdgeData, error) {
	entLoader := &AssocEdgeLoader{}
	l := &loadNodesLoader{
		entLoader: entLoader,
		ids:       edgeTypes,
	}
	err := loadData(l)
	return entLoader.GetMap(), err
}

// GenLoadAssocEdges loads all assoc edges from the db
// TODO correct cache for this. we should load this once per request or have this
// be in a central cache easily available
func GenLoadAssocEdges() <-chan AssocEdgeDatasResult {
	res := make(chan AssocEdgeDatasResult)
	go func() {
		entLoader := &AssocEdgeLoader{}
		err := chainLoaders(
			[]loader{
				&loadAssocEdgeConfigExists{},
				&loadNodesLoader{
					rawQuery:  "SELECT * FROM assoc_edge_config",
					entLoader: entLoader,
				},
			},
		)
		if err != nil {
			res <- AssocEdgeDatasResult{
				Err: err,
			}
		} else {
			res <- AssocEdgeDatasResult{
				Edges: entLoader.results,
			}
		}
	}()
	return res
}

// LoadRawQuery takes a raw query string and runs it and gets the results in the raw format
func LoadRawQuery(query string, loader Loader) ([]map[string]interface{}, error) {
	l := &loadNodesLoader{
		rawQuery:  query,
		entLoader: loader,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRows, err
}
