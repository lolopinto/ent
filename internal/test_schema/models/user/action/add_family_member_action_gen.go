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

type AddFamilyMemberAction struct {
	builder *builder.UserMutationBuilder
}

// AddFamilyMemberFromContext is the factory method to get an ...
func AddFamilyMemberFromContext(ctx context.Context, user *models.User) *AddFamilyMemberAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return AddFamilyMember(v, user)
}

// AddFamilyMember is the factory method to get an ...
func AddFamilyMember(v viewer.ViewerContext, user *models.User) *AddFamilyMemberAction {
	action := &AddFamilyMemberAction{}
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

func (action *AddFamilyMemberAction) GetBuilder() ent.MutationBuilder {
	return action.builder
}

func (action *AddFamilyMemberAction) GetTypedBuilder() *builder.UserMutationBuilder {
	return action.builder
}

func (action *AddFamilyMemberAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *AddFamilyMemberAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	return action.builder.SetTriggers(triggers)
}

func (action *AddFamilyMemberAction) SetBuilderOnObservers(observers []actions.Observer) error {
	return action.builder.SetObservers(observers)
}

func (action *AddFamilyMemberAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(action)
}

func (action *AddFamilyMemberAction) Entity() ent.Entity {
	return action.builder.GetUser()
}

func (action *AddFamilyMemberAction) ExistingEnt() ent.Entity {
	return action.builder.ExistingEnt()
}

// AddFamilyMembers adds an instance of User to the FamilyMembers edge while editing the User ent
func (action *AddFamilyMemberAction) AddFamilyMembers(users ...*models.User) *AddFamilyMemberAction {
	action.builder.AddFamilyMembers(users...)
	return action
}

// AddFamilyMemberID adds an instance of UserID to the FamilyMembers edge while editing the User ent
func (action *AddFamilyMemberAction) AddFamilyMemberID(userID string, options ...func(*ent.EdgeOperation)) *AddFamilyMemberAction {
	action.builder.AddFamilyMemberID(userID, options...)
	return action
}

// getFieldMap returns the fields that could be edited in this mutation
func (action *AddFamilyMemberAction) getFieldMap() ent.ActionFieldMap {
	return ent.ActionFieldMap{}
}

func (action *AddFamilyMemberAction) requiredFields() []string {
	return []string{}
}

// Validate returns an error if the current state of the action is not valid
func (action *AddFamilyMemberAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *AddFamilyMemberAction) Save() (*models.User, error) {
	err := actions.Save(action)
	return action.builder.GetUser(), err
}

var _ actions.Action = &AddFamilyMemberAction{}
