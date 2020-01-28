// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package address

import (
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
)

type AddressMutationBuilder struct {
	requiredFields []string
	builder        *actions.EntMutationBuilder
	address        *models.Address
	country        *string
	streetAddress  *string
	state          *string
	residentNames  *[]string
	zip            *string
	city           *string
}

func NewMutationBuilder(
	v viewer.ViewerContext,
	operation ent.WriteOperation,
	requiredFields []string,
	opts ...func(*actions.EntMutationBuilder),
) *AddressMutationBuilder {
	var address models.Address

	ret := &AddressMutationBuilder{
		requiredFields: requiredFields,
		address:        &address,
	}
	opts = append(opts, actions.BuildFields(ret.buildFields))
	b := actions.NewMutationBuilder(
		v,
		operation,
		&address,
		&configs.AddressConfig{},
		opts...,
	)
	ret.builder = b
	return ret
}

func (b *AddressMutationBuilder) SetCountry(country string) *AddressMutationBuilder {
	b.country = &country
	return b
}

func (b *AddressMutationBuilder) SetStreetAddress(streetAddress string) *AddressMutationBuilder {
	b.streetAddress = &streetAddress
	return b
}

func (b *AddressMutationBuilder) SetState(state string) *AddressMutationBuilder {
	b.state = &state
	return b
}

func (b *AddressMutationBuilder) SetResidentNames(residentNames []string) *AddressMutationBuilder {
	b.residentNames = &residentNames
	return b
}

func (b *AddressMutationBuilder) SetZip(zip string) *AddressMutationBuilder {
	b.zip = &zip
	return b
}

func (b *AddressMutationBuilder) SetCity(city string) *AddressMutationBuilder {
	b.city = &city
	return b
}

func (b *AddressMutationBuilder) GetCountry() string {
	if b.country == nil {
		return ""
	}
	return *b.country
}

func (b *AddressMutationBuilder) GetStreetAddress() string {
	if b.streetAddress == nil {
		return ""
	}
	return *b.streetAddress
}

func (b *AddressMutationBuilder) GetState() string {
	if b.state == nil {
		return ""
	}
	return *b.state
}

func (b *AddressMutationBuilder) GetResidentNames() []string {
	if b.residentNames == nil {
		return nil
	}
	return *b.residentNames
}

func (b *AddressMutationBuilder) GetZip() string {
	if b.zip == nil {
		return ""
	}
	return *b.zip
}

func (b *AddressMutationBuilder) GetCity() string {
	if b.city == nil {
		return ""
	}
	return *b.city
}

func (b *AddressMutationBuilder) GetViewer() viewer.ViewerContext {
	return b.builder.GetViewer()
}

func (b *AddressMutationBuilder) GetAddress() *models.Address {
	return b.address
}

func (b *AddressMutationBuilder) SetTriggers(triggers []actions.Trigger) error {
	b.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(AddressTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(b)
	}
	return nil
}

// SetObservers sets the builder on an observer. Unlike SetTriggers, it's not required that observers implement the AddressObserver
// interface since there's expected to be more reusability here e.g. generic logging, generic send text observer etc
func (b *AddressMutationBuilder) SetObservers(observers []actions.Observer) error {
	b.builder.SetObservers(observers)
	for _, o := range observers {
		observer, ok := o.(AddressObserver)
		if ok {
			observer.SetBuilder(b)
		}
	}
	return nil
}

// TODO rename from GetChangeset to Build()
// A Builder builds.
func (b *AddressMutationBuilder) GetChangeset() (ent.Changeset, error) {
	return b.builder.GetChangeset()
}

// Call Validate (should be Valid) at any point to validate that builder is valid
func (b *AddressMutationBuilder) Validate() error {
	return b.builder.Validate()
}

func (b *AddressMutationBuilder) buildFields() ent.ActionFieldMap {
	m := make(map[string]bool)
	for _, f := range b.requiredFields {
		m[f] = true
	}

	fieldMap := b.GetFields()
	fields := make(ent.ActionFieldMap)
	addField := func(key string, val interface{}) {
		fields[key] = &ent.FieldInfo{
			Field: fieldMap[key],
			Value: val,
		}
	}

	//  SetField is done at the end after transform
	// map[FieldName] => Field | value
	// that's what we're passing down

	// Need to have Id fields be fine with Builder

	// if required or field is nil, always add the field
	if b.country != nil {
		addField("Country", *b.country)
	} else if m["Country"] { // nil but required
		addField("Country", nil)
	}
	if b.streetAddress != nil {
		addField("StreetAddress", *b.streetAddress)
	} else if m["StreetAddress"] { // nil but required
		addField("StreetAddress", nil)
	}
	if b.state != nil {
		addField("State", *b.state)
	} else if m["State"] { // nil but required
		addField("State", nil)
	}
	if b.residentNames != nil {
		addField("ResidentNames", *b.residentNames)
	} else if m["ResidentNames"] { // nil but required
		addField("ResidentNames", nil)
	}
	if b.zip != nil {
		addField("Zip", *b.zip)
	} else if m["Zip"] { // nil but required
		addField("Zip", nil)
	}
	if b.city != nil {
		addField("City", *b.city)
	} else if m["City"] { // nil but required
		addField("City", nil)
	}
	return fields
}

func (b *AddressMutationBuilder) ExistingEnt() ent.Entity {
	return b.builder.ExistingEnt()
}

func (b *AddressMutationBuilder) Entity() ent.Entity {
	return b.builder.Entity()
}

func (b *AddressMutationBuilder) GetOperation() ent.WriteOperation {
	return b.builder.GetOperation()
}

func (b *AddressMutationBuilder) GetPlaceholderID() string {
	return b.builder.GetPlaceholderID()
}

// GetFields returns the field configuration for this mutation builder
// For now, always take it from config because we assume it's always from there
// TODO do for things using old API
func (b *AddressMutationBuilder) GetFields() ent.FieldMap {
	return (&configs.AddressConfig{}).GetFields()
	// we need to eventually know difference between set to nil vs nil value
	// set to nil is when we care about passing nil to Field.Format()
	// TODO
	// so for now, we go through each field, if not null, we call Valid() and Format() and everything else on them
	// if nil, leave as-is
	// we need a list of required fields...
}

var _ ent.MutationBuilder = &AddressMutationBuilder{}

type AddressTrigger interface {
	SetBuilder(*AddressMutationBuilder)
}

type AddressMutationBuilderTrigger struct {
	Builder *AddressMutationBuilder
}

func (trigger *AddressMutationBuilderTrigger) SetBuilder(b *AddressMutationBuilder) {
	trigger.Builder = b
}

type AddressObserver interface {
	SetBuilder(*AddressMutationBuilder)
}

type AddressMutationBuilderObserver struct {
	Builder *AddressMutationBuilder
}

func (observer *AddressMutationBuilderObserver) SetBuilder(b *AddressMutationBuilder) {
	observer.Builder = b
}
