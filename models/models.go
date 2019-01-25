package models

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
	"github.com/lolopinto/jarvis/data"
)

// todo deal with struct tags
// todo empty interface{}
type insertdata struct {
	columns []string
	values  []interface{}
}

/**
* Returns the list of columns which will be affected for a SELECT statement
 */
func (insertData insertdata) getColumnsString() string {
	// remove the time pieces. can't scan into embedded objects
	columns := insertData.columns[:len(insertData.columns)-2]

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

	if len(values) != len(columns) {
		panic("columns and values not of equal length for update")
	}

	var vals []string
	for i, column := range columns {
		setter := fmt.Sprintf("%s = $%d", column, i+1)
		vals = append(vals, setter)
	}

	valsString := strings.Join(vals, ", ")
	return values, valsString
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
	valueType := value.Type()

	//fmt.Println(value, valueType)

	fieldCount := value.NumField()
	// fields -1 for node + 3 for uuid, created_at, updated_at
	var columns []string
	var values []interface{}

	newUUID := uuid.New().String()
	// add id column and value
	columns = append(columns, "id")
	values = append(values, newUUID)

	// TODO could eventually set time fields
	// make this a flag indicating if new object being created
	if setIDField {
		fbn := value.FieldByName("ID")
		if fbn.IsValid() {
			fbn.Set(reflect.ValueOf(newUUID))
		}
	}

	// use sqlx here?
	for i := 0; i < fieldCount; i++ {
		field := value.Field(i)
		typeOfField := valueType.Field(i)

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
			column = typeOfField.Name
		}

		columns = append(columns, column)
		values = append(values, field.Interface())
	}
	// put updated_at before created_at so it's easier to modify later
	// for UPDATE. we don't want to change created_at field on UPDATE
	columns = append(columns, "updated_at", "created_at")
	values = append(values, time.Now(), time.Now())

	return insertdata{columns, values}
}

func getFieldsAndValues(obj interface{}, setIDField bool) insertdata {
	value := reflect.ValueOf(obj)
	return getFieldsAndValuesOfStruct(value, setIDField)
}

func loadNode(id string, entity interface{}, tableName string) error {
	if entity == nil {
		return errors.New("nil pointer passed to loadNode")
	}

	// ok, so now we need a way to map from struct to fields
	insertData := getFieldsAndValues(entity, false)
	colsString := insertData.getColumnsString()

	computedQuery := fmt.Sprintf("SELECT %s FROM %s WHERE id = $1", colsString, tableName)
	fmt.Println(computedQuery)

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	stmt, err := db.Preparex(computedQuery)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	err = stmt.QueryRowx(id).StructScan(entity)
	if err != nil {
		fmt.Println(err)
	}
	return err
}

// this borrows from/learns from scanAll in sqlx library
func loadNodes(id string, nodes interface{}, colName string, tableName string) error {
	value := reflect.ValueOf(nodes)
	direct := reflect.Indirect(value)

	if value.Kind() != reflect.Ptr {
		return errors.New("must pass a pointer to loadNodes")
	}
	if value.IsNil() {
		return errors.New("nil pointer passed to loadNodes")
	}

	// get the slice from the pointer
	slice := reflectx.Deref(value.Type())
	if slice.Kind() != reflect.Slice {
		fmt.Println("sadness")
		return errors.New("sadness with error in loadNodes")
	}

	// get the base type from the slice
	base := reflectx.Deref(slice.Elem())
	// todo: confirm this is what I think it is
	// fmt.Println(base)

	// get a zero value of this
	value = reflect.New(base)
	// really need to rename this haha
	insertData := getFieldsAndValuesOfStruct(value, false)
	colsString := insertData.getColumnsString()

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	computedQuery := fmt.Sprintf("SELECT %s FROM %s WHERE %s = $1", colsString, tableName, colName)
	fmt.Println(computedQuery)

	stmt, err := db.Preparex(computedQuery)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	rows, err := stmt.Queryx(id)
	if err != nil {
		fmt.Println(err)
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
		direct.Set(reflect.Append(direct, reflect.Indirect(entity)))
	}

	err = rows.Err()
	if err != nil {
		fmt.Println(err)
	}

	return err
}

func createNodeInTransaction(entity interface{}, tableName string, tx *sqlx.Tx) error {
	if entity == nil {
		// same as loadNode in terms of handling this better
		return errors.New("nil pointer passed to createNode")
	}
	insertData := getFieldsAndValues(entity, true)
	colsString := insertData.getColumnsStringForInsert()
	values, valsString := insertData.getValuesDataForInsert()

	computedQuery := fmt.Sprintf("INSERT INTO %s (%s) VALUES( %s)", tableName, colsString, valsString)
	fmt.Println(computedQuery)

	return performWrite(computedQuery, values, tx)
}

func createNode(entity interface{}, tableName string) error {
	return createNodeInTransaction(entity, tableName, nil)
}

/*
 * performs a write (INSERT, UPDATE, DELETE statement) given the SQL statement
 * and values to be updated in the database
 */
func performWrite(query string, values []interface{}, tx *sqlx.Tx) error {
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	var stmt *sqlx.Stmt
	var err error
	// handle if in transcation or not.
	if tx == nil {
		stmt, err = db.Preparex(query)
	} else {
		stmt, err = tx.Preparex(query)
	}

	if err != nil {
		fmt.Println(err)
		return err
	}

	res, err := stmt.Exec(values...)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	// TODO may need to eventually make this optional but for now
	// let's assume all writes should affect at least one row
	rowCount, err := res.RowsAffected()
	if err != nil || rowCount == 0 {
		fmt.Println(err, rowCount)
		return err
	}
	return nil
}

func updateNodeInTransaction(entity interface{}, tableName string, tx *sqlx.Tx) error {
	if entity == nil {
		// same as loadNode in terms of handling this better
		return errors.New("nil pointer passed to updateNode")
	}

	insertData := getFieldsAndValues(entity, false)

	values, valsString := insertData.getValuesDataForUpdate()

	id := findID(entity)
	computedQuery := fmt.Sprintf(
		"UPDATE %s SET %s WHERE id = '%s'",
		tableName,
		valsString,
		id,
	)
	fmt.Println(computedQuery)

	return performWrite(computedQuery, values, tx)
}

// TODO should prevent updating relational fields maybe?
func updateNode(entity interface{}, tableName string) error {
	return updateNodeInTransaction(entity, tableName, nil)
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

func deleteNodeInTransaction(entity interface{}, tableName string, tx *sqlx.Tx) error {
	if entity == nil {
		return errors.New("nil pointer passed to deleteNode")
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", tableName)
	id := findID(entity)

	return performWrite(query, []interface{}{id}, tx)
}

func deleteNode(entity interface{}, tableName string) error {
	return deleteNodeInTransaction(entity, tableName, nil)
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

func addEdgeInTransaction(entity1 interface{}, entity2 interface{}, edgeType EdgeType, edgeOptions EdgeOptions, tx *sqlx.Tx) error {
	ent1, ent2, err := getEdgeEntities(entity1, entity2)
	if err != nil {
		return err
	}

	id1 := findID(entity1)
	id2 := findID(entity2)

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
		ent1.GetType(),
		edgeType,
		id2,
		ent2.GetType(),
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
		"INSERT into %s (%s) VALUES(%s)", "edges_info",
		getColumnsString(cols),
		getValsString(vals),
	)

	fmt.Println(query)

	return performWrite(query, vals, tx)
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

	query := fmt.Sprintf("DELETE FROM %s WHERE id1 = $1 AND edge_type = $2 AND id2 = $3", "edges_info")

	vals := []interface{}{
		id1,
		edgeType,
		id2,
	}

	fmt.Println(query)
	return performWrite(query, vals, tx)
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
	entity    interface{}
	tableName string
	operation WriteOperation
}

func (NodeOperation) ValidOperation() bool {
	return true
}

type EdgeOperation struct {
	entity1     interface{}
	entity2     interface{}
	edgeType    EdgeType
	edgeOptions EdgeOptions // nullable for deletes?
	operation   WriteOperation
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
	switch operation.operation {
	case InsertOperation:
		return createNodeInTransaction(operation.entity, operation.tableName, tx)
	case UpdateOperation:
		return updateNodeInTransaction(operation.entity, operation.tableName, tx)
	case DeleteOperation:
		return deleteNodeInTransaction(operation.entity, operation.tableName, tx)
	default:
		return fmt.Errorf("unsupported node operation %v passed to performAllOperations", operation)
	}
}

func performEdgeOperation(operation EdgeOperation, tx *sqlx.Tx) error {
	switch operation.operation {
	case InsertOperation:
		return addEdgeInTransaction(
			operation.entity1,
			operation.entity2,
			operation.edgeType,
			operation.edgeOptions,
			tx,
		)
	case DeleteOperation:
		return deleteEdgeInTransaction(
			operation.entity1,
			operation.entity2,
			operation.edgeType,
			tx,
		)
	default:
		return fmt.Errorf("unsupported edge operation %v passed to performAllOperations", operation)
	}
}

func performAllOperations(operations []DataOperation) error {
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

func loadEdgesByType(id string, edgeType EdgeType) ([]Edge, error) {
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return nil, err
	}

	// TODO: eventually add support for complex queries
	// ORDER BY time DESC default
	// we need offset, limit eventually
	query := fmt.Sprintf("SELECT * FROM %s WHERE id1 = $1 AND edge_type = $2 ORDER BY time DESC", "edges_info")
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

// checks if an edge exists between 2 ids
// don't have a use-case now but will in the future
func loadEdgeByType(id string, edgeType EdgeType, id2 string) (*Edge, error) {
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return nil, err
	}

	query := fmt.Sprintf("SELECT * FROM %s WHERE id1 = $1 AND edge_type = $2 AND id2 = $3", "edges_info")
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

//func loadNodesByType
