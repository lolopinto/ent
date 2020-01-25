// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package action

import (
	"context"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	builder "github.com/lolopinto/ent/internal/test_schema/models/address"
)

type CreateAddressAction struct {
	builder *builder.AddressMutationBuilder
}

// CreateAddressFromContext is the factory method to get an ...
func CreateAddressFromContext(ctx context.Context) *CreateAddressAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return CreateAddress(v)
}

// CreateAddress is the factory method to get an ...
func CreateAddress(v viewer.ViewerContext) *CreateAddressAction {
	action := &CreateAddressAction{}
	builder := builder.NewMutationBuilder(
		v,
		ent.InsertOperation,
		action.getFieldMap(),
		action.requiredFields(),
	)
	action.builder = builder
	return action
}

func (action *CreateAddressAction) GetBuilder() ent.MutationBuilder {
	return action.builder
}

func (action *CreateAddressAction) GetTypedBuilder() *builder.AddressMutationBuilder {
	return action.builder
}

func (action *CreateAddressAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *CreateAddressAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	return action.builder.SetTriggers(triggers)
}

func (action *CreateAddressAction) SetBuilderOnObservers(observers []actions.Observer) error {
	return action.builder.SetObservers(observers)
}

func (action *CreateAddressAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(action)
}

func (action *CreateAddressAction) Entity() ent.Entity {
	return action.builder.GetAddress()
}

func (action *CreateAddressAction) ExistingEnt() ent.Entity {
	return action.builder.ExistingEnt()
}

// SetZip sets the Zip while editing the Address ent
func (action *CreateAddressAction) SetZip(zip string) *CreateAddressAction {
	action.builder.SetZip(zip)
	return action
}

// SetState sets the State while editing the Address ent
func (action *CreateAddressAction) SetState(state string) *CreateAddressAction {
	action.builder.SetState(state)
	return action
}

// SetCity sets the City while editing the Address ent
func (action *CreateAddressAction) SetCity(city string) *CreateAddressAction {
	action.builder.SetCity(city)
	return action
}

// SetStreetAddress sets the StreetAddress while editing the Address ent
func (action *CreateAddressAction) SetStreetAddress(streetAddress string) *CreateAddressAction {
	action.builder.SetStreetAddress(streetAddress)
	return action
}

// SetCountry sets the Country while editing the Address ent
func (action *CreateAddressAction) SetCountry(country string) *CreateAddressAction {
	action.builder.SetCountry(country)
	return action
}

// SetResidentNames sets the ResidentNames while editing the Address ent
func (action *CreateAddressAction) SetResidentNames(residentNames []string) *CreateAddressAction {
	action.builder.SetResidentNames(residentNames)
	return action
}

// getFieldMap returns the fields that could be edited in this mutation
func (action *CreateAddressAction) getFieldMap() ent.ActionFieldMap {
	return ent.ActionFieldMap{
		"Zip": &ent.MutatingFieldInfo{
			DB:       "zip",
			Required: true,
		},
		"State": &ent.MutatingFieldInfo{
			DB:       "state",
			Required: true,
		},
		"City": &ent.MutatingFieldInfo{
			DB:       "city",
			Required: true,
		},
		"StreetAddress": &ent.MutatingFieldInfo{
			DB:       "street_address",
			Required: true,
		},
		"Country": &ent.MutatingFieldInfo{
			DB:       "country",
			Required: true,
		},
		"ResidentNames": &ent.MutatingFieldInfo{
			DB:       "resident_names",
			Required: true,
		},
	}
}

func (action *CreateAddressAction) requiredFields() []string {
	return []string{
		"Zip",
		"State",
		"City",
		"StreetAddress",
		"Country",
		"ResidentNames",
	}
}

// Validate returns an error if the current state of the action is not valid
func (action *CreateAddressAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *CreateAddressAction) Save() (*models.Address, error) {
	err := actions.Save(action)
	return action.builder.GetAddress(), err
}

var _ actions.Action = &CreateAddressAction{}
