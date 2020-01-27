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

type EditAddressAction struct {
	builder *builder.AddressMutationBuilder
}

// EditAddressFromContext is the factory method to get an ...
func EditAddressFromContext(ctx context.Context, address *models.Address) *EditAddressAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return EditAddress(v, address)
}

// EditAddress is the factory method to get an ...
func EditAddress(v viewer.ViewerContext, address *models.Address) *EditAddressAction {
	action := &EditAddressAction{}
	builder := builder.NewMutationBuilder(
		v,
		ent.EditOperation,
		action.getFieldMap(),
		action.requiredFields(),
		actions.ExistingEnt(address),
	)
	action.builder = builder
	return action
}

func (action *EditAddressAction) GetBuilder() ent.MutationBuilder {
	return action.builder
}

func (action *EditAddressAction) GetTypedBuilder() *builder.AddressMutationBuilder {
	return action.builder
}

func (action *EditAddressAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *EditAddressAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	return action.builder.SetTriggers(triggers)
}

func (action *EditAddressAction) SetBuilderOnObservers(observers []actions.Observer) error {
	return action.builder.SetObservers(observers)
}

func (action *EditAddressAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(action)
}

func (action *EditAddressAction) Entity() ent.Entity {
	return action.builder.GetAddress()
}

func (action *EditAddressAction) ExistingEnt() ent.Entity {
	return action.builder.ExistingEnt()
}

// SetCity sets the City while editing the Address ent
func (action *EditAddressAction) SetCity(city string) *EditAddressAction {
	action.builder.SetCity(city)
	return action
}

// SetResidentNames sets the ResidentNames while editing the Address ent
func (action *EditAddressAction) SetResidentNames(residentNames []string) *EditAddressAction {
	action.builder.SetResidentNames(residentNames)
	return action
}

// SetState sets the State while editing the Address ent
func (action *EditAddressAction) SetState(state string) *EditAddressAction {
	action.builder.SetState(state)
	return action
}

// SetZip sets the Zip while editing the Address ent
func (action *EditAddressAction) SetZip(zip string) *EditAddressAction {
	action.builder.SetZip(zip)
	return action
}

// SetStreetAddress sets the StreetAddress while editing the Address ent
func (action *EditAddressAction) SetStreetAddress(streetAddress string) *EditAddressAction {
	action.builder.SetStreetAddress(streetAddress)
	return action
}

// SetCountry sets the Country while editing the Address ent
func (action *EditAddressAction) SetCountry(country string) *EditAddressAction {
	action.builder.SetCountry(country)
	return action
}

// getFieldMap returns the fields that could be edited in this mutation
func (action *EditAddressAction) getFieldMap() ent.ActionFieldMap {
	return ent.ActionFieldMap{
		"City": &ent.MutatingFieldInfo{
			DB:       "city",
			Required: false,
		},
		"ResidentNames": &ent.MutatingFieldInfo{
			DB:       "resident_names",
			Required: false,
		},
		"State": &ent.MutatingFieldInfo{
			DB:       "state",
			Required: false,
		},
		"Zip": &ent.MutatingFieldInfo{
			DB:       "zip",
			Required: false,
		},
		"StreetAddress": &ent.MutatingFieldInfo{
			DB:       "street_address",
			Required: false,
		},
		"Country": &ent.MutatingFieldInfo{
			DB:       "country",
			Required: false,
		},
	}
}

func (action *EditAddressAction) requiredFields() []string {
	return []string{}
}

// Validate returns an error if the current state of the action is not valid
func (action *EditAddressAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *EditAddressAction) Save() (*models.Address, error) {
	err := actions.Save(action)
	return action.builder.GetAddress(), err
}

var _ actions.Action = &EditAddressAction{}
