// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package action

import (
	"context"
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	builder "github.com/lolopinto/ent/internal/test_schema/models/contact"
)

type CreateContactAction struct {
	builder *builder.ContactMutationBuilder
}

// CreateContactFromContext is the factory method to get an ...
func CreateContactFromContext(ctx context.Context) *CreateContactAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return CreateContact(v)
}

// CreateContact is the factory method to get an ...
func CreateContact(viewer viewer.ViewerContext) *CreateContactAction {
	action := &CreateContactAction{}
	builder := builder.NewMutationBuilder(
		viewer,
		ent.InsertOperation,
		action.getFieldMap(),
	)
	action.builder = builder
	return action
}

func (action *CreateContactAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *CreateContactAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	action.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(builder.ContactTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(action.builder)
	}
	return nil
}

func (action *CreateContactAction) GetChangeset() (ent.Changeset, error) {
	return action.builder.GetChangeset(nil)
}

func (action *CreateContactAction) Entity() ent.Entity {
	return action.builder.GetContact()
}

// SetEmailAddress sets the EmailAddress while editing the Contact ent
func (action *CreateContactAction) SetEmailAddress(emailAddress string) *CreateContactAction {
	action.builder.SetEmailAddress(emailAddress)
	return action
}

// SetFirstName sets the FirstName while editing the Contact ent
func (action *CreateContactAction) SetFirstName(firstName string) *CreateContactAction {
	action.builder.SetFirstName(firstName)
	return action
}

// SetLastName sets the LastName while editing the Contact ent
func (action *CreateContactAction) SetLastName(lastName string) *CreateContactAction {
	action.builder.SetLastName(lastName)
	return action
}

// SetUserID sets the UserID while editing the Contact ent
func (action *CreateContactAction) SetUserID(userID string) *CreateContactAction {
	action.builder.SetUserID(userID)
	return action
}

// SetUserIDBuilder sets the UserID while editing the Contact ent
func (action *CreateContactAction) SetUserIDBuilder(builder ent.MutationBuilder) *CreateContactAction {
	action.builder.SetUserIDBuilder(builder)
	return action
}

// SetFavorite sets the Favorite while editing the Contact ent
func (action *CreateContactAction) SetFavorite(favorite bool) *CreateContactAction {
	action.builder.SetFavorite(favorite)
	return action
}

// SetNumberOfCalls sets the NumberOfCalls while editing the Contact ent
func (action *CreateContactAction) SetNumberOfCalls(numberOfCalls int) *CreateContactAction {
	action.builder.SetNumberOfCalls(numberOfCalls)
	return action
}

// SetPi sets the Pi while editing the Contact ent
func (action *CreateContactAction) SetPi(pi float64) *CreateContactAction {
	action.builder.SetPi(pi)
	return action
}

// getFieldMap returns the fields that could be edited in this mutation
func (action *CreateContactAction) getFieldMap() ent.ActionFieldMap {
	return ent.ActionFieldMap{
		"EmailAddress": &ent.MutatingFieldInfo{
			DB:       "email_address",
			Required: true,
		},
		"FirstName": &ent.MutatingFieldInfo{
			DB:       "first_name",
			Required: true,
		},
		"LastName": &ent.MutatingFieldInfo{
			DB:       "last_name",
			Required: true,
		},
		"UserID": &ent.MutatingFieldInfo{
			DB:       "user_id",
			Required: true,
		},
		"Favorite": &ent.MutatingFieldInfo{
			DB:       "favorite",
			Required: true,
		},
		"NumberOfCalls": &ent.MutatingFieldInfo{
			DB:       "number_of_calls",
			Required: true,
		},
		"Pi": &ent.MutatingFieldInfo{
			DB:       "pi",
			Required: true,
		},
	}
}

// Validate returns an error if the current state of the action is not valid
func (action *CreateContactAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *CreateContactAction) Save() (*models.Contact, error) {
	err := actions.Save(action)
	return action.builder.GetContact(), err
}

var _ actions.Action = &CreateContactAction{}
