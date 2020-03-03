package actions

import (
	"errors"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
)

type tesDataOp interface {
	ent.DataOperation
	GetID() string
}

type simpleOp struct {
	id string
}

func (s simpleOp) GetID() string {
	return s.id
}

func (s simpleOp) PerformWrite(tx *sqlx.Tx) error {
	return nil
}

type simpleOpWithEnt struct {
	simpleOp
	user models.User
}

func (s simpleOpWithEnt) CreatedEnt() ent.Entity {
	s.user.ID = s.id
	return &s.user
}

type resolvableSimpleOp struct {
	simpleOp
	placeholderID string
	dependencyID  string
}

func (s *resolvableSimpleOp) Resolve(exec ent.Executor) error {
	ent := exec.ResolveValue(s.placeholderID)
	if ent == nil {
		return fmt.Errorf("couldn't resolve placeholder value %s", s.placeholderID)
	}
	s.dependencyID = ent.GetID()
	return nil
}

func (s *resolvableSimpleOp) GetID() string {
	return fmt.Sprintf("%s %s", s.dependencyID, s.id)
}

func execOperations(exec ent.Executor) ([]string, error) {
	var result []string
	for {
		op, err := exec.Operation()
		if err == ent.ErrAllOperations {
			break
		} else if err != nil {
			return nil, err
		}

		resolvableOp, ok := op.(ent.DataOperationWithResolver)
		if ok {
			if err = resolvableOp.Resolve(exec); err != nil {
				return nil, err
			}
		}

		idOp, ok := op.(tesDataOp)
		if !ok {
			return nil, errors.New("invalid op")
		}
		result = append(result, idOp.GetID())
	}
	return result, nil
}

func newChangesetFromExec(placeholderID string, executor ent.Executor) *EntMutationChangeset {
	// executor/ dependencies/changesets are what we care about...
	return &EntMutationChangeset{
		viewer:        viewer.LoggedOutViewer(),
		placeholderID: placeholderID,
		executor:      executor,
	}
}

func newChangesetFromOps(placeholderID string, ops []ent.DataOperation) *EntMutationChangeset {
	return &EntMutationChangeset{
		viewer:        viewer.LoggedOutViewer(),
		placeholderID: placeholderID,
		ops:           ops,
	}
}

func newListBasedExec(ids []string, placeholderID string) ent.Executor {
	return &entListBasedExecutor{
		placeholderID: placeholderID,
		ops:           newOrderedOps(ids, placeholderID),
	}
}

func newOrderedOps(ids []string, placeholderID string) []ent.DataOperation {
	var ops []ent.DataOperation
	for _, id := range ids {
		if strings.HasPrefix(id, "ent") {
			op := simpleOpWithEnt{}
			op.id = strings.ReplaceAll(id, "ent", "")
			ops = append(ops, op)
		} else {
			ops = append(ops, simpleOp{id})
		}
	}
	return ops
}

// this returns a changeset with a list of operations and specifically the list based operator
func newChangesetWithListBasedExec(ids []string, placeholderID string) *EntMutationChangeset {
	return newChangesetFromExec(placeholderID, newListBasedExec(ids, placeholderID))
}

// this returns a changeset with a list of operations and no defined executor
// the difference is executor is evaluated lazily depending on the value of things and we're depending on that right now...
func newListBasedChangeset(ids []string, placeholderID string) *EntMutationChangeset {
	return newChangesetFromOps(placeholderID, newOrderedOps(ids, placeholderID))
}

func getBuilder() *EntMutationBuilder {
	var user models.User
	return NewMutationBuilder(viewer.LoggedOutViewer(), ent.InsertOperation, &user, &configs.UserConfig{})
}
