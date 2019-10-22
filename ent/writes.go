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

// TODO this is temporary until ent.CreateNodeFromActionMap and ent.EditNodeFromActionMap die
// then rename and change...
type NodeWithActionMapOperation struct {
	Info      *EditedNodeInfo
	Operation WriteOperation
}

func (op *NodeWithActionMapOperation) PerformWrite(tx *sqlx.Tx) error {
	var queryOp nodeOp
	if op.Operation == InsertOperation {
		//	if entity == nil {
		queryOp = &insertNodeOp{op.Info}
	} else {
		queryOp = &updateNodeOp{op.Info}
	}

	columns, values := queryOp.getInitColsAndVals()
	for fieldName, value := range op.Info.Fields {
		fieldInfo, ok := op.Info.EditableFields[fieldName]
		if !ok {
			return errors.New(fmt.Sprintf("invalid field %s passed to CreateNodeFromActionMap", fieldName))
		}
		columns = append(columns, fieldInfo.DB)
		values = append(values, value)
	}

	query := queryOp.getSQLQuery(columns, values)

	return performWrite(query, values, tx, op.Info.Entity)
}

func (op *NodeWithActionMapOperation) CreatedEnt() Entity {
	return op.Info.Entity
}

type nodeOp interface {
	getInitColsAndVals() ([]string, []interface{})
	getSQLQuery(columns []string, values []interface{}) string
}

type insertNodeOp struct {
	info *EditedNodeInfo
}

func (op *insertNodeOp) getInitColsAndVals() ([]string, []interface{}) {
	newUUID := uuid.New().String()
	t := time.Now()

	// TODO: break this down into something not hardcoded in here
	var columns []string
	var values []interface{}
	_, ok := op.info.Entity.(dataEntityWithDiffPKey)
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
		op.info.EntConfig.GetTableName(),
		colsString,
		valsString,
	)
	//fmt.Println(computedQuery)
	return computedQuery
}

type updateNodeOp struct {
	info *EditedNodeInfo
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
		op.info.EntConfig.GetTableName(),
		valsString,
		getPrimaryKeyForObj(op.info.ExistingEnt),
		op.info.ExistingEnt.GetID(),
	)

	//fmt.Println(computedQuery)
	//spew.Dump(colsString, values, valsString)
	deleteKey(getKeyForNode(op.info.ExistingEnt.GetID(), op.info.EntConfig.GetTableName()))

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
	// TODO kill
	options ...func(*EditedEdgeInfo)) *EdgeOperation {
	info := &EditedEdgeInfo{}
	for _, opt := range options {
		opt(info)
	}
	// TODO kill EditedEdgeInfo. too many things...

	edgeOp := &EdgeOperation{
		edgeType:  edgeType,
		operation: op,
		time:      info.Time,
		data:      info.Data,
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
	options ...func(*EditedEdgeInfo)) *EdgeOperation {

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
	options ...func(*EditedEdgeInfo)) *EdgeOperation {

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
