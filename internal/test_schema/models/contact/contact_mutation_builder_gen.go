// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package contact

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/field"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
)

type ContactMutationBuilder struct {
	requiredFields     []string
	builder            *actions.EntMutationBuilder
	contact            *models.Contact
	emailAddress       *string
	firstName          *string
	lastName           *string
	userID             *string
	userIDBuilder      ent.MutationBuilder
	favorite           *bool
	clearfavorite      bool
	numberOfCalls      *int
	clearnumberOfCalls bool
	pi                 *float64
	clearpi            bool
}

func NewMutationBuilder(
	v viewer.ViewerContext,
	operation ent.WriteOperation,
	requiredFields []string,
	opts ...func(*actions.EntMutationBuilder),
) *ContactMutationBuilder {
	var contact models.Contact

	ret := &ContactMutationBuilder{
		requiredFields: requiredFields,
		contact:        &contact,
	}
	opts = append(opts, actions.BuildFields(ret.buildFields))
	b := actions.NewMutationBuilder(
		v,
		operation,
		&contact,
		&configs.ContactConfig{},
		opts...,
	)
	ret.builder = b
	return ret
}

func (b *ContactMutationBuilder) SetEmailAddress(emailAddress string) *ContactMutationBuilder {
	b.emailAddress = &emailAddress
	return b
}

func (b *ContactMutationBuilder) SetFirstName(firstName string) *ContactMutationBuilder {
	b.firstName = &firstName
	return b
}

func (b *ContactMutationBuilder) SetLastName(lastName string) *ContactMutationBuilder {
	b.lastName = &lastName
	return b
}

func (b *ContactMutationBuilder) SetUserID(userID string) *ContactMutationBuilder {
	b.userID = &userID
	return b
}

func (b *ContactMutationBuilder) SetUserIDBuilder(builder ent.MutationBuilder) *ContactMutationBuilder {
	b.userIDBuilder = builder
	// this line not needed anymore
	//    b.builder.SetField("UserID", builder)
	return b
}

func (b *ContactMutationBuilder) SetFavorite(favorite bool) *ContactMutationBuilder {
	b.favorite = &favorite
	return b
}

func (b *ContactMutationBuilder) SetNilableFavorite(favorite *bool) *ContactMutationBuilder {
	b.favorite = favorite
	b.clearfavorite = (favorite == nil)
	return b
}

func (b *ContactMutationBuilder) SetNumberOfCalls(numberOfCalls int) *ContactMutationBuilder {
	b.numberOfCalls = &numberOfCalls
	return b
}

func (b *ContactMutationBuilder) SetNilableNumberOfCalls(numberOfCalls *int) *ContactMutationBuilder {
	b.numberOfCalls = numberOfCalls
	b.clearnumberOfCalls = (numberOfCalls == nil)
	return b
}

func (b *ContactMutationBuilder) SetPi(pi float64) *ContactMutationBuilder {
	b.pi = &pi
	return b
}

func (b *ContactMutationBuilder) SetNilablePi(pi *float64) *ContactMutationBuilder {
	b.pi = pi
	b.clearpi = (pi == nil)
	return b
}

func (b *ContactMutationBuilder) GetEmailAddress() string {
	if b.emailAddress == nil {
		return ""
	}
	return *b.emailAddress
}

func (b *ContactMutationBuilder) GetFirstName() string {
	if b.firstName == nil {
		return ""
	}
	return *b.firstName
}

func (b *ContactMutationBuilder) GetLastName() string {
	if b.lastName == nil {
		return ""
	}
	return *b.lastName
}

func (b *ContactMutationBuilder) GetUserID() string {
	if b.userID == nil {
		return ""
	}

	if b.userIDBuilder != nil {
		return b.userIDBuilder.GetPlaceholderID()
	}
	return *b.userID
}

func (b *ContactMutationBuilder) GetUserIDBuilder() ent.MutationBuilder {
	return b.userIDBuilder
}

func (b *ContactMutationBuilder) GetFavorite() *bool {
	if b.favorite == nil {
		return nil
	}
	return b.favorite
}

func (b *ContactMutationBuilder) GetNumberOfCalls() *int {
	if b.numberOfCalls == nil {
		return nil
	}
	return b.numberOfCalls
}

func (b *ContactMutationBuilder) GetPi() *float64 {
	if b.pi == nil {
		return nil
	}
	return b.pi
}

// AddAllowList adds one or more instances of User to the AllowList edge while editing the User ent
func (b *ContactMutationBuilder) AddAllowList(users ...*models.User) *ContactMutationBuilder {
	for _, user := range users {
		b.AddAllowListID(user.ID)
	}
	return b
}

// AddAllowListIDs adds an instance of User to the AllowList edge while editing the User ent
func (b *ContactMutationBuilder) AddAllowListIDs(userIDs ...string) *ContactMutationBuilder {
	for _, userID := range userIDs {
		b.AddAllowListID(userID)
	}
	return b
}

// AddAllowListID adds an instance of User to the AllowList edge while editing the User ent
func (b *ContactMutationBuilder) AddAllowListID(userID string, options ...func(*ent.EdgeOperation)) *ContactMutationBuilder {
	b.builder.AddOutboundEdge(models.ContactToAllowListEdge, userID, models.UserType, options...)
	return b
}

// RemoveAllowList removes an instance of User from the AllowList edge while editing the User ent
func (b *ContactMutationBuilder) RemoveAllowList(users ...*models.User) *ContactMutationBuilder {
	for _, user := range users {
		b.RemoveAllowListID(user.ID)
	}
	return b
}

// RemoveAllowListIDs removes an instance of User from the AllowList edge while editing the User ent
func (b *ContactMutationBuilder) RemoveAllowListIDs(userIDs ...string) *ContactMutationBuilder {
	for _, userID := range userIDs {
		b.RemoveAllowListID(userID)
	}
	return b
}

// RemoveAllowListID removes an instance of User from the AllowList edge while editing the User ent
func (b *ContactMutationBuilder) RemoveAllowListID(userID string) *ContactMutationBuilder {
	b.builder.RemoveOutboundEdge(models.ContactToAllowListEdge, userID, models.UserType)
	return b
}

func (b *ContactMutationBuilder) GetViewer() viewer.ViewerContext {
	return b.builder.GetViewer()
}

func (b *ContactMutationBuilder) GetContact() *models.Contact {
	return b.contact
}

// TODO rename from GetChangeset to Build()
// A Builder builds.
func (b *ContactMutationBuilder) GetChangeset() (ent.Changeset, error) {
	return b.builder.GetChangeset()
}

// Call Validate (should be Valid) at any point to validate that builder is valid
func (b *ContactMutationBuilder) Validate() error {
	return b.builder.Validate()
}

func (b *ContactMutationBuilder) buildFields() ent.ActionFieldMap {
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
	if b.emailAddress != nil {
		addField("EmailAddress", *b.emailAddress)
	} else if m["EmailAddress"] { // nil but required
		addField("EmailAddress", nil)
	}
	if b.firstName != nil {
		addField("FirstName", *b.firstName)
	} else if m["FirstName"] { // nil but required
		addField("FirstName", nil)
	}
	if b.lastName != nil {
		addField("LastName", *b.lastName)
	} else if m["LastName"] { // nil but required
		addField("LastName", nil)
	}
	if b.userID != nil {
		addField("UserID", *b.userID)
	} else if m["UserID"] { // nil but required
		addField("UserID", nil)
	}
	if b.userIDBuilder != nil {
		addField("UserID", b.userIDBuilder)
	}
	if b.favorite != nil {
		addField("Favorite", *b.favorite)
	} else if m["Favorite"] || b.clearfavorite { // required or value cleared
		addField("Favorite", nil)
	}
	if b.numberOfCalls != nil {
		addField("NumberOfCalls", *b.numberOfCalls)
	} else if m["NumberOfCalls"] || b.clearnumberOfCalls { // required or value cleared
		addField("NumberOfCalls", nil)
	}
	if b.pi != nil {
		addField("Pi", *b.pi)
	} else if m["Pi"] || b.clearpi { // required or value cleared
		addField("Pi", nil)
	}
	return fields
}

func (b *ContactMutationBuilder) ExistingEnt() ent.Entity {
	return b.builder.ExistingEnt()
}

func (b *ContactMutationBuilder) Entity() ent.Entity {
	return b.builder.Entity()
}

func (b *ContactMutationBuilder) GetOperation() ent.WriteOperation {
	return b.builder.GetOperation()
}

func (b *ContactMutationBuilder) GetPlaceholderID() string {
	return b.builder.GetPlaceholderID()
}

// GetFields returns the field configuration for this mutation builder
// For now, always take it from config because we assume it's always from there
// TODO do for things using old API
func (b *ContactMutationBuilder) GetFields() ent.FieldMap {
	return ent.FieldMap{
		"EmailAddress":  field.F(field.Noop(), field.DB("email_address")),
		"FirstName":     field.F(field.Noop(), field.DB("first_name")),
		"LastName":      field.F(field.Noop(), field.DB("last_name")),
		"UserID":        field.F(field.Noop(), field.DB("user_id")),
		"Favorite":      field.F(field.Noop(), field.DB("favorite"), field.Nullable()),
		"NumberOfCalls": field.F(field.Noop(), field.DB("number_of_calls"), field.Nullable()),
		"Pi":            field.F(field.Noop(), field.DB("pi"), field.Nullable()),
	}
	// we need to eventually know difference between set to nil vs nil value
	// set to nil is when we care about passing nil to Field.Format()
	// TODO
	// so for now, we go through each field, if not null, we call Valid() and Format() and everything else on them
	// if nil, leave as-is
	// we need a list of required fields...
}

var _ ent.MutationBuilder = &ContactMutationBuilder{}

func (b *ContactMutationBuilder) setBuilder(v interface{}) {
	callback, ok := v.(ContactCallbackWithBuilder)
	if ok {
		callback.SetBuilder(b)
	}
}

// SetTriggers sets the builder on the triggers.
func (b *ContactMutationBuilder) SetTriggers(triggers []actions.Trigger) {
	b.builder.SetTriggers(triggers)
	for _, t := range triggers {
		b.setBuilder(t)
	}
}

// SetObservers sets the builder on the observers.
func (b *ContactMutationBuilder) SetObservers(observers []actions.Observer) {
	b.builder.SetObservers(observers)
	for _, o := range observers {
		b.setBuilder(o)
	}
}

// SetValidators sets the builder on validators.
func (b *ContactMutationBuilder) SetValidators(validators []actions.Validator) {
	b.builder.SetValidators(validators)
	for _, v := range validators {
		b.setBuilder(v)
	}
}

type ContactCallbackWithBuilder interface {
	SetBuilder(*ContactMutationBuilder)
}

type ContactMutationCallback struct {
	Builder *ContactMutationBuilder
}

func (callback *ContactMutationCallback) SetBuilder(b *ContactMutationBuilder) {
	callback.Builder = b
}
