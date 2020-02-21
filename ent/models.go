package ent

import (
	dbsql "database/sql"

	"fmt"
	"runtime/debug"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/rocketlaunchr/remember-go"

	"github.com/lolopinto/ent/data"
	"github.com/lolopinto/ent/ent/sql"

	entreflect "github.com/lolopinto/ent/internal/reflect"
	"github.com/pkg/errors"
)

func getValuesDataForUpdate(columns []string, values []interface{}) string {
	if len(values) != len(columns) {
		panic("columns and values not of equal length for update")
	}
	var vals []string
	for i, column := range columns {
		setter := fmt.Sprintf("%s = $%d", column, i+1)
		vals = append(vals, setter)
	}

	valsString := strings.Join(vals, ", ")
	return valsString
}

/*
* For an INSERT or UPDATE string, return the string for values
* @see getValuesDataForInsert() and getValuesDataForUpdate
 */
func getValsString(values []interface{}) string {
	var vals []string
	for i := range values {
		vals = append(vals, fmt.Sprintf("$%d", i+1))
	}
	return strings.Join(vals, ", ")
}

/*
 * Given a list of columns, returns a comma separated list for use in a SQL statement
 */
func getColumnsString(columns []string) string {
	return strings.Join(columns, ", ")
}

func getKeyForNode(id, tableName string) string {
	if id == "" {
		debug.PrintStack()
		panic(errors.WithStack(errors.New("empty id passed")))
	}
	return remember.CreateKey(false, "_", "table_id", tableName, id)
}

func getKeyForEdge(id string, edgeType EdgeType) string {
	return remember.CreateKey(false, "_", "edge_id", edgeType, id)
}

// func getKeyForEdgePair(id string, edgeType EdgeType, id2 string) string {
// 	if id == "" || id2 == "" {
// 		panic(errors.WithStack(errors.New("empty id passed")))
// 	}
// 	return remember.CreateKey(false, "_", "edge_id_id2", edgeType, id, id2)
// }

// TODO move this and other raw data access pattern methods to a lower level API below ent
func LoadNodeRawData(id string, entLoader Loader) (map[string]interface{}, error) {
	l := &loadNodeLoader{
		id:        id,
		entLoader: entLoader,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRow, err
}

// LoadNodesRawData loads raw data for multiple objects
func LoadNodesRawData(ids []string, entLoader Loader) ([]map[string]interface{}, error) {
	l := &loadNodesLoader{
		ids:       ids,
		entLoader: entLoader,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRows, err
}

// TODO comments everything
func LoadNodesRawDataViaQueryClause(entLoader Loader, clause sql.QueryClause) ([]map[string]interface{}, error) {
	l := &loadNodesLoader{
		entLoader: entLoader,
		clause:    clause,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRows, err
}

func LoadNodeRawDataViaQueryClause(entLoader Loader, clause sql.QueryClause) (map[string]interface{}, error) {
	l := &loadNodeLoader{
		entLoader: entLoader,
		clause:    clause,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRow, err
}

func loadNodesViaClause(entLoader Loader, clause sql.QueryClause) multiEntResult {
	l := &loadNodesLoader{
		entLoader: entLoader,
		clause:    clause,
	}
	err := loadData(l)
	return getMultiEntResult(entLoader, l, err)
}

func SaveChangeset(changeset Changeset) error {
	// TODO critical observers!
	err := executeOperations(changeset.GetExecutor())
	if err != nil {
		return err
	}
	entity := changeset.Entity()
	// TODO fix this.
	// This should be set beforehand
	// anything which doesn't have this needs to be fixed...
	if !isNil(entity) {
		entreflect.SetViewerInEnt(changeset.GetViewer(), entity)
	}
	return err
}

func getStmtFromTx(tx *sqlx.Tx, db *sqlx.DB, query string) (*sqlx.Stmt, error) {
	var stmt *sqlx.Stmt
	var err error

	// handle if in transcation or not.
	if tx == nil {
		// automatically rebinding now but we need to handle this better later
		// TODO this is the only place i'm rebinding
		// change everything to stop using $ and now use "?"
		query = db.Rebind(query)
		stmt, err = db.Preparex(query)
	} else {
		query = tx.Rebind(query)
		stmt, err = tx.Preparex(query)
	}
	return stmt, err
}

/*
 * performs a write (INSERT, UPDATE, DELETE statement) given the SQL statement
 * and values to be updated in the database
 */
func performWrite(query string, values []interface{}, tx *sqlx.Tx, entity Entity) error {
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	stmt, err := getStmtFromTx(tx, db, query)

	if err != nil {
		fmt.Println(err)
		return err
	}

	var res dbsql.Result

	checkRows := false
	if entity == nil {
		checkRows = true
		res, err = stmt.Exec(values...)
	} else {
		row := stmt.QueryRowx(values...)
		err = queryRow(row, entity)
	}
	//fmt.Println(query)

	if err != nil {
		fmt.Println(err)
		fmt.Println(query, values)
		return err
	}
	defer stmt.Close()

	// TODO may need to eventually make this optional but for now
	// let's assume all writes should affect at least one row
	if checkRows {
		// TODO this doesn't work anymore  when removing an edge that may not exist
		// so if we still care about this move this to a new layer
		rowCount, err := res.RowsAffected()
		if err != nil || rowCount == 0 {
			//fmt.Println(err, rowCount)
			return err
		}
	}
	return nil
}

func deleteNodeInTransaction(entity DBObject, entConfig Config, tx *sqlx.Tx) error {
	if entity == nil {
		return errors.New("nil pointer passed to deleteNodeInTransaction")
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", entConfig.GetTableName())
	id := entity.GetID()

	deleteKey(getKeyForNode(id, entConfig.GetTableName()))
	return performWrite(query, []interface{}{id}, tx, nil)
}

// EdgeOptions is a struct that can be used to configure an edge.
// Time refers to the time associated with the edge. If not specified, defaults to current time
// Data refers to whatever information that needs to be stored/associated with the edge
// It's up to 255 characters
type EdgeOptions struct {
	Time time.Time
	Data string
}

func addEdgeInTransactionRaw(edgeType EdgeType, id1, id2 string, id1Ttype, id2Type NodeType, edgeOptions EdgeOptions, tx *sqlx.Tx) error {
	edgeData, err := GetEdgeInfo(edgeType, tx)
	if err != nil {
		return err
	}

	cols := []string{
		"id1",
		"id1_type",
		"edge_type",
		"id2",
		"id2_type",
		"time",
		"data",
	}

	// get time for queries
	var t time.Time
	if edgeOptions.Time.IsZero() {
		t = time.Now()
	} else {
		t = edgeOptions.Time
	}

	vals := []interface{}{
		id1,
		id1Ttype,
		edgeType,
		id2,
		id2Type,
		t,
		edgeOptions.Data, // zero value of data works for us. no check needed
	}

	//	spew.Dump("data!!!!", edgeOptions.Data)
	query := fmt.Sprintf(
		// postgres specific
		// this is where the db dialects will eventually be needed
		"INSERT into %s (%s) VALUES(%s) ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
		edgeData.EdgeTable,
		getColumnsString(cols),
		getValsString(vals),
	)

	deleteKey(getKeyForEdge(id1, edgeType))
	return performWrite(query, vals, tx, nil)
}

func deleteEdgeInTransactionRaw(edgeType EdgeType, id1, id2 string, tx *sqlx.Tx) error {
	edgeData, err := GetEdgeInfo(edgeType, tx)
	if err != nil {
		return err
	}

	query := fmt.Sprintf(
		"DELETE FROM %s WHERE id1 = $1 AND edge_type = $2 AND id2 = $3",
		edgeData.EdgeTable,
	)

	vals := []interface{}{
		id1,
		edgeType,
		id2,
	}

	//fmt.Println(query)
	deleteKey(getKeyForEdge(id1, edgeType))

	return performWrite(query, vals, tx, nil)
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

func Limit(limit int) func(*LoadEdgeConfig) {
	return func(cfg *LoadEdgeConfig) {
		cfg.limit = &limit
	}
}

func LoadEdgesByType(id string, edgeType EdgeType, options ...func(*LoadEdgeConfig)) ([]*AssocEdge, error) {
	l := &loadEdgesByType{
		id:       id,
		edgeType: edgeType,
	}
	return l.LoadData()
}

func LoadUniqueEdgeByType(id string, edgeType EdgeType) (*AssocEdge, error) {
	edges, err := LoadEdgesByType(id, edgeType, Limit(1))
	if err != nil {
		return nil, err
	}
	return edges[0], err
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
	// check if we can use the standard id1->edgeType cache
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
	return &AssocEdge{}, nil

	// this checks if the edge exists based on the cache key and then does nothing about it
	// I think this approach is the best longterm approach but we don't have the way to delete
	// all the pairwise edges when there's a miss
	// above is only a temporary solution.
	// key := getKeyForEdge(id, edgeType)
	// items, err := getItemsInCache(key)
	// if err != nil {
	// 	return nil, err
	// }
	// if items != nil {
	// 	for _, item := range items {
	// 		//			spew.Dump(item)
	// 		if item["id2"] != nil {
	// 			fmt.Printf("cache hit id1 %s, edge_type %s, id2 %s \n", id, edgeType, id2)
	// 			var edge Edge
	// 			err = edge.FillFromMap(item)
	// 			if err != nil {
	// 				return nil, err
	// 			} else {
	// 				return &edge, nil
	// 			}
	// 		}
	// 	}
	// }
	// fmt.Printf("cache miss id1 %s, edge_type %s, id2 %s \n", id, edgeType, id2)

	// // todo...
	// // sql no rows behavior
	// if id == "" || id2 == "" {
	// 	return &Edge{}, nil
	// }
	// db := data.DBConn()
	// if db == nil {
	// 	err := errors.New("error getting a valid db connection")
	// 	fmt.Println(err)
	// 	return nil, err
	// }

	// edgeData, err := getEdgeInfo(edgeType, nil)
	// if err != nil {
	// 	return nil, err
	// }
	// query := fmt.Sprintf(
	// 	"SELECT * FROM %s WHERE id1 = $1 AND edge_type = $2 AND id2 = $3",
	// 	edgeData.EdgeTable,
	// )
	// fmt.Println(query)

	// stmt, err := db.Preparex(query)
	// if err != nil {
	// 	fmt.Println(err)
	// 	return nil, err
	// }
	// defer stmt.Close()

	// var edge Edge

	// err = stmt.QueryRowx(id, edgeType, id2).StructScan(&edge)

	// // nil state. return zero value of Edge for now. maybe come up with better
	// // way of doing this in the future
	// if err == dbsql.ErrNoRows {
	// 	//fmt.Println("no rows", err)
	// 	// don't mark this as an error. just no data
	// 	return &Edge{}, nil
	// }
	// if err != nil {
	// 	fmt.Println(err)
	// 	return nil, err
	// }

	// // TODO handle no edge. what's the correct error type here?
	// return &edge, nil
}

func LoadRawNodesByType(id string, edgeType EdgeType, entLoader Loader) ([]map[string]interface{}, error) {
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

func getMultiEntResult(entLoader Loader, l *loadNodesLoader, err error) multiEntResult {
	if err != nil {
		return multiEntResult{
			err: err,
		}
	}
	return multiEntResult{
		ents:   l.dbobjects,
		loader: entLoader,
	}
}

func loadNodesByType(id string, edgeType EdgeType, entLoader Loader) multiEntResult {
	l := &loadNodesLoader{
		entLoader: entLoader,
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
	return getMultiEntResult(entLoader, l, err)
}

func loadNodes(ids []string, entLoader Loader) multiEntResult {
	l := &loadNodesLoader{
		ids:       ids,
		entLoader: entLoader,
	}
	err := loadData(l)
	return getMultiEntResult(entLoader, l, err)
}

// TODO figure out correct long-term API here
// this is the single get of GenLoadAssocEdges so shouldn't be too hard
func GetEdgeInfo(edgeType EdgeType, tx *sqlx.Tx) (*AssocEdgeData, error) {
	l := &loadNodeLoader{
		id:        string(edgeType),
		entLoader: &assocEdgeLoader{},
	}
	err := loadData(l, cfgtx(tx))
	if err != nil {
		return nil, err
	}
	return l.GetEntity().(*AssocEdgeData), nil
}

func GetEdgeInfos(edgeTypes []string) (map[EdgeType]*AssocEdgeData, error) {
	entLoader := &assocEdgeLoader{}
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
		entLoader := &assocEdgeLoader{}
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

func GenLoadRawQuery(query string, loader Loader) <-chan error {
	res := make(chan error)
	go func() {
		res <- loadData(&loadNodesLoader{
			rawQuery:  query,
			entLoader: loader,
		})
	}()
	return res
}

func LoadRawQuery(query string, loader Loader) ([]map[string]interface{}, error) {
	l := &loadNodesLoader{
		rawQuery:  query,
		entLoader: loader,
		rawData:   true,
	}
	err := loadData(l)
	return l.dataRows, err
}
