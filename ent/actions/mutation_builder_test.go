package actions_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	testhelpers "github.com/lolopinto/ent/internal/testschemautils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type mutationBuilderSuite struct {
	testingutils.Suite
}

func (suite *mutationBuilderSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"event_invited_edges",
		"events",
		"user_family_members_edges",
		"user_friends_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *mutationBuilderSuite) getBaseBuilder(
	operation ent.WriteOperation,
	config ent.Config,
	existingEnt ent.Entity,
) actions.EntMutationBuilder {
	v := viewertesting.OmniViewerContext{}
	return actions.EntMutationBuilder{
		Viewer:         v,
		EntConfig:      config,
		Operation:      operation,
		ExistingEntity: existingEnt,
	}
}

func (suite *mutationBuilderSuite) getUserBuilderWithFields(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
	fields map[string]interface{},
) actions.EntMutationBuilder {
	b := suite.getBaseBuilder(
		operation,
		&configs.UserConfig{},
		existingEnt,
	)
	suite.setFields(&b, fields)
	return b
}

func (suite *mutationBuilderSuite) getEventBuilderwithFields(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
	fields map[string]interface{},
) actions.EntMutationBuilder {
	b := suite.getBaseBuilder(
		operation,
		&configs.EventConfig{},
		existingEnt,
	)
	suite.setFields(&b, fields)
	return b
}

func (suite *mutationBuilderSuite) saveBuilder(b actions.EntMutationBuilder, entity ent.Entity) {
	c, err := b.GetChangeset(entity)
	assert.Nil(suite.T(), err)
	err = ent.SaveChangeset(c)
	assert.Nil(suite.T(), err)
}

func (suite *mutationBuilderSuite) saveUser(b actions.EntMutationBuilder) *models.User {
	var user models.User
	suite.saveBuilder(b, &user)
	return &user
}

func (suite *mutationBuilderSuite) saveEvent(b actions.EntMutationBuilder) *models.Event {
	var event models.Event
	suite.saveBuilder(b, &event)
	return &event
}

func (suite *mutationBuilderSuite) createUser(email string) *models.User {
	return suite.saveUser(suite.getDefaultUserBuilder(email))
}

func (suite *mutationBuilderSuite) getDefaultUserBuilder(email string) actions.EntMutationBuilder {
	return suite.getUserBuilderWithFields(
		ent.InsertOperation,
		nil,
		map[string]interface{}{
			"EmailAddress": email,
			"FirstName":    "Ola",
			"LastName":     "Okelola",
		},
	)
}

func (suite *mutationBuilderSuite) createEvent(user *models.User) *models.Event {
	b := suite.getEventBuilderwithFields(
		ent.InsertOperation,
		nil,
		getDefaultEventFields(user),
	)
	return suite.saveEvent(b)
}

func getDefaultEventFields(user *models.User) map[string]interface{} {
	return map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    user.ID,
		"StartTime": time.Now(),
		"EndTime":   time.Now(),
		"Location":  "fun location!",
	}
}

func (suite *mutationBuilderSuite) setFields(
	b *actions.EntMutationBuilder,
	fields map[string]interface{},
) {
	for k, v := range fields {
		b.SetField(k, v)
	}
}

func (suite *mutationBuilderSuite) TestCreation() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)

	testhelpers.VerifyUserObj(suite.T(), user, email)
}

func (suite *mutationBuilderSuite) TestEditing() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)

	testhelpers.VerifyUserObj(suite.T(), user, email)

	b := suite.getUserBuilderWithFields(
		ent.EditOperation,
		user,
		map[string]interface{}{
			"FirstName": "Ola2",
			"LastName":  "Okelola2",
		},
	)
	updatedUser := suite.saveUser(b)

	assert.Equal(suite.T(), updatedUser.EmailAddress, email)
	assert.Equal(suite.T(), updatedUser.FirstName, "Ola2")
	assert.Equal(suite.T(), updatedUser.LastName, "Okelola2")
	assert.Equal(suite.T(), user.ID, updatedUser.ID)
}

func (suite *mutationBuilderSuite) TestDeletion() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)

	testhelpers.VerifyUserObj(suite.T(), user, email)

	b := suite.getBaseBuilder(
		ent.DeleteOperation,
		&configs.UserConfig{},
		user,
	)
	updatedUser := suite.saveUser(b)

	assert.Zero(suite.T(), *updatedUser)

	var loadedUser models.User
	err := ent.LoadNodeRawData(user.ID, &loadedUser, &configs.UserConfig{})
	assert.NotNil(suite.T(), err)
	assert.Equal(suite.T(), err, sql.ErrNoRows)
	assert.Zero(suite.T(), loadedUser)
}

func (suite *mutationBuilderSuite) TestAddSimpleEdgeAtCreation() {
	user2 := suite.createUser(util.GenerateRandEmail())

	email := util.GenerateRandEmail()
	b := suite.getUserBuilderWithFields(
		ent.InsertOperation,
		nil,
		map[string]interface{}{
			"EmailAddress": email,
			"FirstName":    "Ola",
			"LastName":     "Okelola",
		},
	)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	user := suite.saveUser(b)

	testhelpers.VerifyUserObj(suite.T(), user, email)
	testhelpers.VerifyFamilyEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddSimpleEdgeEditing() {
	user2 := suite.createUser(util.GenerateRandEmail())

	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	testhelpers.VerifyUserObj(suite.T(), user, email)
	testhelpers.VerifyNoFamilyEdge(suite.T(), user, user2)

	// add edge
	b := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	updatedUser := suite.saveUser(b)

	testhelpers.VerifyUserObj(suite.T(), updatedUser, email)
	testhelpers.VerifyFamilyEdge(suite.T(), user, user2)

	// remove edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b2.RemoveOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	updatedUser2 := suite.saveUser(b2)
	testhelpers.VerifyUserObj(suite.T(), updatedUser2, email)
	testhelpers.VerifyNoFamilyEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddInverseEdge() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	event := suite.createEvent(user)

	testhelpers.VerifyUserObj(suite.T(), user, email)
	testhelpers.VerifyEventObj(suite.T(), event, user)
	testhelpers.VerifyNoInvitedToEventEdge(suite.T(), user, event)

	// add inverse edge
	b := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent := suite.saveEvent(b)

	testhelpers.VerifyEventObj(suite.T(), updatedEvent, user)
	testhelpers.VerifyInvitedToEventEdge(suite.T(), user, event)

	// remove edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b2.RemoveOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent2 := suite.saveEvent(b2)
	testhelpers.VerifyEventObj(suite.T(), updatedEvent2, user)
	testhelpers.VerifyNoInvitedToEventEdge(suite.T(), user, event)

	// we don't have user to event here but that should be in the generated action...
}

func (suite *mutationBuilderSuite) TestComplexMutation() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	testhelpers.VerifyUserObj(suite.T(), user, email)

	// create an event, add an inverse outbound edge and an inbound edge
	b := suite.getEventBuilderwithFields(
		ent.InsertOperation,
		nil,
		getDefaultEventFields(user),
	)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	event := suite.saveEvent(b)

	testhelpers.VerifyInvitedToEventEdge(suite.T(), user, event)
	testhelpers.VerifyUserToEventEdge(suite.T(), user, event)

	// delete event and edges
	b2 := suite.getEventBuilderwithFields(
		ent.DeleteOperation,
		event,
		make(map[string]interface{}),
	)
	b2.RemoveOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	b2.RemoveInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	event2 := suite.saveEvent(b2)

	assert.Zero(suite.T(), *event2)
	testhelpers.VerifyNoInvitedToEventEdge(suite.T(), user, event)
	testhelpers.VerifyNoUserToEventEdge(suite.T(), user, event)
}

func (suite *mutationBuilderSuite) TestAddSymmetricEdge() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	email2 := util.GenerateRandEmail()
	user2 := suite.createUser(email2)

	testhelpers.VerifyUserObj(suite.T(), user, email)
	testhelpers.VerifyUserObj(suite.T(), user2, email2)

	// add friends edge (symmetric edge)
	b := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b.AddOutboundEdge(models.UserToFriendsEdge, user2.ID, user2.GetType())
	updatedUser := suite.saveUser(b)
	testhelpers.VerifyUserObj(suite.T(), updatedUser, email)

	testhelpers.VerifyFriendsEdge(suite.T(), user, user2)

	// remove friends edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b2.RemoveOutboundEdge(models.UserToFriendsEdge, user2.ID, user2.GetType())
	updatedUser2 := suite.saveUser(b2)
	testhelpers.VerifyUserObj(suite.T(), updatedUser2, email)
	testhelpers.VerifyNoFriendsEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddInboudEdge() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	event := suite.createEvent(user)

	testhelpers.VerifyNoUserToEventEdge(suite.T(), user, event)
	testhelpers.VerifyUserObj(suite.T(), user, email)
	testhelpers.VerifyEventObj(suite.T(), event, user)

	// add edge
	b := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	updatedEvent := suite.saveEvent(b)

	testhelpers.VerifyEventObj(suite.T(), updatedEvent, user)
	testhelpers.VerifyUserToEventEdge(suite.T(), user, event)

	// remove edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b2.RemoveInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	updatedEvent2 := suite.saveEvent(b2)

	testhelpers.VerifyEventObj(suite.T(), updatedEvent2, user)
	testhelpers.VerifyNoUserToEventEdge(suite.T(), user, event)
}

func (suite *mutationBuilderSuite) TestPlaceholderID() {
	b := suite.getDefaultUserBuilder(util.GenerateRandEmail())
	user := suite.saveUser(b)

	b2 := suite.getDefaultUserBuilder(util.GenerateRandEmail())
	b2.AddOutboundEdge(models.UserToFamilyMembersEdge, user.ID, user.GetType())
	user2 := suite.saveUser(b2)

	testhelpers.VerifyFamilyEdge(suite.T(), user2, user)

	// different place holder ids, different user objects, placeholder ids get resolved
	assert.NotEqual(suite.T(), b.GetPlaceholderID(), b2.GetPlaceholderID())
	assert.NotEqual(suite.T(), user.GetID(), user2.GetID())
}

func TestMutationBuilder(t *testing.T) {
	suite.Run(t, new(mutationBuilderSuite))
}
