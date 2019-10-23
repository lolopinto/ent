package ent

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/data"
)

// placeholder for an id in an edge or node operation. indicates that this should be replaced with
// the id of the newly created node
const idPlaceHolder = "$ent.idPlaceholder$"

type DataOperation interface {
	PerformWrite(tx *sqlx.Tx) error
}

type DataOperationWithEnt interface {
	CreatedEnt() Entity
}

type DataOperationWithResolver interface {
	Resolve(Executor)
}

type WriteOperation string

const (
	InsertOperation WriteOperation = "insert"
	EditOperation   WriteOperation = "edit"
	DeleteOperation WriteOperation = "delete"
)

type EditNodeOperation struct {
	ExistingEnt Entity
	Entity      Entity
	EntConfig   Config
	Fields      map[string]interface{}
	Operation   WriteOperation
}

func (op *EditNodeOperation) PerformWrite(tx *sqlx.Tx) error {
	var queryOp nodeOp
	if op.Operation == InsertOperation {
		queryOp = &insertNodeOp{Entity: op.Entity, EntConfig: op.EntConfig}
	} else {
		queryOp = &updateNodeOp{ExistingEnt: op.ExistingEnt, EntConfig: op.EntConfig}
	}

	columns, values := queryOp.getInitColsAndVals()
	for k, v := range op.Fields {
		columns = append(columns, k)
		values = append(values, v)
	}

	query := queryOp.getSQLQuery(columns, values)

	return performWrite(query, values, tx, op.Entity)
}

func (op *EditNodeOperation) CreatedEnt() Entity {
	return op.Entity
}

type nodeOp interface {
	getInitColsAndVals() ([]string, []interface{})
	getSQLQuery(columns []string, values []interface{}) string
}

type insertNodeOp struct {
	Entity    Entity
	EntConfig Config
}

func (op *insertNodeOp) getInitColsAndVals() ([]string, []interface{}) {
	newUUID := uuid.New().String()
	t := time.Now()

	// TODO: break this down into something not hardcoded in here
	var columns []string
	var values []interface{}
	_, ok := op.Entity.(dataEntityWithDiffPKey)
	if ok {
		columns = []string{"created_at", "updated_at"}
		values = []interface{}{t, t}
	} else {
		// initialize id, created_at and updated_at times
		columns = []string{"id", "created_at", "updated_at"}
		values = []interface{}{newUUID, t, t}

	}
	return columns, values
}

func (op *insertNodeOp) getSQLQuery(columns []string, values []interface{}) string {
	// TODO sql builder factory...
	colsString := getColumnsString(columns)
	valsString := getValsString(values)
	//	fields := make(map[string]interface{})

	computedQuery := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES(%s) RETURNING *",
		op.EntConfig.GetTableName(),
		colsString,
		valsString,
	)
	//fmt.Println(computedQuery)
	return computedQuery
}

type updateNodeOp struct {
	ExistingEnt Entity
	EntConfig   Config
}

func (op *updateNodeOp) getInitColsAndVals() ([]string, []interface{}) {
	// initialize updated_at time
	t := time.Now()

	columns := []string{"updated_at"}
	values := []interface{}{t}
	return columns, values
}

func (op *updateNodeOp) getSQLQuery(columns []string, values []interface{}) string {
	valsString := getValuesDataForUpdate(columns, values)

	computedQuery := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s = '%s' RETURNING *",
		op.EntConfig.GetTableName(),
		valsString,
		getPrimaryKeyForObj(op.ExistingEnt),
		op.ExistingEnt.GetID(),
	)

	//fmt.Println(computedQuery)
	//spew.Dump(colsString, values, valsString)
	deleteKey(getKeyForNode(op.ExistingEnt.GetID(), op.EntConfig.GetTableName()))

	return computedQuery
}

type EdgeOperation struct {
	edgeType       EdgeType
	id1            string
	id1Type        NodeType
	id2            string
	id2Type        NodeType
	time           time.Time
	data           string
	operation      WriteOperation
	id1Placeholder bool
	id2Placeholder bool
}

func newEdgeOperation(
	edgeType EdgeType,
	op WriteOperation,
	options ...func(*EdgeOperation)) *EdgeOperation {
	edgeOp := &EdgeOperation{
		edgeType:  edgeType,
		operation: op,
	}
	for _, opt := range options {
		opt(edgeOp)
	}
	return edgeOp
}

func isNil(ent Entity) bool {
	// to handle go weirdness
	// TODO convert everything
	return ent == nil || ent == Entity(nil)
}

func NewInboundEdge(
	edgeType EdgeType,
	op WriteOperation,
	id1 string,
	nodeType NodeType,
	mb MutationBuilder,
	options ...func(*EdgeOperation)) *EdgeOperation {

	edgeOp := newEdgeOperation(edgeType, op, options...)
	edgeOp.id1 = id1
	edgeOp.id1Type = nodeType
	if isNil(mb.ExistingEnt()) {
		edgeOp.id2 = mb.GetPlaceholderID()
		edgeOp.id2Placeholder = true
	} else {
		edgeOp.id2 = mb.ExistingEnt().GetID()
		edgeOp.id2Type = mb.ExistingEnt().GetType()
	}

	return edgeOp
}

func NewOutboundEdge(
	edgeType EdgeType,
	op WriteOperation,
	id2 string,
	nodeType NodeType,
	mb MutationBuilder,
	options ...func(*EdgeOperation)) *EdgeOperation {

	edgeOp := newEdgeOperation(edgeType, op, options...)
	edgeOp.id2 = id2
	edgeOp.id2Type = nodeType

	if isNil(mb.ExistingEnt()) {
		edgeOp.id1 = mb.GetPlaceholderID()
		edgeOp.id1Placeholder = true
	} else {
		edgeOp.id1 = mb.ExistingEnt().GetID()
		edgeOp.id1Type = mb.ExistingEnt().GetType()
	}
	return edgeOp
}

func (op *EdgeOperation) InverseEdge(edgeType EdgeType) *EdgeOperation {
	return &EdgeOperation{
		operation:      op.operation,
		time:           op.time,
		data:           op.data,
		id1:            op.id2,
		id1Type:        op.id2Type,
		id2:            op.id1,
		id2Type:        op.id1Type,
		id1Placeholder: op.id2Placeholder,
		id2Placeholder: op.id1Placeholder,
		edgeType:       edgeType,
	}
}

func (op *EdgeOperation) SymmetricEdge() *EdgeOperation {
	return &EdgeOperation{
		operation:      op.operation,
		time:           op.time,
		data:           op.data,
		id1:            op.id2,
		id1Type:        op.id2Type,
		id2:            op.id1,
		id2Type:        op.id1Type,
		id1Placeholder: op.id2Placeholder,
		id2Placeholder: op.id1Placeholder,
		edgeType:       op.edgeType,
	}
}

func (op *EdgeOperation) EdgeType() EdgeType {
	return op.edgeType
}

func (op *EdgeOperation) PerformWrite(tx *sqlx.Tx) error {
	// check that they're valid uuids
	if op.id1Placeholder || op.id2Placeholder {
		return errors.New("error performing write. failed to replace placeholder in ent edge operation")
	}

	if op.time.IsZero() {
		// log warning here?
		op.time = time.Now()
	}
	edgeOptions := EdgeOptions{Time: op.time, Data: op.data}

	switch op.operation {
	case InsertOperation:
		return addEdgeInTransactionRaw(
			op.edgeType,
			op.id1,
			op.id2,
			op.id1Type,
			op.id2Type,
			edgeOptions,
			tx,
		)
	case DeleteOperation:
		return deleteEdgeInTransactionRaw(op.edgeType, op.id1, op.id2, tx)
	default:
		return fmt.Errorf("unsupported edge operation %v passed to edgeOperation.PerformWrite", op)
	}
}

func (op *EdgeOperation) Resolve(exec Executor) {
	createdEnt := exec.CreatedEnt()

	if op.id1Placeholder {
		op.id1 = createdEnt.GetID() // this or exec.ResolveValue(op.id1Placeholder)
		op.id1Type = createdEnt.GetType()
		op.id1Placeholder = false
	}
	if op.id2Placeholder {
		op.id2 = createdEnt.GetID()
		op.id2Type = createdEnt.GetType()
		op.id2Placeholder = false
	}

	if op.time.IsZero() {
		// todo do we want to have the time here to match exactly?
		op.time = time.Now()
	}
}

func EdgeTime(t time.Time) func(*EdgeOperation) {
	return func(op *EdgeOperation) {
		op.time = t
	}
}

func EdgeTimeRawNumber(num int64) func(*EdgeOperation) {
	// if we wanna store raw numbers, e.g. to keep track of an order, use this
	return func(op *EdgeOperation) {
		// does seconds from epoch...
		t := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(num) * time.Second)
		op.time = t
	}
}

func EdgeData(data string) func(*EdgeOperation) {
	return func(op *EdgeOperation) {
		op.data = data
	}
}

func executeOperations(exec Executor) error {
	db := data.DBConn()
	tx, err := db.Beginx()
	if err != nil {
		fmt.Println("error creating transaction", err)
		return err
	}

	for {
		op, err := exec.Operation()
		if err == AllOperations {
			break
		} else if err != nil {
			return err
		}

		// perform the write as needed
		if err = op.PerformWrite(tx); err != nil {
			fmt.Println("error during transaction", err)
			tx.Rollback()
			return err
		}
	}

	tx.Commit()
	return nil
}

type DeleteNodeOperation struct {
	ExistingEnt Entity
	EntConfig   Config
}

func (op *DeleteNodeOperation) PerformWrite(tx *sqlx.Tx) error {
	return deleteNodeInTransaction(
		op.ExistingEnt,
		op.EntConfig,
		tx,
	)
}
