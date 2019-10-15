package ent

import (
	"database/sql"

	//	"errors"
	"fmt"
	"reflect"
	"runtime/debug"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/rocketlaunchr/remember-go"

	"github.com/jmoiron/sqlx/reflectx"
	"github.com/lolopinto/ent/data"
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
func LoadNodeFromParts(entity dataEntity, config Config, parts ...interface{}) error {
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
func LoadNodeRawData(id string, entity dataEntity, entConfig Config) error {
	return loadData(
		&loadNodeFromPKey{
			id:        id,
			tableName: entConfig.GetTableName(),
			entity:    entity,
		},
	)
}

func genLoadRawData(id string, entity dataEntity, entConfig Config, errChan chan<- error) {
	err := LoadNodeRawData(id, entity, entConfig)
	errChan <- err
}

func validateSliceOfNodes(nodes interface{}) (reflect.Type, *reflect.Value, error) {
	value := reflect.ValueOf(nodes)
	direct := reflect.Indirect(value)

	if value.Kind() != reflect.Ptr {
		return nil, nil, errors.New("must pass a pointer to method")
	}
	if value.IsNil() {
		return nil, nil, errors.New("nil pointer passed to method")
	}

	// get the slice from the pointer
	slice := reflectx.Deref(value.Type())
	if slice.Kind() != reflect.Slice {
		fmt.Printf("slice kind is not a slice. it's a %v \n", slice.Kind())
		return nil, nil, errors.New("format passed to method is unexpected")
	}
	return slice, &direct, nil
}

// TODO also move to lower level loader/data package
func LoadRawForeignKeyNodes(id string, nodes interface{}, colName string, entConfig Config) error {
	// build loader to use
	l := &loadMultipleNodesFromQueryNodeDependent{}
	l.sqlBuilder = &sqlBuilder{
		tableName: entConfig.GetTableName(),
		whereParts: []interface{}{
			colName,
			id,
		},
	}
	l.nodes = nodes
	return loadData(l)
}

func genLoadForeignKeyNodes(id string, nodes interface{}, colName string, entConfig Config, errChan chan<- error) {
	err := LoadRawForeignKeyNodes(id, nodes, colName, entConfig)
	errChan <- err
}

type EditedNodeInfo struct {
	ExistingEnt          Entity
	Entity               Entity
	EntConfig            Config
	EditableFields       ActionFieldMap
	Fields               map[string]interface{}
	InboundEdges         []*EditedEdgeInfo
	OutboundEdges        []*EditedEdgeInfo
	RemovedInboundEdges  []*EditedEdgeInfo
	RemovedOutboundEdges []*EditedEdgeInfo
}

type EditedEdgeInfo struct {
	EdgeType EdgeType
	Id       string
	NodeType NodeType
	Data     string
	Time     time.Time
}

func EdgeTime(t time.Time) func(*EditedEdgeInfo) {
	return func(info *EditedEdgeInfo) {
		info.Time = t
	}
}

func EdgeData(data string) func(*EditedEdgeInfo) {
	return func(info *EditedEdgeInfo) {
		info.Data = data
	}
}

// CreateNodeFromActionMap creates a new Node and returns it in Entity
// This is the new API for mutations that's going to replace the old CreateNode API
func CreateNodeFromActionMap(info *EditedNodeInfo) error {
	if info.ExistingEnt != nil {
		return fmt.Errorf("CreateNodeFromActionMap passed an existing ent when creating an ent")
	}

	// perform in a transaction as needed
	ops := buildOperations(info)
	return performAllOperations(ops)
}

// EditNodeFromActionMap edits a Node and returns it in Entity
// This is the new API for mutations that's going to replace the old UpdateNode API
func EditNodeFromActionMap(info *EditedNodeInfo) error {
	if info.ExistingEnt == nil {
		return fmt.Errorf("EditNodeFromActionMap needs the entity that's being updated")
	}

	// perform in a transaction as needed
	ops := buildOperations(info)
	return performAllOperations(ops)
}

func buildOperations(info *EditedNodeInfo) []dataOperation {
	// build up operations as needed
	// 1/ operation to create the ent as needed
	// TODO check to see if any fields
	ops := []dataOperation{
		&nodeWithActionMapOperation{info},
	}

	// 2 all inbound edges with id2 placeholder for newly created ent
	for _, edge := range info.InboundEdges {
		edgeOp := &edgeOperation{
			edgeType:  edge.EdgeType,
			id1:       edge.Id,
			id1Type:   edge.NodeType,
			operation: insertOperation,
			time:      edge.Time,
			data:      edge.Data,
		}
		if info.ExistingEnt == nil {
			edgeOp.id2 = idPlaceHolder
		} else {
			edgeOp.id2 = info.ExistingEnt.GetID()
			edgeOp.id2Type = info.ExistingEnt.GetType()
		}
		ops = append(ops, edgeOp)
	}

	// 3 all outbound edges with id1 placeholder for newly created ent
	for _, edge := range info.OutboundEdges {
		edgeOp := &edgeOperation{
			edgeType:  edge.EdgeType,
			id2:       edge.Id,
			id2Type:   edge.NodeType,
			operation: insertOperation,
			time:      edge.Time,
			data:      edge.Data,
		}
		if info.ExistingEnt == nil {
			edgeOp.id1 = idPlaceHolder
		} else {
			edgeOp.id1 = info.ExistingEnt.GetID()
			edgeOp.id1Type = info.ExistingEnt.GetType()
		}
		ops = append(ops, edgeOp)
	}

	// verbose but prefer operation private to ent
	for _, edge := range info.RemovedInboundEdges {
		edgeOp := &edgeOperation{
			edgeType:  edge.EdgeType,
			id1:       edge.Id,
			id1Type:   edge.NodeType,
			operation: deleteOperation,
		}
		if info.ExistingEnt == nil {
			panic("invalid. cannot remove edge when there's no existing ent")
		} else {
			edgeOp.id2 = info.ExistingEnt.GetID()
			edgeOp.id2Type = info.ExistingEnt.GetType()
		}
		ops = append(ops, edgeOp)
	}

	for _, edge := range info.RemovedOutboundEdges {
		edgeOp := &edgeOperation{
			edgeType:  edge.EdgeType,
			id2:       edge.Id,
			id2Type:   edge.NodeType,
			operation: deleteOperation,
		}
		if info.ExistingEnt == nil {
			panic("invalid. cannot remove edge when there's no existing ent")
		} else {
			edgeOp.id1 = info.ExistingEnt.GetID()
			edgeOp.id1Type = info.ExistingEnt.GetType()
		}
		ops = append(ops, edgeOp)
	}

	return ops
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
		err = stmt.QueryRowx(values...).StructScan(entity)
	}

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

	fmt.Println(query)

	deleteKey(getKeyForEdge(id1, edgeType))
	err = performWrite(query, vals, tx, nil)
	if err != nil {
		return err
	}

	// TODO should look into combining these into same QUERY similarly to what we need to do in CreateNodes()
	// need to re-write and test all of this

	// write symmetric edge
	if edgeData.SymmetricEdge {
		vals = []interface{}{
			id2,
			id2Type,
			edgeType,
			id1,
			id1Ttype,
			t,
			edgeOptions.Data,
		}

		query = fmt.Sprintf(
			"INSERT into %s (%s) VALUES(%s) ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
			edgeData.EdgeTable,
			getColumnsString(cols),
			getValsString(vals),
		)
		deleteKey(getKeyForEdge(id2, edgeType))
		return performWrite(query, vals, tx, nil)
	}

	// write inverse edge
	if edgeData.InverseEdgeType != nil && edgeData.InverseEdgeType.Valid {
		// write an edge from id2 to id2 with new edge type
		vals = []interface{}{
			id2,
			id2Type,
			edgeData.InverseEdgeType.String,
			id1,
			id1Ttype,
			t,
			edgeOptions.Data,
		}

		query = fmt.Sprintf(
			"INSERT into %s (%s) VALUES(%s) ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
			edgeData.EdgeTable,
			getColumnsString(cols),
			getValsString(vals),
		)
		deleteKey(getKeyForEdge(id2, EdgeType(edgeData.InverseEdgeType.String)))
		return performWrite(query, vals, tx, nil)
	}

	return nil
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

	err = performWrite(query, vals, tx, nil)
	if err != nil {
		return err
	}

	// TODO move this up a layer
	// should not be in addEdge and deleteEdge
	if edgeData.InverseEdgeType != nil && edgeData.InverseEdgeType.Valid {
		vals = []interface{}{
			id2,
			edgeData.InverseEdgeType.String,
			id1,
		}
		deleteKey(getKeyForEdge(id2, EdgeType(edgeData.InverseEdgeType.String)))
		return performWrite(query, vals, tx, nil)
	}

	if edgeData.SymmetricEdge {
		vals = []interface{}{
			id2,
			edgeType,
			id1,
		}
		deleteKey(getKeyForEdge(id2, edgeType))
		return performWrite(query, vals, tx, nil)
	}
	return nil
}

func deleteEdge(entity1 interface{}, entity2 interface{}, edgeType EdgeType) error {
	return deleteEdgeInTransaction(entity1, entity1, edgeType, nil)
}

func LoadEdgesByType(id string, edgeType EdgeType) ([]*Edge, error) {
	l := &loadEdgesByType{
		id:       id,
		edgeType: edgeType,
	}
	return l.LoadData()
}

// GenLoadEdgesByType handles loading of edges concurrently.
// Because we get strong typing across all edges and for a consistent API with loading Nodes,
// we use the EdgesResult struct here
func GenLoadEdgesByType(id string, edgeType EdgeType, chanEdgesResult chan<- EdgesResult) {
	edges, err := LoadEdgesByType(id, edgeType)
	// var edges []*Edge
	// chanErr := make(chan error)
	// go GenLoadEdgesByType(id, edgeType, &edges, chanErr)
	//	err := <-chanErr
	chanEdgesResult <- EdgesResult{
		Edges: edges,
		Error: err,
	}
}

// GenLoadEdgeByType is the concurrent version of LoadEdgeByType
func GenLoadEdgeByType(id1, id2 string, edgeType EdgeType, chanEdgeResult chan<- EdgeResult) {
	edge, err := LoadEdgeByType(id1, id2, edgeType)
	chanEdgeResult <- EdgeResult{
		Edge:  edge,
		Error: err,
	}
}

// LoadEdgeByType checks if an edge exists between 2 ids
func LoadEdgeByType(id string, id2 string, edgeType EdgeType) (*Edge, error) {
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
	return &Edge{}, nil

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

func LoadRawNodesByType(id string, edgeType EdgeType, nodes interface{}, entConfig Config) error {
	l := &loadNodesLoader{
		entConfig: entConfig,
	}
	l.nodes = nodes
	return chainLoaders(
		[]loader{
			&loadEdgesByType{
				id:         id,
				edgeType:   edgeType,
				outputID2s: true,
			},
			l,
		},
	)
}

func genLoadNodesByType(id string, edgeType EdgeType, nodes interface{}, entConfig Config, errChan chan<- error) {
	err := LoadRawNodesByType(id, edgeType, nodes, entConfig)
	//fmt.Println("GenLoadEdgesByType result", err, nodes)
	errChan <- err
}

func GenLoadAssocEdges(nodes *[]*AssocEdgeData) error {
	return chainLoaders(
		[]loader{
			&loadAssocEdgeConfigExists{},
			&loadMultipleNodesFromQuery{
				sqlBuilder: &sqlBuilder{
					rawQuery: "SELECT * FROM assoc_edge_config",
				},
				nodes: nodes,
			},
		},
	)
}
