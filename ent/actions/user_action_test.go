package actions_test

import (
	"errors"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
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

func (a *userAction) getChangeset(operation ent.WriteOperation, existingEnt ent.Entity) (ent.Changeset, error) {
	for k, v := range a.getFields() {
		a.builder.SetField(k, v)
	}
	a.builder.FieldMap = getFieldMapFromFields(a.builder.Operation, a.getFields())
	return a.builder.GetChangeset(&a.user)
}

type createUserAction struct {
	userAction
}

func (a *createUserAction) GetChangeset() (ent.Changeset, error) {
	return a.getChangeset(ent.InsertOperation, nil)
}

func (a *createUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			privacy.AlwaysAllowRule{},
		),
		&a.user,
	}
}

var _ actions.ActionWithPermissions = &createUserAction{}

type editUserAction struct {
	userAction
	existingEnt models.User
}

func (a *editUserAction) GetChangeset() (ent.Changeset, error) {
	return a.getChangeset(ent.EditOperation, &a.existingEnt)
}

func (a *editUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			privacy.AllowIfViewerIsOwnerRule{a.existingEnt.ID},
			privacy.AlwaysDenyRule{},
		),
		&a.user,
	}
}

var _ actions.ActionWithPermissions = &editUserAction{}

// this will be auto-generated for actions
// We need to do this because of how go's type system works
func (a *createUserAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
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
		//		&UserCreateContactTrigger{},
		&UserCreateContactAndEmailTrigger{},
	}
}

type UserTrigger interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type UserMutationBuilderTrigger struct {
	Builder *actions.EntMutationBuilder
}

func (trigger *UserMutationBuilderTrigger) SetBuilder(b *actions.EntMutationBuilder) {
	trigger.Builder = b
}

type UserCreateContactTrigger struct {
	UserMutationBuilderTrigger
}

func (trigger *UserCreateContactTrigger) GetChangeset() (ent.Changeset, error) {
	// create a contact action and send changeset
	a := &createContactAction{}
	a.viewer = trigger.Builder.GetViewer()
	a.builder = actions.NewMutationBuilder(
		a.viewer, ent.InsertOperation, &configs.ContactConfig{},
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
		a.viewer, ent.InsertOperation, &configs.ContactConfig{},
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
	action.builder.SetField("UserID", trigger.Builder)

	// this isn't right. action.GetChangeset() which is autogenerated should call actions.GetChangeset() instead of everyone having to do this...
	return actions.GetChangeset(action)
}

func getUserCreateBuilder(viewer viewer.ViewerContext) *actions.EntMutationBuilder {
	return actions.NewMutationBuilder(
		viewer,
		ent.InsertOperation,
		&configs.UserConfig{},
	)
}

func userCreateAction(
	viewer viewer.ViewerContext,
) *createUserAction {
	action := &createUserAction{}
	action.viewer = viewer
	action.builder = getUserCreateBuilder(viewer)

	return action
}

func userEditAction(
	viewer viewer.ViewerContext,
	user *models.User,
) *editUserAction {
	b := actions.NewMutationBuilder(
		viewer,
		ent.EditOperation,
		&configs.UserConfig{},
		actions.ExistingEnt(user),
	)
	action := &editUserAction{}
	action.existingEnt = *user
	action.viewer = viewer
	action.builder = b

	return action
}

func getFieldMapFromFields(op ent.WriteOperation, fields map[string]interface{}) ent.MutationFieldMap {
	// copied from testingutils/ent.go
	ret := make(ent.MutationFieldMap)
	for k := range fields {
		ret[k] = &ent.MutatingFieldInfo{
			DB:       strcase.ToSnake(k),
			Required: op == ent.InsertOperation,
		}
	}
	return ret
}
