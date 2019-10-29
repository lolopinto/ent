package actions

import (
	"errors"
	"fmt"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
)

// we need to support the following:
// * mutliple unrelated operations (add an edge) √
// * multiple unrelated changesets
// * changesets that depend on each other e.g. create contact while creating user √
// * changesets with multiple that depend on each other e.g. create 1 contact, 1 event while creating user √
// * changesets with complexity 1-level deep e.g. create user, create 1 contact, create event. create edge from user -> event (default now...) or edge from user -> self contact (to know user's contact) e.g. account/profile/organization √
// * changesets with multiple level deep e.g. create user -> create contact, create contact_email
// changeset where dependencies are flipped e.g main changeset depends on inner one for something so inner needs to be created first

// entListBasedExecutor is used for the simple case when there's one changeset
// with one or more operations which doesn't depend on other changesets
type entListBasedExecutor struct {
	placeholderID string
	ops           []ent.DataOperation
	// everything below this is private
	idx        int
	lastOp     ent.DataOperation
	createdEnt ent.Entity
}

func (exec *entListBasedExecutor) Operation() (ent.DataOperation, error) {
	//	spew.Dump("list based", exec.idx, exec.ops)
	if exec.idx == len(exec.ops) {
		return nil, ent.AllOperations
	}

	// spew.Dump("operation", exec.lastOp)
	// spew.Dump(exec)
	if exec.lastOp != nil {
		//		spew.Dump("created ent", exec.createdEnt)
		if err := exec.handleCreatedEnt(exec.lastOp); err != nil {
			return nil, err
		}
	}

	op := exec.ops[exec.idx]
	exec.idx++
	exec.lastOp = op
	return op, nil
}

func (exec *entListBasedExecutor) handleCreatedEnt(op ent.DataOperation) error {
	createdEnt, err := handleCreatedEnt(op, exec.createdEnt)
	if err != nil {
		return err
	}
	// yay!
	if createdEnt != nil {
		exec.createdEnt = createdEnt
	}
	//	spew.Dump("exec.createdEnt", exec.createdEnt)
	return nil
}

func (exec *entListBasedExecutor) ResolveValue(val interface{}) ent.Entity {
	if val != exec.placeholderID {
		return nil
	}

	return exec.createdEnt
}

type entWithDependenciesExecutor struct {
	placeholderID string
	ops           []ent.DataOperation
	dependencies  map[string]ent.MutationBuilder
	changesets    []ent.Changeset
	initialized   bool
	executors     []ent.Executor
	placeholders  []string
	idx           int
	mapper        map[string]ent.Entity
	lastOp        ent.DataOperation
	nativeIdx     int
}

func (exec *entWithDependenciesExecutor) addChangeset(changesets ...ent.Changeset) {
	for _, changeset := range changesets {
		exec.executors = append(exec.executors, changeset.GetExecutor())
		exec.placeholders = append(exec.placeholders, changeset.GetPlaceholderID())
	}
}

func (exec *entWithDependenciesExecutor) addExecForSelf() {
	executor := &entListBasedExecutor{
		placeholderID: exec.placeholderID,
		ops:           exec.ops,
	}
	exec.nativeIdx = len(exec.executors)
	exec.executors = append(exec.executors, executor)
	exec.placeholders = append(exec.placeholders, exec.placeholderID)
}

func (exec *entWithDependenciesExecutor) init() {
	if exec.initialized {
		return
	}
	exec.initialized = true

	exec.mapper = make(map[string]ent.Entity)
	// no dependency? just keep track of list of executors and we're done.
	if len(exec.dependencies) == 0 {
		exec.addExecForSelf()
		exec.addChangeset(exec.changesets...)
		return
	}
	// let's do simple case first and then we come back and fix it
	// this is the user one. it needs to run before the contact.
	// the contact one has dependencies but no changesets so can just itself first...

	// that one depends on this one
	// this is the user one. contact depends on it. we want to run user first.

	var lateChangesets []ent.Changeset
	for _, changeset := range exec.changesets {
		_, ok := exec.dependencies[changeset.GetPlaceholderID()]
		// this changeset is not a dependency of the main one that's running so we can run it first
		if !ok {
			exec.addChangeset(changeset)
		} else {
			lateChangesets = append(lateChangesets, changeset)
		}
	}
	exec.addExecForSelf()
	exec.addChangeset(lateChangesets...)
}

func (exec *entWithDependenciesExecutor) getOperation() (ent.DataOperation, error) {
	if exec.idx == len(exec.executors) {
		return nil, ent.AllOperations
	}
	return exec.executors[exec.idx].Operation()
}

func (exec *entWithDependenciesExecutor) Operation() (ent.DataOperation, error) {
	exec.init()
	//	spew.Dump("len execs", exec.executors)

	op, err := exec.getOperation()
	//	spew.Dump("operation", len(exec.executors), exec.idx, op, err)

	if exec.idx == len(exec.executors) {
		// we've gone around the world
		return nil, ent.AllOperations
		// if we are at the last item, depend on that executor to know what it's doing.
		//		return exec.executors[exec.idx].Operation()
		// TODO...
		//		return exec.executors[exec.idx].Operation()
		//		return op, err
	}

	if exec.lastOp != nil {
		if err := exec.handleCreatedEnt(exec.lastOp); err != nil {
			//			spew.Dump("handle created ent", err)
			return nil, err
		}
	}

	if err == ent.AllOperations {
		spew.Dump("on to the next one")
		// done with previous executor, let's move to the next
		exec.idx++
		// get new op and error to send
		op, err = exec.getOperation()
		spew.Dump(op, err)
	}

	// keep track of previous one
	exec.lastOp = op
	return op, err
}

func (exec *entWithDependenciesExecutor) ResolveValue(val interface{}) ent.Entity {
	//	spew.Dump("resolve", val)
	str := fmt.Sprintf("%v", val)
	entity, ok := exec.mapper[str]
	//	debug.PrintStack()
	if !ok {
		spew.Dump("didn't resolve", str, exec.mapper)
		return nil
	}
	//	spew.Dump(exec)
	spew.Dump("resolved!", val, entity.GetID())
	//	debug.PrintStack()

	return entity
}

func (exec *entWithDependenciesExecutor) handleCreatedEnt(op ent.DataOperation) error {
	// we need to know what the builder is to store the mapper
	createdEnt, err := handleCreatedEnt(op, nil)
	if createdEnt == nil || err != nil {
		return err
	}

	// after every creation, store a mapping from placeholder -> created ent
	placeholder := exec.placeholders[exec.idx]
	exec.mapper[placeholder] = createdEnt

	//	spew.Dump("mapper", exec.mapper)
	return nil
}

func handleCreatedEnt(op ent.DataOperation, entity ent.Entity) (ent.Entity, error) {
	createOp, ok := op.(ent.DataOperationWithEnt)

	if !ok {
		return nil, nil
	}

	// existing object
	if entity != nil {
		return nil, errors.New(
			"multiple operations in a pipeline trying to create an object. that shouldn't be possible in one changeset (for now)",
		)
	}

	createdEnt := createOp.CreatedEnt()
	if createdEnt == nil {
		return nil, fmt.Errorf("op %v returned a nil returned ent", op)
	}
	//	spew.Dump("Created ent", createdEnt)

	return createdEnt, nil
}
