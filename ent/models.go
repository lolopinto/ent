package ent

import (
	"database/sql"

	"fmt"
	"reflect"
	"runtime/debug"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/rocketlaunchr/remember-go"

	"github.com/lolopinto/ent/data"
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

// LoadNode loads a single node given the id, node object and entConfig
// LoadNodeFromParts loads a node given different strings
func LoadNodeFromParts(entity DBObject, config Config, parts ...interface{}) error {
	return loadData(
		&loadNodeFromPartsLoader{
			config: config,
			parts:  parts,
			entity: entity,
		},
	)
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
func LoadNodeRawData(id string, entity DBObject, entConfig Config) error {
	return loadData(
		&loadNodeFromPKey{
			id:        id,
			tableName: entConfig.GetTableName(),
			entity:    entity,
		},
	)
}

// LoadNodesRawData loads raw data for multiple objects
func LoadNodesRawData(ids []string, entLoader MultiEntLoader) error {
	l := &loadNodesLoader{
		ids:       ids,
		entLoader: entLoader,
	}
	return loadData(l)
}

func genLoadRawData(id string, entity DBObject, entConfig Config, errChan chan<- error) {
	err := LoadNodeRawData(id, entity, entConfig)
	errChan <- err
}

// TODO also move to lower level loader/data package
func LoadRawForeignKeyNodes(id string, colName string, entLoader MultiEntLoader) error {
	res := <-genLoadForeignKeyNodes(id, colName, entLoader)
	return res.err
}

func genLoadForeignKeyNodes(id string, colName string, entLoader MultiEntLoader) <-chan multiEntResult {
	res := make(chan multiEntResult)
	go func() {
		l := &loadNodesLoader{
			entLoader: entLoader,
			whereParts: []interface{}{
				colName,
				id,
			},
		}
		err := loadData(l)
		res <- getMultiEntResult(entLoader, l, err)
	}()
	return res
}

func SaveChangeset(changeset Changeset) error {
	// TODO critical observers!
	err := executeOperations(changeset.GetExecutor())
	if err != nil {
		return err
	}
	entity := changeset.Entity()
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

	var res sql.Result

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

// this is a hack because i'm lazy and don't want to go update getFieldsAndValuesOfStruct()
// to do the right thing for now. now that I know what's going on here, can update everything
func findID(entity interface{}, pkeyFieldName ...string) string {
	name := "ID"
	if len(pkeyFieldName) != 0 {
		name = pkeyFieldName[0]
	}
	value := reflect.ValueOf(entity).Elem()
	valueType := value.Type()
	for i := 0; i < value.NumField(); i++ {
		field := value.Field(i)
		typeOfField := valueType.Field(i)
		fieldType := field.Type()

		if typeOfField.Name == name {
			return field.Interface().(string)
		}
		if field.Kind() == reflect.Struct {
			for j := 0; j < field.NumField(); j++ {
				field2 := field.Field(j)
				if fieldType.Field(j).Name == name {
					return field2.Interface().(string)
				}
			}
		}
	}
	panic("Could not find ID field")
}

func deleteNodeInTransaction(entity interface{}, entConfig Config, tx *sqlx.Tx) error {
	if entity == nil {
		return errors.New("nil pointer passed to DeleteNode")
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", entConfig.GetTableName())
	id := findID(entity)

	deleteKey(getKeyForNode(id, entConfig.GetTableName()))
	return performWrite(query, []interface{}{id}, tx, nil)
}

// DeleteNode deletes a node given the node object
func DeleteNode(entity interface{}, entConfig Config) error {
	return deleteNodeInTransaction(entity, entConfig, nil)
}

// EdgeOptions is a struct that can be used to configure an edge.
// Time refers to the time associated with the edge. If not specified, defaults to current time
// Data refers to whatever information that needs to be stored/associated with the edge
// It's up to 255 characters
type EdgeOptions struct {
	Time time.Time
	Data string
}

func getEdgeEntities(entity1 interface{}, entity2 interface{}) (Entity, Entity, error) {
	var ok bool
	var ent1, ent2 Entity
	ent1, ok = entity1.(Entity)
	if !ok {
		return nil, nil, errors.New("entity1 is not an entity")
	}
	ent2, ok = entity2.(Entity)
	if !ok {
		return nil, nil, errors.New("entity2 is not an entity")
	}
	return ent1, ent2, nil
}

// TODO figure out correct long-term API here
// this is the single get of GenLoadAssocEdges so shouldn't be too hard
func GetEdgeInfo(edgeType EdgeType, tx *sqlx.Tx) (*AssocEdgeData, error) {
	edgeData := &AssocEdgeData{}
	err := loadData(
		&loadNodeFromPKey{
			id:        string(edgeType),
			tableName: "assoc_edge_config",
			entity:    edgeData,
		},
		cfgtx(tx),
	)
	return edgeData, err
}

func addEdgeInTransaction(entity1 interface{}, entity2 interface{}, edgeType EdgeType, edgeOptions EdgeOptions, tx *sqlx.Tx) error {
	ent1, ent2, err := getEdgeEntities(entity1, entity2)
	if err != nil {
		return err
	}

	id1 := findID(entity1)
	id2 := findID(entity2)

	return addEdgeInTransactionRaw(
		edgeType,
		id1,
		id2,
		ent1.GetType(),
		ent2.GetType(),
		edgeOptions,
		tx,
	)
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

func addEdge(entity1 interface{}, entity2 interface{}, edgeType EdgeType, edgeOptions EdgeOptions) error {
	return addEdgeInTransaction(entity1, entity1, edgeType, edgeOptions, nil)
}

func deleteEdgeInTransaction(entity1 interface{}, entity2 interface{}, edgeType EdgeType, tx *sqlx.Tx) error {
	_, _, err := getEdgeEntities(entity1, entity2)
	if err != nil {
		return err
	}

	id1 := findID(entity1)
	id2 := findID(entity2)

	return deleteEdgeInTransactionRaw(edgeType, id1, id2, tx)
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

func deleteEdge(entity1 interface{}, entity2 interface{}, edgeType EdgeType) error {
	return deleteEdgeInTransaction(entity1, entity1, edgeType, nil)
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
	// if err == sql.ErrNoRows {
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

func LoadRawNodesByType(id string, edgeType EdgeType, entLoader MultiEntLoader) error {
	res := <-genLoadNodesByType(id, edgeType, entLoader)
	return res.err
}

func getMultiEntResult(entLoader MultiEntLoader, l *loadNodesLoader, err error) multiEntResult {
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

func genLoadNodesByType(id string, edgeType EdgeType, entLoader MultiEntLoader) <-chan multiEntResult {
	res := make(chan multiEntResult)
	go func() {
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
		res <- getMultiEntResult(entLoader, l, err)
	}()
	return res
}

func genLoadNodes(ids []string, entLoader MultiEntLoader) <-chan multiEntResult {
	res := make(chan multiEntResult)
	go func() {
		l := &loadNodesLoader{
			ids:       ids,
			entLoader: entLoader,
		}
		err := loadData(l)
		res <- getMultiEntResult(entLoader, l, err)
	}()
	return res
}

func GenLoadAssocEdges(nodes *[]*AssocEdgeData) error {
	// TODO....
	return chainLoaders(
		[]loader{
			&loadAssocEdgeConfigExists{},
			&loadNodesLoader{
				rawQuery: "SELECT * FROM assoc_edge_config",
				//				nodes:    nodes,
			},
		},
	)
}

func LoadRawQuery(query string, nodes interface{}) error {
	// TODO
	return nil
	// return loadData(&loadMultipleNodesFromQuery{
	// 	sqlBuilder: &sqlBuilder{
	// 		rawQuery: query,
	// 	},
	// 	nodes: nodes,
	// })
}
