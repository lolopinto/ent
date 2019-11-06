// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package action

import (
	"context"
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	builder "github.com/lolopinto/ent/internal/test_schema/models/user"
)

type RemoveFamilyMembersAction struct {
	builder *builder.UserMutationBuilder
}

// RemoveFamilyMembersFromContext is the factory method to get an ...
func RemoveFamilyMembersFromContext(ctx context.Context, user *models.User) *RemoveFamilyMembersAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return RemoveFamilyMembers(v, user)
}

// RemoveFamilyMembers is the factory method to get an ...
func RemoveFamilyMembers(viewer viewer.ViewerContext, user *models.User) *RemoveFamilyMembersAction {
	action := &RemoveFamilyMembersAction{}
	builder := builder.NewMutationBuilder(
		viewer,
		ent.EditOperation,
		action.getFieldMap(),
		actions.ExistingEnt(user),
	)
	action.builder = builder
	return action
}

func (action *RemoveFamilyMembersAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *RemoveFamilyMembersAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	action.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(builder.UserTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(action.builder)
	}
	return nil
}

func (action *RemoveFamilyMembersAction) GetChangeset() (ent.Changeset, error) {
	return action.builder.GetChangeset(nil)
}

func (action *RemoveFamilyMembersAction) Entity() ent.Entity {
	return action.builder.GetUser()
}

// AddFamilyMembers adds an instance of User to the FamilyMembers edge while editing the User ent
func (action *RemoveFamilyMembersAction) AddFamilyMembers(user *models.User) *RemoveFamilyMembersAction {
	action.builder.RemoveFamilyMembers(user)
	return action
}

// AddFamilyMembers adds an instance of UserId to the FamilyMembers edge while editing the User ent
func (action *RemoveFamilyMembersAction) AddFamilyMembersID(userID string) *RemoveFamilyMembersAction {
	action.builder.RemoveFamilyMembersID(userID)
	return action
}

// getFieldMap returns the fields that could be edited in this mutation
func (action *RemoveFamilyMembersAction) getFieldMap() ent.ActionFieldMap {
	return ent.ActionFieldMap{}
}

// Validate returns an error if the current state of the action is not valid
func (action *RemoveFamilyMembersAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *RemoveFamilyMembersAction) Save() (*models.User, error) {
	err := actions.Save(action)
	return action.builder.GetUser(), err
}

var _ actions.Action = &RemoveFamilyMembersAction{}
