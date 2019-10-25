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
	b := testingutils.GetBaseBuilder(
		ent.InsertOperation,
		&configs.ContactConfig{},
		nil,
	)
	fields := trigger.Builder.GetFields()
	b.SetField("FirstName", fields["FirstName"])
	b.SetField("LastName", fields["LastName"])
	b.SetField("EmailAddress", fields["EmailAddress"])
	// this should be GetMutationID() or soemthing which is better and hides this
	//	b.SetField("UserID")
	b.SetField("UserID", trigger.Builder)
	//	spew.Dump("trigger builder", trigger.Builder)

	var contact models.Contact
	// set fieldmap.
	// all this will be handled better by action
	b.FieldMap = getFieldMapFromFields(b.Operation, b.GetFields())

	return b.GetChangeset(&contact)
}

func userCreateAction(
	viewer viewer.ViewerContext,
) *createUserAction {
	b := &actions.EntMutationBuilder{
		Viewer:         viewer,
		ExistingEntity: nil,
		Operation:      ent.InsertOperation,
		EntConfig:      &configs.UserConfig{},
	}
	action := &createUserAction{}
	action.viewer = viewer
	action.builder = b

	return action
}

func userEditAction(
	viewer viewer.ViewerContext,
	user *models.User,
) *editUserAction {
	b := &actions.EntMutationBuilder{
		Viewer:         viewer,
		ExistingEntity: user,
		Operation:      ent.EditOperation,
		EntConfig:      &configs.UserConfig{},
	}
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
