package ent

import (
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx/reflectx"
	"github.com/lolopinto/ent/data"
	entreflect "github.com/lolopinto/ent/internal/reflect"
	"github.com/lolopinto/ent/internal/util"
)

// todo deal with struct tags
// todo empty interface{}
type insertdata struct {
	columns  []string
	values   []interface{}
	pkeyName string
}

/**
* Returns the list of columns which will be affected for a SELECT statement
 */
func (insertData insertdata) getColumnsString() string {
	// don't quite need this since this is done in getFieldsAndValuesOfStruct()
	// but all of this needs to be cleaned up now
	columns := util.FilterSlice(insertData.columns, func(col string) bool {
		switch col {
		// remove Viewer. Not coming from DB. capital letter because no struct tag
		case "Viewer":
			fallthrough

			// remove the time pieces. can't scan into embedded objects
			// TODO: this is probably not true anymore...
		case "updated_at", "created_at":
			return false
		default:
			return true
		}
	})

	return getColumnsString(columns)
}

/**
* Returns the list of columns which will be affected for a SELECT statement
 */
func (insertData insertdata) getColumnsStringForInsert() string {
	return getColumnsString(insertData.columns)
}

/*
* Returns the string used in an INSERT statement for the values in the format:
* INSERT INTO table_name (cols_string) VALUES(vals_string)
 */
func (insertData insertdata) getValuesDataForInsert() ([]interface{}, string) {
	valsString := getValsString(insertData.values)
	return insertData.values, valsString
}

/**
* Returns a tuple of the following:
*
* We're not updating the ID and created_at columns
*
* values to be updated and
* a comma-separated string of column to positional bindvars which will be affected for an UPDATE statement
*
*	The 2nd item returned is (col_name = $1, col_name2 = $2) etc.
 */
func (insertData insertdata) getValuesDataForUpdate() ([]interface{}, string) {
	columns := insertData.columns
	// remove the id field. don't update that when updating a node
	columns = columns[1:]
	// remove the created_at field which is the last one
	columns = columns[:len(columns)-1]

	values := insertData.values
	// remove the id field. don't update that when updating a node
	values = values[1:]
	// remove the created_at field which is the last one
	values = values[:len(values)-1]

	valsString := getValuesDataForUpdate(columns, values)
	return values, valsString
}

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

// todo: make this smarter. for example, it shouldn't go through the
// process of reading the values from the struct/entity for reads
func getFieldsAndValuesOfStruct(value reflect.Value, setIDField bool) insertdata {
	if value.Kind() == reflect.Ptr {
		value = value.Elem()
	}

	newUUID := uuid.New().String()
	// TODO could eventually set time fields
	// make this a flag indicating if new object being created
	if setIDField {
		entreflect.SetValueInEnt(value, "ID", newUUID)
	}
	valueType := value.Type()

	//fmt.Println(value, valueType)

	fieldCount := value.NumField()
	// fields -1 for node + 3 for uuid, created_at, updated_at
	var columns []string
	var values []interface{}

	// add id column and value
	idCols := []string{"id"}
	// TODO: this is theoretically wrong when setIDField is false. However, because we have different use cases, it's fine
	// FIXIT.
	idVals := []interface{}{newUUID}

	// columns = append(columns, "id")
	// values = append(values, newUUID)

	// if it has a pkey, don't set anything.
	var pkey string

	// use sqlx here?
	for i := 0; i < fieldCount; i++ {
		field := value.Field(i)
		typeOfField := valueType.Field(i)

		//		spew.Dump(field.Kind(), field, field.Interface())
		if field.Kind() == reflect.Interface {
			// something like viewer which doesn't belong in the db
			continue
		}

		if field.Kind() == reflect.Struct {
			continue
			// TODO figure this out eventually
			// can hardcode the other info for now
			// or just migrate to use pop
			//getFieldsAndValuesOfStruct(field)
		}
		//fmt.Println(field.Kind(), field.Type())

		var column string
		tag := typeOfField.Tag.Get("db")
		if tag != "" {
			column = tag
		} else {
			// TODO this should not be acceptable since usecase is mostly db now...
			// also autogen forces it...
			column = typeOfField.Name
		}

		if typeOfField.Tag.Get("pkey") != "" {
			pkey = column
		}

		columns = append(columns, column)
		values = append(values, field.Interface())
	}

	if pkey == "" {
		pkey = "id"
		idCols = append(idCols, columns...)
		columns = idCols

		idVals = append(idVals, values...)
		values = idVals
	}

	// put updated_at before created_at so it's easier to modify later
	// for UPDATE. we don't want to change created_at field on UPDATE
	columns = append(columns, "updated_at", "created_at")
	values = append(values, time.Now(), time.Now())

	return insertdata{columns, values, pkey}
}

func getFieldsAndValues(obj interface{}, setIDField bool) insertdata {
	value := reflect.ValueOf(obj)
	return getFieldsAndValuesOfStruct(value, setIDField)
}

// LoadNode loads a single node given the id, node object and entConfig
// TODO refactor this

func loadNodeRawDataFromTable(id string, entity interface{}, tableName string, tx *sqlx.Tx) error {
	// TODO does it make sense to change the API we use here to instead pass it to entity?

	if entity == nil {
		return errors.New("nil pointer passed to LoadNode")
	}

	// ok, so now we need a way to map from struct to fields
	insertData := getFieldsAndValues(entity, false)
	colsString := insertData.getColumnsString()

	computedQuery := fmt.Sprintf(
		"SELECT %s FROM %s WHERE %s = $1",
		colsString,
		tableName,
		insertData.pkeyName,
	)
	//	fmt.Println(computedQuery)

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	stmt, err := getStmtFromTx(tx, db, computedQuery)

	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	// stmt.QueryRowx(id)....
	err = stmt.QueryRowx(id).StructScan(entity)
	if err != nil {
		fmt.Println(err)
	}
	return err
}

func loadNodeRawData(id string, entity interface{}, entConfig Config) error {
	return loadNodeRawDataFromTable(id, entity, entConfig.GetTableName(), nil)
}

// EntityResult is the result of a call to LoadNodeConc which returns an object
// and the channel. TODO: This is just a test
type EntityResult struct {
	Entity interface{}
	Error  error
}

func genLoadRawData(id string, entity interface{}, entConfig Config, errChan chan<- error) {
	err := loadNodeRawData(id, entity, entConfig)
	// result := EntityResult{
	// 	Entity: entity,
	// 	Err:    err,
	// }
	errChan <- err
	//chanResult <- result
}

type loadNodesQuery func(insertData insertdata) (string, []interface{}, error)

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

// this borrows from/learns from scanAll in sqlx library
func loadNodesHelper(nodes interface{}, sqlQuery loadNodesQuery) error {
	slice, direct, err := validateSliceOfNodes(nodes)
	if err != nil {
		return err
	}

	// get the base type from the slice
	base := reflectx.Deref(slice.Elem())
	// todo: confirm this is what I think it is
	// fmt.Println(base)

	// get a zero value of this
	value := reflect.New(base)
	// really need to rename this haha
	insertData := getFieldsAndValuesOfStruct(value, false)

	query, values, err := sqlQuery(insertData)
	fmt.Println(query, err)
	if err != nil {
		fmt.Println(err)
		return err
	}

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	// rebind the query for our backend.
	// TODO: should we only do this when needed?
	query = db.Rebind(query)
	fmt.Println("rebound query ", query)

	stmt, err := db.Preparex(query)
	if err != nil {
		fmt.Println("error after prepare in LoadNodes()", err)
		return err
	}
	defer stmt.Close()

	fmt.Println("values", values)
	rows, err := stmt.Queryx(values...)
	if err != nil {
		fmt.Println("error performing query in LoadNodes", err)
		return err
	}

	defer rows.Close()

	for rows.Next() {
		entity := reflect.New(base)
		err = rows.StructScan(entity.Interface())
		if err != nil {
			fmt.Println(err)
			break
		}
		// append each entity into "nodes" destination
		direct.Set(reflect.Append(*direct, entity))
	}

	err = rows.Err()
	if err != nil {
		fmt.Println(err)
	}
	return err
}

func loadForeignKeyNodes(id string, nodes interface{}, colName string, entConfig Config) error {
	sqlQuery := func(insertData insertdata) (string, []interface{}, error) {
		colsString := insertData.getColumnsString()
		query := fmt.Sprintf(
			"SELECT %s FROM %s WHERE %s = $1",
			colsString,
			entConfig.GetTableName(),
			colName,
		)
		fmt.Println(query)
		return query, []interface{}{id}, nil
	}

	return loadNodesHelper(nodes, sqlQuery)
}

func genLoadForeignKeyNodes(id string, nodes interface{}, colName string, entConfig Config, errChan chan<- error) {
	err := loadForeignKeyNodes(id, nodes, colName, entConfig)
	fmt.Println("genLoadForeignKeyNodes result", err, nodes)
	errChan <- err
}

type EditedNodeInfo struct {
	ExistingEnt    Entity
	Entity         Entity
	EntConfig      Config
	EditableFields ActionFieldMap
	Fields         map[string]interface{}
	InboundEdges   []*EditedEdgeInfo
	OutboundEdges  []*EditedEdgeInfo
}

type EditedEdgeInfo struct {
	EdgeType EdgeType
	Id       string
	NodeType NodeType
}

// CreateNodeFromActionMap creates a new Node and returns it in Entity
// This is the new API for mutations that's going to replace the old CreateNode API
func CreateNodeFromActionMap(info *EditedNodeInfo) error {
	if info.ExistingEnt != nil {
		return fmt.Errorf("CreateNodeFromActionMap passed an existing ent when creating an ent")
	}

	var tx *sqlx.Tx
	var err error

	if len(info.InboundEdges) > 0 || len(info.OutboundEdges) > 0 {
		db := data.DBConn()
		tx, err = db.Beginx()
		if err != nil {
			fmt.Println("error creating transaction", err)
			return err
		}
	}

	newUUID := uuid.New().String()
	t := time.Now()

	// initialize id, created_at and updated_at times
	columns := []string{"id", "created_at", "updated_at"}
	values := []interface{}{newUUID, t, t}

	for fieldName, value := range info.Fields {
		fieldInfo, ok := info.EditableFields[fieldName]
		if !ok {
			return errors.New("invalid field passed to CreateNodeFromActionMap")
		}
		columns = append(columns, fieldInfo.DB)
		values = append(values, value)
	}

	colsString := getColumnsString(columns)
	valsString := getValsString(values)
	//	fields := make(map[string]interface{})

	computedQuery := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES(%s) RETURNING *",
		info.EntConfig.GetTableName(),
		colsString,
		valsString,
	)
	//fmt.Println(computedQuery)
	//spew.Dump(colsString, values, valsString)

	// no tx for now. todo gonna get more complicated fast.
	err = performWrite(computedQuery, values, tx, info.Entity)

	if err != nil && tx != nil {
		fmt.Println("error during transaction", err)
		tx.Rollback()
		return err
	}

	// TODO this is too manual. fix it.
	// need to rebuild all this using PerformAllOperations()
	newType := info.Entity.GetType()

	for _, edge := range info.InboundEdges {
		edgeOptions := EdgeOptions{Time: t}
		err = addEdgeInTransactionRaw(
			edge.EdgeType,
			edge.Id,
			newUUID,
			edge.NodeType,
			newType,
			edgeOptions,
			tx,
		)

		if err != nil && tx != nil {
			fmt.Println("error during transaction", err)
			tx.Rollback()
			return err
		}
	}

	for _, edge := range info.OutboundEdges {
		edgeOptions := EdgeOptions{Time: t}
		err = addEdgeInTransactionRaw(
			edge.EdgeType,
			newUUID,
			edge.Id,
			newType,
			edge.NodeType,
			edgeOptions,
			tx,
		)

		if err != nil && tx != nil {
			fmt.Println("error during transaction", err)
			tx.Rollback()
			return err
		}
	}

	if tx != nil {
		tx.Commit()
	}

	return nil
}

// EditNodeFromActionMap edits a Node and returns it in Entity
// This is the new API for mutations that's going to replace the old UpdateNode API
func EditNodeFromActionMap(info *EditedNodeInfo) error {
	if info.ExistingEnt == nil {
		return fmt.Errorf("EditNodeFromActionMap needs the entity that's being updated")
	}
	// initialize updated_at time
	t := time.Now()

	columns := []string{"updated_at"}
	values := []interface{}{t}

	for fieldName, value := range info.Fields {
		fieldInfo, ok := info.EditableFields[fieldName]
		if !ok {
			return errors.New("invalid field passed to EditNodeFromActionMap")
		}
		columns = append(columns, fieldInfo.DB)
		values = append(values, value)
	}

	valsString := getValuesDataForUpdate(columns, values)

	computedQuery := fmt.Sprintf(
		"UPDATE %s SET %s WHERE ID = '%s' RETURNING *",
		info.EntConfig.GetTableName(),
		valsString,
		info.ExistingEnt.GetID(),
	)

	// no tx for now. todo gonna get more complicated fast.
	return performWrite(computedQuery, values, nil, info.Entity)
}

func createNodeInTransaction(entity interface{}, entConfig Config, tx *sqlx.Tx) error {
	if entity == nil {
		// same as LoadNode in terms of handling this better
		return errors.New("nil pointer passed to CreateNode")
	}
	insertData := getFieldsAndValues(entity, true)
	colsString := insertData.getColumnsStringForInsert()
	values, valsString := insertData.getValuesDataForInsert()

	computedQuery := fmt.Sprintf("INSERT INTO %s (%s) VALUES(%s)", entConfig.GetTableName(), colsString, valsString)

	return performWrite(computedQuery, values, tx, nil)
}

// CreateNode creates a node
func CreateNode(entity interface{}, entConfig Config) error {
	return createNodeInTransaction(entity, entConfig, nil)
}

// CreateNodes creates multiple nodes
func CreateNodes(nodes interface{}, entConfig Config) error {
	_, direct, err := validateSliceOfNodes(nodes)
	if err != nil {
		return err
	}

	// This is not necessarily the best way to do this but this re-uses all the existing
	// abstractions and wraps everything in a transcation
	// TODO: maybe use the multirow VALUES syntax at https://www.postgresql.org/docs/8.2/sql-insert.html in the future.
	var operations []DataOperation

	for i := 0; i < direct.Len(); i++ {
		entity := direct.Index(i).Interface()

		operations = append(operations, NodeOperation{
			Entity:    entity,
			Config:    entConfig,
			Operation: InsertOperation,
		})
	}
	return PerformAllOperations(operations)
}

func getStmtFromTx(tx *sqlx.Tx, db *sqlx.DB, query string) (*sqlx.Stmt, error) {
	var stmt *sqlx.Stmt
	var err error
	// handle if in transcation or not.
	if tx == nil {
		stmt, err = db.Preparex(query)
	} else {
		stmt, err = tx.Preparex(query)
	}
	return stmt, err
}

// TODO rewrite a bunch of the queries. this is terrible now.
/*
type dbQuery interface {
	Have a QueryBuilder for this
	generateQuery() (string, []interface{}) // and even this can be broken down even more
	executeQuery(sqlx.Stmt) // provide helpers for this...
}
*/

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
		return err
	}
	defer stmt.Close()

	// TODO may need to eventually make this optional but for now
	// let's assume all writes should affect at least one row
	if checkRows {
		rowCount, err := res.RowsAffected()
		if err != nil || rowCount == 0 {
			fmt.Println(err, rowCount)
			return err
		}
	}
	return nil
}

func updateNodeInTransaction(entity interface{}, entConfig Config, tx *sqlx.Tx) error {
	if entity == nil {
		// same as LoadNode in terms of handling this better
		return errors.New("nil pointer passed to UpdateNode")
	}

	insertData := getFieldsAndValues(entity, false)

	values, valsString := insertData.getValuesDataForUpdate()

	id := findID(entity)
	computedQuery := fmt.Sprintf(
		"UPDATE %s SET %s WHERE id = '%s'",
		entConfig.GetTableName(),
		valsString,
		id,
	)
	fmt.Println(computedQuery)

	return performWrite(computedQuery, values, tx, nil)
}

// UpdateNode updates a node
// TODO should prevent updating relational fields maybe?
func UpdateNode(entity interface{}, entConfig Config) error {
	return updateNodeInTransaction(entity, entConfig, nil)
}

// this is a hack because i'm lazy and don't want to go update getFieldsAndValuesOfStruct()
// to do the right thing for now. now that I know what's going on here, can update everything
func findID(entity interface{}) string {
	value := reflect.ValueOf(entity).Elem()
	for i := 0; i < value.NumField(); i++ {
		field := value.Field(i)
		fieldType := field.Type()

		if field.Kind() == reflect.Struct {
			for j := 0; j < field.NumField(); j++ {
				field2 := field.Field(j)
				if fieldType.Field(j).Name == "ID" {
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

func getEdgeInfo(edgeType EdgeType, tx *sqlx.Tx) (*AssocEdgeData, error) {
	edgeData := &AssocEdgeData{}
	err := loadNodeRawDataFromTable(string(edgeType), edgeData, "assoc_edge_config", tx)
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
	edgeData, err := getEdgeInfo(edgeType, tx)
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

	vals := []interface{}{
		id1,
		id1Ttype,
		edgeType,
		id2,
		id2Type,
	}
	// add time as needed
	if edgeOptions.Time.IsZero() {
		vals = append(vals, time.Now())
	} else {
		vals = append(vals, edgeOptions.Time)
	}
	// zero value of data works for us. no check needed
	vals = append(vals, edgeOptions.Data)

	query := fmt.Sprintf(
		"INSERT into %s (%s) VALUES(%s)",
		edgeData.EdgeTable,
		getColumnsString(cols),
		getValsString(vals),
	)

	fmt.Println(query)

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

	edgeData, err := getEdgeInfo(edgeType, tx)
	if err != nil {
		return err
	}

	id1 := findID(entity1)
	id2 := findID(entity2)

	query := fmt.Sprintf(
		"DELETE FROM %s WHERE id1 = $1 AND edge_type = $2 AND id2 = $3",
		edgeData.EdgeTable,
	)

	vals := []interface{}{
		id1,
		edgeType,
		id2,
	}

	fmt.Println(query)
	return performWrite(query, vals, tx, nil)
}

func deleteEdge(entity1 interface{}, entity2 interface{}, edgeType EdgeType) error {
	return deleteEdgeInTransaction(entity1, entity1, edgeType, nil)
}

type WriteOperation string

const (
	InsertOperation WriteOperation = "insert"
	UpdateOperation WriteOperation = "update"
	DeleteOperation WriteOperation = "delete"
)

// TODO come up with a sensible method that can be used here
// we really need a marker interface here (for now)
type DataOperation interface {
	ValidOperation() bool
}

type NodeOperation struct {
	Entity    interface{}
	Config    Config
	Operation WriteOperation
}

func (NodeOperation) ValidOperation() bool {
	return true
}

type EdgeOperation struct {
	Entity1     interface{}
	Entity2     interface{}
	EdgeType    EdgeType
	EdgeOptions EdgeOptions // nullable for deletes?
	Operation   WriteOperation
}

func (EdgeOperation) ValidOperation() bool {
	return true
}

// todo a plan for creation and deletion of nodes and edges
// Todo eventually make this more complicated
type QueryPlan struct {
	//Nodes
}

func performNodeOperation(operation NodeOperation, tx *sqlx.Tx) error {
	switch operation.Operation {
	case InsertOperation:
		return createNodeInTransaction(operation.Entity, operation.Config, tx)
	case UpdateOperation:
		return updateNodeInTransaction(operation.Entity, operation.Config, tx)
	case DeleteOperation:
		return deleteNodeInTransaction(operation.Entity, operation.Config, tx)
	default:
		return fmt.Errorf("unsupported node operation %v passed to performAllOperations", operation)
	}
}

func performEdgeOperation(operation EdgeOperation, tx *sqlx.Tx) error {
	switch operation.Operation {
	case InsertOperation:
		return addEdgeInTransaction(
			operation.Entity1,
			operation.Entity2,
			operation.EdgeType,
			operation.EdgeOptions,
			tx,
		)
	case DeleteOperation:
		return deleteEdgeInTransaction(
			operation.Entity1,
			operation.Entity2,
			operation.EdgeType,
			tx,
		)
	default:
		return fmt.Errorf("unsupported edge operation %v passed to performAllOperations", operation)
	}
}

// PerformAllOperations is public for now but will long term be private and have a
// much better API
func PerformAllOperations(operations []DataOperation) error {
	db := data.DBConn()
	tx, err := db.Beginx()
	if err != nil {
		fmt.Println("error creating transaction", err)
		return err
	}

	for _, operation := range operations {
		switch v := operation.(type) {
		case NodeOperation:
			err = performNodeOperation(v, tx)
		case EdgeOperation:
			err = performEdgeOperation(v, tx)
		default:
			err = fmt.Errorf("invalid operation type %v passed to performAllOperations", v)
		}

		if err != nil {
			fmt.Println("error during transaction", err)
			tx.Rollback()
			return err
		}
	}

	tx.Commit()
	return nil
}

func LoadEdgesByType(id string, edgeType EdgeType) ([]Edge, error) {
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return nil, err
	}

	edgeData, err := getEdgeInfo(edgeType, nil)
	if err != nil {
		return nil, err
	}

	// TODO: eventually add support for complex queries
	// ORDER BY time DESC default
	// we need offset, limit eventually
	query := fmt.Sprintf(
		"SELECT * FROM %s WHERE id1 = $1 AND edge_type = $2 ORDER BY time DESC",
		edgeData.EdgeTable,
	)
	fmt.Println(query)

	stmt, err := db.Preparex(query)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	defer stmt.Close()

	rows, err := stmt.Queryx(id, edgeType)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	defer rows.Close()

	var edges []Edge
	for rows.Next() {
		var edge Edge
		err = rows.StructScan(&edge)
		if err != nil {
			fmt.Println(err)
			break
		}
		edges = append(edges, edge)
	}

	err = rows.Err()
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	return edges, nil
}

func GenLoadEdgesByType(id string, edgeType EdgeType, errChan chan<- error) {
	edges, err := LoadEdgesByType(id, edgeType)
	fmt.Println("GenLoadEdgesByType result", err, edges)
	errChan <- err
}

// GenLoadEdgesByTypeResult is a helper function that handles the loading of edges
// concurrently since we get the strong typing across all edges since it's the
// same Edge object being returned
func GenLoadEdgesByTypeResult(id string, edgeType EdgeType, chanEdgesResult chan<- EdgesResult) {
	var edges []Edge
	chanErr := make(chan error)
	go GenLoadEdgesByType(id, edgeType, chanErr)
	err := <-chanErr
	chanEdgesResult <- EdgesResult{
		Edges: edges,
		Error: err,
	}
}

// checks if an edge exists between 2 ids
// don't have a use-case now but will in the future
func LoadEdgeByType(id string, edgeType EdgeType, id2 string) (*Edge, error) {
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return nil, err
	}

	edgeData, err := getEdgeInfo(edgeType, nil)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(
		"SELECT * FROM %s WHERE id1 = $1 AND edge_type = $2 AND id2 = $3",
		edgeData.EdgeTable,
	)
	fmt.Println(query)

	stmt, err := db.Preparex(query)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	defer stmt.Close()

	var edge Edge

	err = stmt.QueryRowx(id, edgeType, id2).StructScan(&edge)

	// nil state. return zero value of Edge for now. maybe come up with better
	// way of doing this in the future
	if err == sql.ErrNoRows {
		fmt.Println("no rows", err)
		return &Edge{}, err
	}
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	// TODO handle no edge. what's the correct error type here?
	return &edge, nil
}

func loadNodesByType(id string, edgeType EdgeType, nodes interface{}) error {
	// load the edges
	edges, err := LoadEdgesByType(id, edgeType)
	if err != nil {
		return err
	}

	length := len(edges)
	// no nodes, nothing to do here
	if length == 0 {
		return err
	}

	// get ids from the edges
	ids := make([]interface{}, length)
	for idx, edge := range edges {
		ids[idx] = edge.ID2
	}

	// construct the sqlQuery that we'll use to query each node table
	sqlQuery := func(insertData insertdata) (string, []interface{}, error) {
		colsString := insertData.getColumnsString()

		// get basic formatted string for QUERY
		query := fmt.Sprintf(
			"SELECT %s FROM %s WHERE id IN (?)",
			colsString,
			"notes", // TODO get this from the edge
		)

		// rebind for IN query
		return sqlx.In(query, ids)
	}

	return loadNodesHelper(nodes, sqlQuery)
}

func genLoadNodesByType(id string, edgeType EdgeType, nodes interface{}, errChan chan<- error) {
	err := loadNodesByType(id, edgeType, nodes)
	fmt.Println("GenLoadEdgesByType result", err, nodes)
	errChan <- err
}
