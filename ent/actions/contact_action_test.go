package actions_test

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/util"
)

type createContactAction struct {
	viewer       viewer.ViewerContext
	emailAddress interface{}
	firstName    interface{}
	lastName     interface{}
	user         *models.User
	userID       interface{}
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
		m["email_address"] = a.emailAddress
	}
	if a.firstName != nil {
		m["first_name"] = a.firstName
	}
	if a.lastName != nil {
		m["last_name"] = a.lastName
	}
	if a.user != nil {
		m["user_id"] = a.user.ID
	} else if a.userID != nil {
		m["user_id"] = a.userID
	}
	return m
}

func (a *createContactAction) Entity() ent.Entity {
	return a.builder.Entity()
}

func (a *createContactAction) GetContact() *models.Contact {
	return a.builder.Entity().(*models.Contact)
}

func (a *createContactAction) setBuilder(v interface{}) {
	callback, ok := v.(ContactCallbackWithBuilder)
	if ok {
		callback.SetBuilder(a.builder)
	}
}

func (a *createContactAction) SetBuilderOnTriggers(triggers []actions.Trigger) {
	a.builder.SetTriggers(triggers)
	for _, t := range triggers {
		a.setBuilder(t)
	}
}

func (a *createContactAction) SetBuilderOnObservers(observers []actions.Observer) {
	a.builder.SetObservers(observers)
	for _, o := range observers {
		a.setBuilder(o)
	}
}

func (a *createContactAction) SetBuilderOnValidators(validators []actions.Validator) {
	a.builder.SetValidators(validators)
	for _, v := range validators {
		a.setBuilder(v)
	}
}

func (a *createContactAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func (a *createContactAction) Save() (*models.Contact, error) {
	err := actions.Save(a)
	if err != nil {
		return nil, err
	}
	return a.GetContact(), err
}

type ContactCallbackWithBuilder interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type ContactMutationCallback struct {
	Builder *actions.EntMutationBuilder
}

func (callback *ContactMutationCallback) SetBuilder(b *actions.EntMutationBuilder) {
	callback.Builder = b
}

type createContactAndEmailAction struct {
	createContactAction
}

func (action *createContactAndEmailAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&ContactCreateEmailTrigger{},
	}
}

func (a *createContactAndEmailAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func (a *createContactAndEmailAction) Save() (*models.Contact, error) {
	err := actions.Save(a)
	if err != nil {
		return nil, err
	}
	return a.GetContact(), err
}

type ContactCreateEmailTrigger struct {
	ContactMutationCallback
}

func (trigger *ContactCreateEmailTrigger) GetChangeset() (ent.Changeset, error) {
	loader := models.NewContactEmailLoader(trigger.Builder.GetViewer())
	builder := actions.NewMutationBuilder(
		trigger.Builder.GetViewer(),
		ent.InsertOperation,
		loader.GetNewContactEmail(),
		loader.GetConfig(),
	)
	builder.SetRawFields(map[string]interface{}{
		"email_address": util.GenerateRandEmail(),
		"label":         "main email",
		"contact_id":    trigger.Builder,
	})

	return builder.GetChangeset()
}
