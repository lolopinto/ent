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

type dataOperation interface {
	PerformWrite(tx *sqlx.Tx) error
}

type dataOperationWithEnt interface {
	ReturnedEnt() Entity
}

type dataOperationWithPlaceHolder interface {
	HasPlaceholder() bool
	AugmentWithPlaceHolder(createdObj Entity, t time.Time)
}

type WriteOperation string

const (
	InsertOperation WriteOperation = "insert"
	EditOperation   WriteOperation = "edit"
	DeleteOperation WriteOperation = "delete"
)

type nodeWithActionMapOperation struct {
	info *EditedNodeInfo
}

func (op *nodeWithActionMapOperation) PerformWrite(tx *sqlx.Tx) error {
	var queryOp nodeOp
	if op.info.ExistingEnt == nil {
		queryOp = &insertNodeOp{op.info}
	} else {
		queryOp = &updateNodeOp{op.info}
	}

	columns, values := queryOp.getInitColsAndVals()
	for fieldName, value := range op.info.Fields {
		fieldInfo, ok := op.info.EditableFields[fieldName]
		if !ok {
			return errors.New(fmt.Sprintf("invalid field %s passed to CreateNodeFromActionMap", fieldName))
		}
		columns = append(columns, fieldInfo.DB)
		values = append(values, value)
	}

	query := queryOp.getSQLQuery(columns, values)

	return performWrite(query, values, tx, op.info.Entity)
}

func (op *nodeWithActionMapOperation) ReturnedEnt() Entity {
	return op.info.Entity
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
	//spew.Dump(colsString, values, valsString)
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
		"UPDATE %s SET %s WHERE ID = '%s' RETURNING *",
		op.info.EntConfig.GetTableName(),
		valsString,
		op.info.ExistingEnt.GetID(),
	)

	//fmt.Println(computedQuery)
	//spew.Dump(colsString, values, valsString)
	deleteKey(getKeyForNode(op.info.ExistingEnt.GetID(), op.info.EntConfig.GetTableName()))

	return computedQuery
}

type EdgeOperation struct {
	EdgeType  EdgeType
	ID1       string
	ID1Type   NodeType
	ID2       string
	ID2Type   NodeType
	Time      time.Time
	Data      string
	Operation WriteOperation
}

func (op *EdgeOperation) PerformWrite(tx *sqlx.Tx) error {
	if op.ID1 == idPlaceHolder || op.ID2 == idPlaceHolder {
		return errors.New("error performing write. failed to replace placeholder in ent edge operation")
	}

	if op.Time.IsZero() {
		// log warning here?
		op.Time = time.Now()
	}
	edgeOptions := EdgeOptions{Time: op.Time, Data: op.Data}

	switch op.Operation {
	case InsertOperation:
		return addEdgeInTransactionRaw(
			op.EdgeType,
			op.ID1,
			op.ID2,
			op.ID1Type,
			op.ID2Type,
			edgeOptions,
			tx,
		)
	case DeleteOperation:
		return deleteEdgeInTransactionRaw(op.EdgeType, op.ID1, op.ID2, tx)
	default:
		return fmt.Errorf("unsupported edge operation %v passed to edgeOperation.PerformWrite", op)
	}
}

func (op *EdgeOperation) HasPlaceholder() bool {
	return op.ID1 == idPlaceHolder || op.ID2 == idPlaceHolder
}

func (op *EdgeOperation) AugmentWithPlaceHolder(createdObj Entity, t time.Time) {
	if op.ID1 == idPlaceHolder {
		op.ID1 = createdObj.GetID()
		op.ID1Type = createdObj.GetType()
	}

	if op.ID2 == idPlaceHolder {
		op.ID2 = createdObj.GetID()
		op.ID2Type = createdObj.GetType()
	}

	if op.Time.IsZero() {
		op.Time = t
	}
}

func handleAugment(op dataOperation, ent Entity, t time.Time) error {
	augmentOp, ok := op.(dataOperationWithPlaceHolder)

	if !ok {
		return nil
	}

	if !augmentOp.HasPlaceholder() {
		return nil
	}

	var err error
	if ent == nil || t.IsZero() {
		err = fmt.Errorf("error performing op %v. tried to augment an operation before creating an object", op)
	} else {
		augmentOp.AugmentWithPlaceHolder(ent, t)
	}
	return err
}

func handleReturnedEnt(op dataOperation, ent Entity) (Entity, error) {
	createOp, ok := op.(dataOperationWithEnt)

	if !ok {
		return ent, nil
	}

	// existing object
	if ent != nil {
		return nil, errors.New("multiple operations in a pipeline trying to create an object. that's confusing with placeholders")
	}

	ent = createOp.ReturnedEnt()
	if ent == nil {
		return nil, fmt.Errorf("op %v returned a nil returned ent", op)
	}
	// yay!
	return ent, nil
}

// performAllOperations takes a list of operations to the database and wraps them in a transaction
func performAllOperations(ops []dataOperation) error {
	db := data.DBConn()
	tx, err := db.Beginx()
	if err != nil {
		fmt.Println("error creating transaction", err)
		return err
	}

	var ent Entity
	var t time.Time

	for _, op := range ops {
		err = handleAugment(op, ent, t)

		if err == nil {
			// real thing we care about
			err = op.PerformWrite(tx)
		}

		if err == nil {
			ent, err = handleReturnedEnt(op, ent)
			// todo need a way to get created_at or updated_at...!!
			t = time.Now()
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
