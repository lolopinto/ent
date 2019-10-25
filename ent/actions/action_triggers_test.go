package actions_test

import (
	"errors"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type eventAction struct {
	viewer  viewer.ViewerContext
	event   models.Event
	builder *actions.EntMutationBuilder
}

func (a *eventAction) GetViewer() viewer.ViewerContext {
	return a.viewer
}

func (a *eventAction) Entity() ent.Entity {
	return &a.event
}

func (a *eventAction) getChangeset(operation ent.WriteOperation, existingEnt ent.Entity) (ent.Changeset, error) {
	a.builder.FieldMap = getFieldMapFromFields(a.builder.Operation, a.builder.GetFields())
	return a.builder.GetChangeset(&a.event)
}

type createEventAction struct {
	eventAction
}

func eventCreateAction(
	viewer viewer.ViewerContext,
) *createEventAction {
	b := &actions.EntMutationBuilder{
		Viewer:         viewer,
		ExistingEntity: nil,
		Operation:      ent.InsertOperation,
		EntConfig:      &configs.EventConfig{},
	}
	action := createEventAction{}
	action.viewer = viewer
	fields := testingutils.GetDefaultEventFieldsUserID(viewer.GetViewerID())
	for k, v := range fields {
		b.SetField(k, v)
	}
	action.builder = b

	return &action
}

// this will be auto-generated for actions
// We need to do this because of how go's type system works
func (a *createEventAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	// hmm
	a.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(EventTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(a.builder)
	}
	return nil
}

func (a *createEventAction) GetChangeset() (ent.Changeset, error) {
	return a.getChangeset(ent.InsertOperation, nil)
}

func (a *createEventAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&EventSetViewerAsHostTrigger{},
		&EventSetViewerAsCreatorTrigger{},
	}
}

type EventTrigger interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type EventMutationBuilderTrigger struct {
	Builder *actions.EntMutationBuilder
}

func (trigger *EventMutationBuilderTrigger) SetBuilder(b *actions.EntMutationBuilder) {
	trigger.Builder = b
}

type EventSetViewerAsHostTrigger struct {
	EventMutationBuilderTrigger
}

func (trigger *EventSetViewerAsHostTrigger) GetChangeset() (ent.Changeset, error) {
	trigger.Builder.AddOutboundEdge(
		models.EventToHostsEdge,
		trigger.Builder.Viewer.GetViewerID(),
		models.UserType,
	)
	return nil, nil
}

type EventSetViewerAsCreatorTrigger struct {
	EventMutationBuilderTrigger
}

func (trigger *EventSetViewerAsCreatorTrigger) GetChangeset() (ent.Changeset, error) {
	trigger.Builder.AddOutboundEdge(
		models.EventToCreatorEdge,
		trigger.Builder.Viewer.GetViewerID(),
		models.UserType,
	)
	return nil, nil
}

var _ actions.ActionWithTriggers = &createEventAction{}

type actionsTriggersSuite struct {
	testingutils.Suite
}

func (suite *actionsTriggersSuite) SetupSuite() {
	suite.Tables = []string{
		"events",
		"event_creator_edges",
		"event_hosts_edges",
		"users",
		"contacts",
	}
	suite.Suite.SetupSuite()
}

func (suite *actionsTriggersSuite) TestAddEdgesInCreationTrigger() {
	user := testingutils.CreateTestUser(suite.T())
	testingutils.VerifyUserObj(suite.T(), user, user.EmailAddress)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)

	err := actions.Save(action)
	assert.Nil(suite.T(), err)

	testingutils.VerifyEventObj(suite.T(), &action.event, user)
	testingutils.VerifyEventToHostEdge(suite.T(), &action.event, user)
	testingutils.VerifyEventToCreatorEdge(suite.T(), &action.event, user)
}

func (suite *actionsTriggersSuite) TestCreateDependentObjectInTrigger() {
	action := userCreateAction(viewer.LoggedOutViewer())
	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = util.GenerateRandEmail()
	err := actions.Save(action)
	assert.Nil(suite.T(), err)

	user := &action.user

	spew.Dump(user)
	testingutils.VerifyUserObj(suite.T(), &action.user, user.EmailAddress)

	// reload user
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)

	contacts, err := reloadedUser.LoadContacts()
	assert.Nil(suite.T(), err)
	spew.Dump(contacts)
	assert.Len(suite.T(), contacts, 1)
	assert.Equal(suite.T(), contacts[0].UserID, reloadedUser.ID)
}

func TestActionTriggers(t *testing.T) {
	suite.Run(t, new(actionsTriggersSuite))
}
