package ent

import (
	"fmt"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/sql"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
	"github.com/rocketlaunchr/remember-go"
)

// DataOperation corresponds to an individual operation to write to the database
// could be inserting a node, deleting a node, adding an edge, etc
// Ent framework comes with different operations which handle common things
// Each operation is returned by Executor
type DataOperation interface {
	PerformWrite(tx *sqlx.Tx) error
}

// DataOperationWithCreatedEnt indicates an operation which can create an ent
// This is used to track placeholder ids and id of the created ent
type DataOperationWithCreatedEnt interface {
	DataOperation
	CreatedEnt() Entity
}

// DataOperationWithResolver corresponds to an operation which can resolve placeholder ids
// so that the executor ca nbe passed to it as needed
type DataOperationWithResolver interface {
	DataOperation
	Resolve(Executor) error
}

// DataOperationWithKeys indicates an operation that has keys in cache(redis/memory, etc)
// and makes sure to delete these keys when an operation happens
type DataOperationWithKeys interface {
	DataOperation
	GetCacheKeys() []string
}

// WriteOperation indicates if we're creating, editing or deleting an ent
type WriteOperation string

const (
	// InsertOperation means we're creating a new ent
	InsertOperation WriteOperation = "insert"
	// EditOperation means we're editing an existing ent
	EditOperation WriteOperation = "edit"
	// DeleteOperation means we're deleting an ent
	DeleteOperation WriteOperation = "delete"
)

// EditNodeOperation indicates we're creating or editing an ent
type EditNodeOperation struct {
	ExistingEnt         Entity
	Entity              Entity
	EntConfig           Config
	Fields              map[string]interface{}
	FieldsWithResolvers []string
	Operation           WriteOperation
}

// Resolve replaces any placeholders this operation has with the actual ID of the created ent
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

// PerformWrite writes the node to the database
func (op *EditNodeOperation) PerformWrite(tx *sqlx.Tx) error {
	m := op.Fields
	if m == nil {
		m = make(map[string]interface{})
	}
	var builder *sqlBuilder
	switch op.Operation {
	case InsertOperation:
		op.updateInsertDefaultMap(m)
		builder = getInsertQuery(op.EntConfig.GetTableName(), m, "RETURNING *")
		break
	case EditOperation:
		op.updateEditDefaultMap(m)

		builder = getUpdateQuery(
			op.EntConfig.GetTableName(),
			op.ExistingEnt,
			m,
		)

		break
	default:
		return errors.New("Unsupported operation")
	}

	return performWrite(builder, tx, op.Entity)
}

// GetCacheKeys returns keys that need to be deleted for this operation
func (op *EditNodeOperation) GetCacheKeys() []string {
	if op.ExistingEnt == nil {
		return []string{}
	}
	return []string{
		getKeyForNode(op.ExistingEnt.GetID(), op.EntConfig.GetTableName()),
	}
}

// CreatedEnt returns the newly created ent (if any)
func (op *EditNodeOperation) CreatedEnt() Entity {
	return op.Entity
}

func (op *EditNodeOperation) updateInsertDefaultMap(m map[string]interface{}) {
	t := time.Now()

	// TODO: break this down into something not hardcoded in here
	m["created_at"] = t
	m["updated_at"] = t
	_, ok := op.Entity.(DBObjectWithDiffKey)
	if !ok {
		m["id"] = uuid.New().String()
	}
}

func (op *EditNodeOperation) updateEditDefaultMap(m map[string]interface{}) {
	m["updated_at"] = time.Now()
}

// NewInboundEdge returns a new edge from id1 -> viewer
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

// NewOutboundEdge returns a new edge from viewer -> id2
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

// EdgeOperation handles creating, editing or deleting an edge
type EdgeOperation struct {
	edgeType       EdgeType
	id1            string
	id1Type        NodeType
	id2            string
	id2Type        NodeType
	time           time.Time
	data           *string
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

// InverseEdge returns the inverse edge of the current edge with the provided edgeType
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

// SymmetricEdge returns a symmetric edge of the current one with id1 and id2 swapped
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

// EdgeType returns the edge type of the Operation
func (op *EdgeOperation) EdgeType() EdgeType {
	return op.edgeType
}

// PerformWrite writes the edge to the database
func (op *EdgeOperation) PerformWrite(tx *sqlx.Tx) error {
	// check that they're valid uuids
	if op.id1Placeholder || op.id2Placeholder {
		return errors.New("error performing write. failed to replace placeholder in ent edge operation")
	}

	edgeData, err := GetEdgeInfo(op.edgeType, tx)
	if err != nil {
		return err
	}

	var builder *sqlBuilder
	switch op.operation {
	case InsertOperation:
		builder = op.getBuilderForInsertOp(edgeData)
		break
	case DeleteOperation:
		builder = op.getBuilderForDeleteOp(edgeData)
		break
	default:
		return fmt.Errorf("unsupported edge operation %v passed to edgeOperation.PerformWrite", op)
	}

	return performWrite(builder, tx, nil)
}

// GetCacheKeys returns keys that need to be deleted for this operation
func (op *EdgeOperation) GetCacheKeys() []string {
	return []string{
		getKeyForEdge(op.id1, op.edgeType),
	}
}

func (op *EdgeOperation) getBuilderForInsertOp(edgeData *AssocEdgeData) *sqlBuilder {
	if op.time.IsZero() {
		// log warning here?
		op.time = time.Now()
	}

	return getInsertQuery(
		edgeData.EdgeTable,
		map[string]interface{}{
			"id1":       op.id1,
			"id1_type":  op.id1Type,
			"edge_type": op.edgeType,
			"id2":       op.id2,
			"id2_type":  op.id2Type,
			"time":      op.time,
			"data":      op.data, // zero value of data works for us. no check needed
		},
		// postgres specific
		// this is where the db dialects will eventually be needed
		"ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
	)
}

func (op *EdgeOperation) getBuilderForDeleteOp(edgeData *AssocEdgeData) *sqlBuilder {
	return getDeleteQuery(edgeData.EdgeTable,
		sql.And(
			sql.Eq("id1", op.id1),
			sql.Eq("edge_type", op.edgeType),
			sql.Eq("id2", op.id2),
		))
}

// Resolve replaces any placeholders this operation has with the actual ID of the created ent
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

// EdgeTime provides the ability to change the time of an edge. Passed to Edge modification functions
func EdgeTime(t time.Time) func(*EdgeOperation) {
	return func(op *EdgeOperation) {
		op.time = t
	}
}

// EdgeTimeRawNumber provides the ability to store a raw number in the time field of an edge
// e.g. to keep track of an ordering, use this
// Passed to Edge modification functions
func EdgeTimeRawNumber(num int64) func(*EdgeOperation) {
	// if we wanna store raw numbers, e.g. to keep track of an order, use this
	return func(op *EdgeOperation) {
		// does seconds from epoch...
		t := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(num) * time.Second)
		op.time = t
	}
}

// EdgeData provides the ability to change the data field of an edge. Passed to Edge modification functions
func EdgeData(data string) func(*EdgeOperation) {
	return func(op *EdgeOperation) {
		op.data = &data
	}
}

// DeleteNodeOperation indicates we're deleting an ent
type DeleteNodeOperation struct {
	ExistingEnt Entity
	EntConfig   Config
}

// PerformWrite deletes the node from the database
func (op *DeleteNodeOperation) PerformWrite(tx *sqlx.Tx) error {
	builder := getDeleteQuery(op.EntConfig.GetTableName(), sql.Eq("id", op.ExistingEnt.GetID()))

	return performWrite(builder, tx, nil)
}

// GetCacheKeys returns keys that need to be deleted for this operation
func (op *DeleteNodeOperation) GetCacheKeys() []string {
	return []string{
		getKeyForNode(op.ExistingEnt.GetID(), op.EntConfig.GetTableName()),
	}
}

func getKeyForNode(id, tableName string) string {
	if id == "" {
		debug.PrintStack()
		util.GoSchemaKill(errors.WithStack(errors.New("empty id passed")))
	}
	return remember.CreateKey(false, "_", "table_id", tableName, id)
}

func getKeyForEdge(id string, edgeType EdgeType) string {
	return remember.CreateKey(false, "_", "edge_id", edgeType, id)
}
