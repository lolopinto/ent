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

type CreateUserAction struct {
	builder *builder.UserMutationBuilder
}

// CreateUserFromContext is the factory method to get an ...
func CreateUserFromContext(ctx context.Context) *CreateUserAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return CreateUser(v)
}

// CreateUser is the factory method to get an ...
func CreateUser(v viewer.ViewerContext) *CreateUserAction {
	action := &CreateUserAction{}
	builder := builder.NewMutationBuilder(
		v,
		ent.InsertOperation,
		action.requiredFields(),
	)
	action.builder = builder
	return action
}

func (action *CreateUserAction) GetBuilder() ent.MutationBuilder {
	return action.builder
}

func (action *CreateUserAction) GetTypedBuilder() *builder.UserMutationBuilder {
	return action.builder
}

func (action *CreateUserAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *CreateUserAction) SetBuilderOnTriggers(triggers []actions.Trigger) {
	action.builder.SetTriggers(triggers)
}

func (action *CreateUserAction) SetBuilderOnObservers(observers []actions.Observer) {
	action.builder.SetObservers(observers)
}

func (action *CreateUserAction) SetBuilderOnValidators(validators []actions.Validator) {
	action.builder.SetValidators(validators)
}

func (action *CreateUserAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(action)
}

func (action *CreateUserAction) Entity() ent.Entity {
	return action.builder.GetUser()
}

func (action *CreateUserAction) ExistingEnt() ent.Entity {
	return action.builder.ExistingEnt()
}

// SetEmailAddress sets the EmailAddress while editing the User ent
func (action *CreateUserAction) SetEmailAddress(emailAddress string) *CreateUserAction {
	action.builder.SetEmailAddress(emailAddress)
	return action
}

// SetFirstName sets the FirstName while editing the User ent
func (action *CreateUserAction) SetFirstName(firstName string) *CreateUserAction {
	action.builder.SetFirstName(firstName)
	return action
}

// SetLastName sets the LastName while editing the User ent
func (action *CreateUserAction) SetLastName(lastName string) *CreateUserAction {
	action.builder.SetLastName(lastName)
	return action
}

// SetBio sets the Bio while editing the User ent
func (action *CreateUserAction) SetBio(bio string) *CreateUserAction {
	action.builder.SetBio(bio)
	return action
}

// SetNilableBio sets the Bio while editing the User ent
func (action *CreateUserAction) SetNilableBio(bio *string) *CreateUserAction {
	action.builder.SetNilableBio(bio)
	return action
}

func (action *CreateUserAction) requiredFields() []string {
	return []string{
		"EmailAddress",
		"FirstName",
		"LastName",
	}
}

// Validate returns an error if the current state of the action is not valid
func (action *CreateUserAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *CreateUserAction) Save() (*models.User, error) {
	err := actions.Save(action)
	return action.builder.GetUser(), err
}

var _ actions.Action = &CreateUserAction{}
