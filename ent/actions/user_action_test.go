package actions_test

import (
	"errors"
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/testingutils"
)

type userAction struct {
	viewer       viewer.ViewerContext
	emailAddress string
	firstName    string
	lastName     string
	user         models.User
	builder      *actions.EntMutationBuilder
}

func (a *userAction) GetViewer() viewer.ViewerContext {
	return a.viewer
}

func (a *userAction) GetBuilder() ent.MutationBuilder {
	a.builder.SetRawFields(a.getFields())
	return a.builder
}

// this will be auto-generated for actions
// We need to do this because of how go's type system works
func (a *userAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	// hmm
	a.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(UserTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(a.builder)
	}
	return nil
}

func (a *userAction) SetBuilderOnObservers(observers []actions.Observer) error {
	a.builder.SetObservers(observers)
	for _, o := range observers {
		observer, ok := o.(UserObserver)
		if ok {
			observer.SetBuilder(a.builder)
		}
	}
	return nil
}

func (a *userAction) getFields() map[string]interface{} {
	m := make(map[string]interface{})
	if a.emailAddress != "" {
		m["EmailAddress"] = a.emailAddress
	}
	if a.firstName != "" {
		m["FirstName"] = a.firstName
	}
	if a.lastName != "" {
		m["LastName"] = a.lastName
	}
	return m
}

func (a *userAction) Entity() ent.Entity {
	return &a.user
}

type createUserAction struct {
	userAction
}

func (a *createUserAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func (a *createUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			privacy.AlwaysAllowRule{},
		),
	}
}

var _ actions.ActionWithPermissions = &createUserAction{}

type editUserAction struct {
	userAction
	existingEnt models.User
}

func (a *editUserAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func getEditUserPrivacyPolicy(existingEnt ent.Entity) ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			privacy.AllowIfViewerIsOwnerRule{existingEnt.GetID()},
			privacy.AlwaysDenyRule{},
		),
	}
}

func (a *editUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return getEditUserPrivacyPolicy(&a.existingEnt)
}

var _ actions.ActionWithPermissions = &editUserAction{}

func (a *createUserAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&UserCreateContactTrigger{},
	}
}

type createUserAndEventAction struct {
	createUserAction
}

func (a *createUserAndEventAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&UserCreateEventTrigger{},
	}
}

type createUserContactAndEmailAction struct {
	createUserAction
}

func (a *createUserContactAndEmailAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&UserCreateContactAndEmailTrigger{},
	}
}

type createUserAndAllTheThingsAction struct {
	createUserAction
}

func (a *createUserAndAllTheThingsAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&UserCreateEventTrigger{},
		&UserCreateContactAndEmailTrigger{},
	}
}

type deleteUserAction struct {
	userAction
	existingEnt models.User
}

func (a *deleteUserAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func (a *deleteUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return getEditUserPrivacyPolicy(&a.existingEnt)
}

func (a *deleteUserAction) GetObservers() []actions.Observer {
	return []actions.Observer{
		testingutils.SendMicroserviceObserver{},
		&UserSendByeEmailObserver{},
	}
}

var _ actions.ActionWithPermissions = &editUserAction{}

type UserTrigger interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type UserMutationBuilderTrigger struct {
	Builder *actions.EntMutationBuilder
}

func (trigger *UserMutationBuilderTrigger) SetBuilder(b *actions.EntMutationBuilder) {
	trigger.Builder = b
}

type UserObserver interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type UserMutationBuilderObserver struct {
	Builder *actions.EntMutationBuilder
}

func (observer *UserMutationBuilderObserver) SetBuilder(b *actions.EntMutationBuilder) {
	observer.Builder = b
}

type UserCreateContactTrigger struct {
	UserMutationBuilderTrigger
}

func (trigger *UserCreateContactTrigger) GetChangeset() (ent.Changeset, error) {
	// create a contact action and send changeset
	a := &createContactAction{}
	a.viewer = trigger.Builder.GetViewer()
	a.builder = actions.NewMutationBuilder(
		a.viewer, ent.InsertOperation, &a.contact, &configs.ContactConfig{},
	)
	fields := trigger.Builder.GetFields()
	a.firstName = fields["FirstName"]
	a.lastName = fields["LastName"]
	a.emailAddress = fields["EmailAddress"]
	a.userID = trigger.Builder

	return actions.GetChangeset(a)
}

type UserCreateContactAndEmailTrigger struct {
	UserMutationBuilderTrigger
}

func (trigger *UserCreateContactAndEmailTrigger) GetChangeset() (ent.Changeset, error) {
	// create a contact action and send changeset
	// same as above except for this line.
	a := &createContactAndEmailAction{}
	a.viewer = trigger.Builder.GetViewer()
	a.builder = actions.NewMutationBuilder(
		a.viewer, ent.InsertOperation, &a.contact, &configs.ContactConfig{},
	)
	fields := trigger.Builder.GetFields()
	a.firstName = fields["FirstName"]
	a.lastName = fields["LastName"]
	a.emailAddress = fields["EmailAddress"]
	a.userID = trigger.Builder

	return actions.GetChangeset(a)
}

type UserCreateEventTrigger struct {
	UserMutationBuilderTrigger
}

func (trigger *UserCreateEventTrigger) GetChangeset() (ent.Changeset, error) {
	// It doesn't make any sense (from a data-model perspective) but let's create an event while creating a user
	action := eventCreateAction(
		trigger.Builder.GetViewer(),
	)
	// override this from the default provided by eventCreateAction and make the UserID dependent on this builder
	action.builder.OverrideRawField("user_id", trigger.Builder)

	return actions.GetChangeset(action)
}

type UserSendByeEmailObserver struct {
	UserMutationBuilderObserver
}

func (observer *UserSendByeEmailObserver) Observe() error {
	// dom't have strong typing here so need type assertion
	user := observer.Builder.ExistingEnt().(*models.User)

	emailHandler := &testingutils.SendEmailHandler{
		Text:  fmt.Sprintf("Hello %s, we're sad to see you go from our magical website", user.FirstName),
		Email: user.EmailAddress,
	}
	return emailHandler.SendEmail()
}

func getUserCreateBuilder(v viewer.ViewerContext, user *models.User) *actions.EntMutationBuilder {
	return actions.NewMutationBuilder(
		v,
		ent.InsertOperation,
		user,
		&configs.UserConfig{},
	)
}

func userCreateAction(
	v viewer.ViewerContext,
) *createUserAction {
	action := &createUserAction{}
	action.viewer = v
	action.builder = getUserCreateBuilder(v, &action.user)

	return action
}

func userEditAction(
	v viewer.ViewerContext,
	user *models.User,
) *editUserAction {
	action := &editUserAction{}
	b := actions.NewMutationBuilder(
		v,
		ent.EditOperation,
		&action.user,
		&configs.UserConfig{},
		actions.ExistingEnt(user),
	)
	action.existingEnt = *user
	action.viewer = v
	action.builder = b

	return action
}

func userDeleteAction(
	v viewer.ViewerContext,
	user *models.User,
) *deleteUserAction {
	action := &deleteUserAction{}
	b := actions.NewMutationBuilder(
		v,
		ent.DeleteOperation,
		&action.user,
		&configs.UserConfig{},
		actions.ExistingEnt(user),
	)
	action.existingEnt = *user
	action.viewer = v
	action.builder = b

	return action
}
