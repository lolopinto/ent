package actions

import (
	"errors"
	"fmt"

	"github.com/lolopinto/ent/ent"
)

// we need to support the following:
// * mutliple unrelated operations (add an edge) √
// * multiple unrelated changesets √
// * changesets that depend on each other e.g. create contact while creating user √
// * changesets with multiple that depend on each other e.g. create 1 contact, 1 event while creating user √
// * changesets with complexity 1-level deep e.g. create user, create 1 contact, create event. create edge from user -> event (default now...) or edge from user -> self contact (to know user's contact) e.g. account/profile/organization √
// * changesets with multiple level deep e.g. create user -> create contact, create contact_email  √
// changeset where dependencies are flipped e.g main changeset depends on inner one for something so inner needs to be created first √ (done in tests)

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
	if exec.idx == len(exec.ops) {
		return nil, ent.ErrAllOperations
	}

	if exec.lastOp != nil {
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

	var earlyChangesets []ent.Changeset
	var lateChangesets []ent.Changeset
	for _, changeset := range exec.changesets {
		_, ok := exec.dependencies[changeset.GetPlaceholderID()]

		// the default expectation is that we run current changeset, then dependent changesets
		// if there are dependencies, we run the changesets that current one depends on before self and then subsequent
		// again, this all assumes simple linear dependencies and no webs for now
		if ok {
			earlyChangesets = append(earlyChangesets, changeset)
		} else {
			lateChangesets = append(lateChangesets, changeset)
		}
	}
	exec.addChangeset(earlyChangesets...)
	exec.addExecForSelf()
	exec.addChangeset(lateChangesets...)
}

func (exec *entWithDependenciesExecutor) getOperation() (ent.DataOperation, error) {
	if exec.idx == len(exec.executors) {
		return nil, ent.ErrAllOperations
	}
	return exec.executors[exec.idx].Operation()
}

func (exec *entWithDependenciesExecutor) Operation() (ent.DataOperation, error) {
	exec.init()

	op, err := exec.getOperation()

	if exec.lastOp != nil {
		if err := exec.handleCreatedEnt(exec.lastOp); err != nil {
			return nil, err
		}
	}

	if err == ent.ErrAllOperations {
		// done with previous executor, let's move to the next
		exec.idx++
		// get new op and error to send
		op, err = exec.getOperation()
	}

	// keep track of previous one
	exec.lastOp = op
	return op, err
}

func (exec *entWithDependenciesExecutor) ResolveValue(val interface{}) ent.Entity {
	str := fmt.Sprintf("%v", val)
	entity, ok := exec.mapper[str]

	if ok {
		return entity
	}
	for _, executor := range exec.executors {
		ent := executor.ResolveValue(val)
		if ent != nil {
			return ent
		}
	}
	return nil
}

func (exec *entWithDependenciesExecutor) handleCreatedEnt(op ent.DataOperation) error {
	// we need to know what the builder is to store the mapper
	createdEnt, err := handleCreatedEnt(op, nil)
	if createdEnt == nil || err != nil {
		return err
	}
	// when there's multiple levels of nesting, this gets complicated
	// e.g. a depends on b which depends on c
	// so a's index doesn't change while b is doing a whole lot of of stuff
	// so we only care about this when handling things we understand (e.g. we own the placeholder)
	// probably, don't need the mapper anymore?
	if exec.idx != exec.nativeIdx {
		return nil
	}

	// after every creation, store a mapping from placeholder -> created ent
	placeholder := exec.placeholders[exec.idx]
	exec.mapper[placeholder] = createdEnt

	return nil
}

func handleCreatedEnt(op ent.DataOperation, entity ent.Entity) (ent.Entity, error) {
	createOp, ok := op.(ent.DataOperationWithCreatedEnt)

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

	return createdEnt, nil
}
