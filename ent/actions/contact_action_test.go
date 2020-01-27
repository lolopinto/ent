package actions_test

import (
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/util"
)

type createContactAction struct {
	viewer       viewer.ViewerContext
	emailAddress interface{}
	firstName    interface{}
	lastName     interface{}
	user         *models.User
	userID       interface{}
	contact      models.Contact
	builder      *actions.EntMutationBuilder
}

func (a *createContactAction) GetViewer() viewer.ViewerContext {
	return a.viewer
}

func (a *createContactAction) GetBuilder() ent.MutationBuilder {
	a.builder.SetRawFields(a.getFields())
	return a.builder
}

func (a *createContactAction) getFields() map[string]interface{} {
	m := make(map[string]interface{})
	if a.emailAddress != nil {
		m["EmailAddress"] = a.emailAddress
	}
	if a.firstName != nil {
		m["FirstName"] = a.firstName
	}
	if a.lastName != nil {
		m["LastName"] = a.lastName
	}
	if a.user != nil {
		m["UserID"] = a.user.ID
	} else if a.userID != nil {
		m["UserID"] = a.userID
	}
	// TODO default values...
	// m["Favorite"] = false
	// m["Pi"] = 3.14
	// m["NumberOfCalls"] = 5
	return m
}

func (a *createContactAction) Entity() ent.Entity {
	return &a.contact
}

func (a *createContactAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	// hmm
	a.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(ContactTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(a.builder)
	}
	return nil
}

func (a *createContactAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

type ContactTrigger interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type ContactMutationBuilderTrigger struct {
	Builder *actions.EntMutationBuilder
}

func (trigger *ContactMutationBuilderTrigger) SetBuilder(b *actions.EntMutationBuilder) {
	trigger.Builder = b
}

type createContactAndEmailAction struct {
	createContactAction
}

func (action *createContactAndEmailAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&ContactCreateEmailTrigger{},
	}
}

type ContactCreateEmailTrigger struct {
	ContactMutationBuilderTrigger
}

func (trigger *ContactCreateEmailTrigger) GetChangeset() (ent.Changeset, error) {
	var contactEmail models.ContactEmail
	builder := actions.NewMutationBuilder(
		trigger.Builder.GetViewer(),
		ent.InsertOperation,
		&contactEmail,
		&configs.ContactEmailConfig{},
	)
	builder.SetRawFields(map[string]interface{}{
		"email_address": util.GenerateRandEmail(),
		"label":         "main email",
		"contact_id":    trigger.Builder,
		// now this is where we need to combine things
		// TODO for dependencies and other things
	})

	return builder.GetChangeset()
}
