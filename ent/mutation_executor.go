package ent

import (
	"fmt"

	"github.com/davecgh/go-spew/spew"
	"github.com/pkg/errors"
)

// TODO move this back to actions package
// moved to ent package temporarily as things are being moved around
// once CreateNodeFromActionMap and EditNodeFromActionMap are killed and everything converted to changeset, no longer needed
type EntMutationExecutor struct {
	placeholderId string //TODO this can be more complicated eventually since it's expected to only work for one changeset
	ops           []DataOperation
	idx           int
	lastOp        DataOperation
	createdEnt    Entity
}

func NewMutationExecutor(placeholderId string, ops []DataOperation) Executor {
	return &EntMutationExecutor{
		placeholderId: placeholderId,
		ops:           ops,
	}
}

func (exec *EntMutationExecutor) Operation() (DataOperation, error) {
	if exec.idx == len(exec.ops) {
		return nil, AllOperations
	}

	if exec.lastOp != nil {
		if err := exec.handleCreatedEnt(exec.lastOp, exec.createdEnt); err != nil {
			return nil, err
		}
	}

	op := exec.ops[exec.idx]
	exec.idx++
	//	spew.Dump(op)
	exec.handleResolving(op)
	exec.lastOp = op
	return op, nil
}

func (exec *EntMutationExecutor) handleCreatedEnt(op DataOperation, entity Entity) error {
	createOp, ok := op.(DataOperationWithEnt)

	if !ok {
		return nil
	}

	// existing object
	if entity != nil {
		return errors.New(
			"multiple operations in a pipeline trying to create an object. that shouldn't be possible in one changeset (for now)",
		)
	}

	// lesigh golang and memory allocation for interfaces?
	var createdEnt Entity
	createdEnt = createOp.CreatedEnt()
	spew.Dump("created ent", createdEnt)
	if createdEnt == nil {
		return fmt.Errorf("op %v returned a nil returned ent", op)
	}

	// yay!
	exec.createdEnt = createdEnt
	return nil
}

func (exec *EntMutationExecutor) handleResolving(op DataOperation) {
	resolvableOp, ok := op.(DataOperationWithResolver)
	if ok {
		resolvableOp.Resolve(exec)
	}
}

func (exec *EntMutationExecutor) CreatedEnt() Entity {
	return exec.createdEnt
}

func (exec *EntMutationExecutor) ResolveValue(val interface{}) interface{} {
	if exec.createdEnt == nil {
		panic("there should be no value to resolve when no created object")
	}

	if val != exec.placeholderId {
		return val
	}

	return exec.createdEnt.GetID
}
