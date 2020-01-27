// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package action

import (
	"context"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	builder "github.com/lolopinto/ent/internal/test_schema/models/user"
)

type RemoveFamilyMemberAction struct {
	builder *builder.UserMutationBuilder
}

// RemoveFamilyMemberFromContext is the factory method to get an ...
func RemoveFamilyMemberFromContext(ctx context.Context, user *models.User) *RemoveFamilyMemberAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return RemoveFamilyMember(v, user)
}

// RemoveFamilyMember is the factory method to get an ...
func RemoveFamilyMember(v viewer.ViewerContext, user *models.User) *RemoveFamilyMemberAction {
	action := &RemoveFamilyMemberAction{}
	builder := builder.NewMutationBuilder(
		v,
		ent.EditOperation,
		action.getFieldMap(),
		action.requiredFields(),
		actions.ExistingEnt(user),
	)
	action.builder = builder
	return action
}

func (action *RemoveFamilyMemberAction) GetBuilder() ent.MutationBuilder {
	return action.builder
}

func (action *RemoveFamilyMemberAction) GetTypedBuilder() *builder.UserMutationBuilder {
	return action.builder
}

func (action *RemoveFamilyMemberAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *RemoveFamilyMemberAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	return action.builder.SetTriggers(triggers)
}

func (action *RemoveFamilyMemberAction) SetBuilderOnObservers(observers []actions.Observer) error {
	return action.builder.SetObservers(observers)
}

func (action *RemoveFamilyMemberAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(action)
}

func (action *RemoveFamilyMemberAction) Entity() ent.Entity {
	return action.builder.GetUser()
}

func (action *RemoveFamilyMemberAction) ExistingEnt() ent.Entity {
	return action.builder.ExistingEnt()
}

// RemoveFamilyMembers removes an instance of User from the FamilyMembers edge while editing the User ent
func (action *RemoveFamilyMemberAction) RemoveFamilyMembers(users ...*models.User) *RemoveFamilyMemberAction {
	action.builder.RemoveFamilyMembers(users...)
	return action
}

// RemoveFamilyMemberID removes an instance of UserID from the FamilyMembers edge while editing the User ent
func (action *RemoveFamilyMemberAction) RemoveFamilyMemberID(userID string) *RemoveFamilyMemberAction {
	action.builder.RemoveFamilyMemberID(userID)
	return action
}

// getFieldMap returns the fields that could be edited in this mutation
func (action *RemoveFamilyMemberAction) getFieldMap() ent.ActionFieldMap {
	return ent.ActionFieldMap{}
}

func (action *RemoveFamilyMemberAction) requiredFields() []string {
	return []string{}
}

// Validate returns an error if the current state of the action is not valid
func (action *RemoveFamilyMemberAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *RemoveFamilyMemberAction) Save() (*models.User, error) {
	err := actions.Save(action)
	return action.builder.GetUser(), err
}

var _ actions.Action = &RemoveFamilyMemberAction{}
