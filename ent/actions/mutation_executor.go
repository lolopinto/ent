package actions

import (
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/pkg/errors"
)

type EntMutationExecutor struct {
	placeholderId string //TODO this can be more complicated eventually since it's expected to only work for one changeset
	ops           []ent.DataOperation
	idx           int
	lastOp        ent.DataOperation
	createdEnt    ent.Entity
}

func (exec *EntMutationExecutor) Operation() (ent.DataOperation, error) {
	if exec.idx == len(exec.ops) {
		return nil, ent.AllOperations
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

func (exec *EntMutationExecutor) handleCreatedEnt(op ent.DataOperation, entity ent.Entity) error {
	createOp, ok := op.(ent.DataOperationWithEnt)

	if !ok {
		return nil
	}

	// existing object
	if entity != nil {
		return errors.New(
			"multiple operations in a pipeline trying to create an object. that shouldn't be possible in one changeset (for now)",
		)
	}

	createdEnt := createOp.CreatedEnt()
	if createdEnt == nil {
		return fmt.Errorf("op %v returned a nil returned ent", op)
	}

	// yay!
	exec.createdEnt = createdEnt
	return nil
}

func (exec *EntMutationExecutor) handleResolving(op ent.DataOperation) {
	resolvableOp, ok := op.(ent.DataOperationWithResolver)
	if ok {
		resolvableOp.Resolve(exec)
	}
}

func (exec *EntMutationExecutor) CreatedEnt() ent.Entity {
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
