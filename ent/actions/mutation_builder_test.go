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
	b := suite.getUserBuilderWithFields(
		ent.InsertOperation,
		nil,
		map[string]interface{}{
			"EmailAddress": email,
			"FirstName":    "Ola",
			"LastName":     "Okelola",
		},
	)
	return suite.saveUser(b)
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

	verifyUserObj(suite.T(), user, email)
}

func (suite *mutationBuilderSuite) TestEditing() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)

	verifyUserObj(suite.T(), user, email)

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

	verifyUserObj(suite.T(), user, email)

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

	verifyUserObj(suite.T(), user, email)
	verifyFamilyEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddSimpleEdgeEditing() {
	user2 := suite.createUser(util.GenerateRandEmail())

	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	verifyUserObj(suite.T(), user, email)
	verifyNoFamilyEdge(suite.T(), user, user2)

	// add edge
	b := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	updatedUser := suite.saveUser(b)

	verifyUserObj(suite.T(), updatedUser, email)
	verifyFamilyEdge(suite.T(), user, user2)

	// remove edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b2.RemoveOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	updatedUser2 := suite.saveUser(b2)
	verifyUserObj(suite.T(), updatedUser2, email)
	verifyNoFamilyEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddInverseEdge() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	event := suite.createEvent(user)

	verifyUserObj(suite.T(), user, email)
	verifyEventObj(suite.T(), event, user)
	verifyNoInvitedToEventEdge(suite.T(), user, event)

	// add inverse edge
	b := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent := suite.saveEvent(b)

	verifyEventObj(suite.T(), updatedEvent, user)
	verifyInvitedToEventEdge(suite.T(), user, event)

	// remove edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b2.RemoveOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent2 := suite.saveEvent(b2)
	verifyEventObj(suite.T(), updatedEvent2, user)
	verifyNoInvitedToEventEdge(suite.T(), user, event)

	// we don't have user to event here but that should be in the generated action...
}

func (suite *mutationBuilderSuite) TestComplexMutation() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	verifyUserObj(suite.T(), user, email)

	// create an event, add an inverse outbound edge and an inbound edge
	b := suite.getEventBuilderwithFields(
		ent.InsertOperation,
		nil,
		getDefaultEventFields(user),
	)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	event := suite.saveEvent(b)

	verifyInvitedToEventEdge(suite.T(), user, event)
	verifyUserToEventEdge(suite.T(), user, event)

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
	verifyNoInvitedToEventEdge(suite.T(), user, event)
	verifyNoUserToEventEdge(suite.T(), user, event)
}

func (suite *mutationBuilderSuite) TestAddSymmetricEdge() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	email2 := util.GenerateRandEmail()
	user2 := suite.createUser(email2)

	verifyUserObj(suite.T(), user, email)
	verifyUserObj(suite.T(), user2, email2)

	// add friends edge (symmetric edge)
	b := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b.AddOutboundEdge(models.UserToFriendsEdge, user2.ID, user2.GetType())
	updatedUser := suite.saveUser(b)
	verifyUserObj(suite.T(), updatedUser, email)

	verifyFriendsEdge(suite.T(), user, user2)

	// remove friends edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.UserConfig{}, user)
	b2.RemoveOutboundEdge(models.UserToFriendsEdge, user2.ID, user2.GetType())
	updatedUser2 := suite.saveUser(b2)
	verifyUserObj(suite.T(), updatedUser2, email)
	verifyNoFriendsEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddInboudEdge() {
	email := util.GenerateRandEmail()
	user := suite.createUser(email)
	event := suite.createEvent(user)

	verifyNoUserToEventEdge(suite.T(), user, event)
	verifyUserObj(suite.T(), user, email)
	verifyEventObj(suite.T(), event, user)

	// add edge
	b := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	updatedEvent := suite.saveEvent(b)

	verifyEventObj(suite.T(), updatedEvent, user)
	verifyUserToEventEdge(suite.T(), user, event)

	// remove edge
	b2 := suite.getBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b2.RemoveInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	updatedEvent2 := suite.saveEvent(b2)

	verifyEventObj(suite.T(), updatedEvent2, user)
	verifyNoUserToEventEdge(suite.T(), user, event)
}

func verifyUserObj(t *testing.T, user *models.User, email string) {
	// TODO we need to set viewer in response of new API
	//assert.NotNil(suite.T(), user.Viewer)
	assert.Equal(t, user.EmailAddress, email)
	assert.Equal(t, user.FirstName, "Ola")
	assert.Equal(t, user.LastName, "Okelola")
}

func verifyEventObj(t *testing.T, event *models.Event, user *models.User) {
	// TODO we need to set viewer in response of new API
	//assert.NotNil(suite.T(), event.Viewer)
	assert.Equal(t, event.Name, "Fun event")
	assert.Equal(t, event.UserID, user.ID)
	assert.NotNil(t, event.StartTime)
	assert.NotNil(t, event.EndTime)
	assert.Equal(t, event.Location, "fun location!")
}

func verifyFamilyEdge(t *testing.T, user, user2 *models.User) {
	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(t, err)
	verifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID2:      user2.ID,
		EdgeType: models.UserToFamilyMembersEdge,
		ID1Type:  user.GetType(),
		ID2Type:  user.GetType(),
		Data:     "",
	}, edge)
}

func verifyNoFamilyEdge(t *testing.T, user, user2 *models.User) {
	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(t, err)
	assert.Zero(t, *edge)
}

func verifyInvitedToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	invitedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToInvitedEdge)
	assert.Nil(t, err)
	verifyEdge(t, &ent.Edge{
		ID1:      event.ID,
		ID1Type:  event.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.EventToInvitedEdge,
		Data:     "",
	}, invitedEdge)

	userInvitedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToInvitedEventsEdge)
	assert.Nil(t, err)
	verifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToInvitedEventsEdge,
		Data:     "",
	}, userInvitedEdge)
}

func verifyNoInvitedToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	invitedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToInvitedEdge)
	assert.Nil(t, err)
	assert.Zero(t, *invitedEdge)
	userInvitedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToInvitedEventsEdge)
	assert.Nil(t, err)
	assert.Zero(t, *userInvitedEdge)
}

func verifyUserToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	userToEventEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsEdge)
	assert.Nil(t, err)
	verifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToEventsEdge,
		Data:     "",
	}, userToEventEdge)
}

func verifyNoUserToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	userToEventEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsEdge)
	assert.Nil(t, err)
	assert.Zero(t, *userToEventEdge)
}

func verifyFriendsEdge(t *testing.T, user, user2 *models.User) {
	friends1Edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	friends2Edge, err := ent.LoadEdgeByType(user2.ID, user.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)

	verifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      user2.ID,
		ID2Type:  user2.GetType(),
		EdgeType: models.UserToFriendsEdge,
		Data:     "",
	}, friends1Edge)
	verifyEdge(t, &ent.Edge{
		ID1:      user2.ID,
		ID1Type:  user2.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.UserToFriendsEdge,
		Data:     "",
	}, friends2Edge)
}

func verifyNoFriendsEdge(t *testing.T, user, user2 *models.User) {
	friends1Edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	friends2Edge, err := ent.LoadEdgeByType(user2.ID, user.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	assert.Zero(t, *friends1Edge)
	assert.Zero(t, *friends2Edge)
}

func verifyEdge(t *testing.T, expectedEdge, edge *ent.Edge) {
	assert.Equal(t, expectedEdge.EdgeType, edge.EdgeType)
	assert.Equal(t, expectedEdge.ID1, edge.ID1)
	assert.Equal(t, expectedEdge.ID2, edge.ID2)
	assert.Equal(t, expectedEdge.ID1Type, edge.ID1Type)
	assert.Equal(t, expectedEdge.ID2Type, edge.ID2Type)
	assert.Equal(t, expectedEdge.Data, edge.Data)
	assert.NotNil(t, edge.Time)
}

func TestMutationBuilder(t *testing.T) {
	suite.Run(t, new(mutationBuilderSuite))
}
