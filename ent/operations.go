package ent

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/data"
	"github.com/pkg/errors"
)

type DataOperation interface {
	PerformWrite(tx *sqlx.Tx) error
}

type DataOperationWithEnt interface {
	CreatedEnt() Entity
}

type DataOperationWithResolver interface {
	Resolve(Executor) error
}

type WriteOperation string

const (
	InsertOperation WriteOperation = "insert"
	EditOperation   WriteOperation = "edit"
	DeleteOperation WriteOperation = "delete"
)

type EditNodeOperation struct {
	ExistingEnt         Entity
	Entity              Entity
	EntConfig           Config
	Fields              map[string]interface{}
	FieldsWithResolvers []string
	Operation           WriteOperation
}

func (op *EditNodeOperation) Resolve(exec Executor) error {
	//	resolve any placeholders before doing the write
	// only do this for fields that need to be resolved to speed things up
	for _, field := range op.FieldsWithResolvers {
		ent := exec.ResolveValue(op.Fields[field])
		if ent == nil {
			return fmt.Errorf("couldn't resolve placeholder for field %s", field)
		}
		op.Fields[field] = ent.GetID()
	}
	return nil
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
	id1 interface{}, // TODO come up with an interface?
	nodeType NodeType,
	mb MutationBuilder,
	options ...func(*EdgeOperation)) *EdgeOperation {

	edgeOp := newEdgeOperation(edgeType, op, options...)
	builder, ok := id1.(MutationBuilder)
	if ok {
		edgeOp.id1 = builder.GetPlaceholderID()
		edgeOp.id1Placeholder = true
	} else {
		edgeOp.id1 = fmt.Sprintf("%v", id1)
	}
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
	id2 interface{},
	nodeType NodeType,
	mb MutationBuilder,
	options ...func(*EdgeOperation)) *EdgeOperation {

	edgeOp := newEdgeOperation(edgeType, op, options...)

	// if builder, setup placeholder...
	builder, ok := id2.(MutationBuilder)
	if ok {
		edgeOp.id2 = builder.GetPlaceholderID()
		edgeOp.id2Placeholder = true
	} else {
		edgeOp.id2 = fmt.Sprintf("%v", id2)
	}
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

func (op *EdgeOperation) Resolve(exec Executor) error {
	if op.id1Placeholder {
		ent := exec.ResolveValue(op.id1)
		if ent == nil {
			return errors.New("placeholder value didn't get resolved")
		}
		op.id1 = ent.GetID()
		op.id1Type = ent.GetType()
		op.id1Placeholder = false
	}
	if op.id2Placeholder {
		ent := exec.ResolveValue(op.id2)
		if ent == nil {
			return errors.New("placeholder value didn't get resolved")
		}
		op.id2 = ent.GetID()
		op.id2Type = ent.GetType()
		op.id2Placeholder = false
	}

	if op.time.IsZero() {
		// todo do we want to have the time here to match exactly?
		op.time = time.Now()
	}
	return nil
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
			return handErrInTransaction(tx, err)
		}

		resolvableOp, ok := op.(DataOperationWithResolver)
		if ok {
			if err = resolvableOp.Resolve(exec); err != nil {
				return handErrInTransaction(tx, err)
			}
		}

		// perform the write as needed
		if err = op.PerformWrite(tx); err != nil {
			return handErrInTransaction(tx, err)
		}
	}

	tx.Commit()
	return nil
}

func handErrInTransaction(tx *sqlx.Tx, err error) error {
	fmt.Println("error during transaction", err)
	tx.Rollback()
	return err
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
