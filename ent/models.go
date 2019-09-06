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

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx/reflectx"
	"github.com/lolopinto/ent/cmd/gent/configs"
	"github.com/lolopinto/ent/data"
	entreflect "github.com/lolopinto/ent/internal/reflect"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// todo deal with struct tags
// todo empty interface{}
type insertdata struct {
	columns       []string
	values        []interface{}
	pkeyName      string
	pkeyFieldName string
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
	var pkeyFieldName string

	// use sqlx here?
	for i := 0; i < fieldCount; i++ {
		field := value.Field(i)
		typeOfField := valueType.Field(i)

		//		spew.Dump(field.Kind(), field, field.Interface())
		if field.Kind() == reflect.Interface {
			// something like viewer which doesn't belong in the db
			continue
		}

		tag := typeOfField.Tag.Get("db")

		if field.Kind() == reflect.Struct {
			if tag == "" {
				// ent.Node
				// allow struct fields like start_time and end_time through
				continue
			}
			// TODO figure this out eventually
			// can hardcode the other info for now
			// or just migrate to use pop
			//getFieldsAndValuesOfStruct(field)
		}
		//fmt.Println(field.Kind(), field.Type())

		var column string
		if tag != "" {
			column = tag
		} else {
			// TODO this should not be acceptable since usecase is mostly db now...
			// also autogen forces it...
			column = typeOfField.Name
		}

		if typeOfField.Tag.Get("pkey") != "" {
			pkey = column
			pkeyFieldName = typeOfField.Name
		}

		columns = append(columns, column)
		values = append(values, field.Interface())
	}

	if pkey == "" {
		pkey = "id"
		pkeyFieldName = "ID"
		idCols = append(idCols, columns...)
		columns = idCols

		idVals = append(idVals, values...)
		values = idVals
	}

	// put updated_at before created_at so it's easier to modify later
	// for UPDATE. we don't want to change created_at field on UPDATE
	columns = append(columns, "updated_at", "created_at")
	values = append(values, time.Now(), time.Now())

	return insertdata{columns, values, pkey, pkeyFieldName}
}

func getFieldsAndValues(obj interface{}, setIDField bool) insertdata {
	value := reflect.ValueOf(obj)
	return getFieldsAndValuesOfStruct(value, setIDField)
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
	if id == "" {
		debug.PrintStack()
		panic(errors.WithStack(errors.New("empty id passed")))
	}
	return remember.CreateKey(false, "_", "edge_id", edgeType, id)
}

// func getKeyForEdgePair(id string, edgeType EdgeType, id2 string) string {
// 	if id == "" || id2 == "" {
// 		panic(errors.WithStack(errors.New("empty id passed")))
// 	}
// 	return remember.CreateKey(false, "_", "edge_id_id2", edgeType, id, id2)
// }

func loadNodeRawData(id string, entity dataEntity, entConfig Config) error {
	return loadData(
		&loadNodeFromPKey{
			id:        id,
			tableName: entConfig.GetTableName(),
			entity:    entity,
		},
	)
}

// EntityResult is the result of a call to LoadNodeConc which returns an object
// and the channel. TODO: This is just a test
type EntityResult struct {
	Entity interface{}
	Error  error
}

func genLoadRawData(id string, entity dataEntity, entConfig Config, errChan chan<- error) {
	err := loadNodeRawData(id, entity, entConfig)
	// result := EntityResult{
	// 	Entity: entity,
	// 	Err:    err,
	// }
	errChan <- err
	//chanResult <- result
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

func loadForeignKeyNodes(id string, nodes interface{}, colName string, entConfig Config) error {
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
	err := loadForeignKeyNodes(id, nodes, colName, entConfig)
	//fmt.Println("genLoadForeignKeyNodes result", err, nodes)
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

	_, ok := entConfig.(*configs.AssocEdgeConfig)

	// This is not necessarily the best way to do this but this re-uses all the existing
	// abstractions and wraps everything in a transcation
	// TODO: maybe use the multirow VALUES syntax at https://www.postgresql.org/docs/8.2/sql-insert.html in the future.
	var operations []dataOperation
	var updateOps []dataOperation

	for i := 0; i < direct.Len(); i++ {
		entity := direct.Index(i).Interface()

		if ok {
			assocEdge := entity.(*AssocEdgeData)
			if assocEdge.InverseEdgeType != nil && assocEdge.InverseEdgeType.Valid {

				updateOps = append(updateOps, &legacyNodeOperation{
					entity: &AssocEdgeData{
						EdgeType: assocEdge.EdgeType,
						InverseEdgeType: &sql.NullString{
							Valid:  true,
							String: assocEdge.InverseEdgeType.String,
						},
						SymmetricEdge: assocEdge.SymmetricEdge,
						EdgeName:      assocEdge.EdgeName,
						EdgeTable:     assocEdge.EdgeTable,
					},
					config:    entConfig,
					operation: updateOperation,
				})

				// remove this for now. we'll depend on update in same transaction
				assocEdge.InverseEdgeType = nil
			}
		}

		operations = append(operations, &legacyNodeOperation{
			entity:    entity,
			config:    entConfig,
			operation: insertOperation,
		})
	}
	// append all update ops to the end of the operations
	operations = append(operations, updateOps...)
	return performAllOperations(operations)
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

func updateNodeInTransaction(entity interface{}, entConfig Config, tx *sqlx.Tx) error {
	if entity == nil {
		// same as LoadNode in terms of handling this better
		return errors.New("nil pointer passed to UpdateNode")
	}

	insertData := getFieldsAndValues(entity, false)

	values, valsString := insertData.getValuesDataForUpdate()

	id := findID(entity, insertData.pkeyFieldName)
	deleteKey(getKeyForNode(id, entConfig.GetTableName()))

	computedQuery := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s = '%s'",
		entConfig.GetTableName(),
		valsString,
		insertData.pkeyName,
		id,
	)
	fmt.Println(computedQuery)
	return performWrite(computedQuery, values, tx, nil)
}

// UpdateNode updates a node
// TODO should prevent updating relational fields maybe?
// func UpdateNode(entity interface{}, entConfig Config) error {
// 	return updateNodeInTransaction(entity, entConfig, nil)
// }

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

func getEdgeInfo(edgeType EdgeType, tx *sqlx.Tx) (*AssocEdgeData, error) {
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
	edgeData, err := getEdgeInfo(edgeType, tx)
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

func GenLoadEdgesByType(id string, edgeType EdgeType, edges *[]*Edge, errChan chan<- error) {
	var err error
	*edges, err = LoadEdgesByType(id, edgeType)
	fmt.Println("GenLoadEdgesByType result", err, edges)
	errChan <- err
}

// GenLoadEdgesByTypeResult is a helper function that handles the loading of edges
// concurrently since we get the strong typing across all edges since it's the
// same Edge object being returned
func GenLoadEdgesByTypeResult(id string, edgeType EdgeType, chanEdgesResult chan<- EdgesResult) {
	var edges []*Edge
	chanErr := make(chan error)
	go GenLoadEdgesByType(id, edgeType, &edges, chanErr)
	err := <-chanErr
	chanEdgesResult <- EdgesResult{
		Edges: edges,
		Error: err,
	}
}

// checks if an edge exists between 2 ids
func LoadEdgeByType(id string, edgeType EdgeType, id2 string) (*Edge, error) {
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

func loadNodesByType(id string, edgeType EdgeType, nodes interface{}, entConfig Config) error {
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
	err := loadNodesByType(id, edgeType, nodes, entConfig)
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
