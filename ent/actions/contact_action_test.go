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
	return m
}

func (a *createContactAction) Entity() ent.Entity {
	return &a.contact
}

func (a *createContactAction) getChangeset() (ent.Changeset, error) {
	for k, v := range a.getFields() {
		a.builder.SetField(k, v)
	}
	a.builder.FieldMap = getFieldMapFromFields(a.builder.Operation, a.getFields())
	return a.builder.GetChangeset(&a.contact)
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
	return a.getChangeset()
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
	builder := actions.NewMutationBuilder(
		trigger.Builder.GetViewer(),
		ent.InsertOperation,
		&configs.ContactEmailConfig{},
	)
	builder.SetField("EmailAddress", util.GenerateRandEmail())
	builder.SetField("Label", "main email")
	builder.SetField("ContactID", trigger.Builder)

	var contactEmail models.ContactEmail

	builder.FieldMap = getFieldMapFromFields(builder.Operation, builder.GetFields())

	return builder.GetChangeset(&contactEmail)
}
