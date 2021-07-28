package actions_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		"event_creator_edges",
		"user_family_members_edges",
		"user_friends_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *mutationBuilderSuite) TestCreation() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)

	testingutils.VerifyUserObj(suite.T(), user, email)
}

func (suite *mutationBuilderSuite) TestEditing() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)

	testingutils.VerifyUserObj(suite.T(), user, email)

	b := testingutils.GetUserBuilderWithFields(
		ent.EditOperation,
		user,
		map[string]interface{}{
			"first_name": "Ola2",
			"last_name":  "Okelola2",
		},
	)
	updatedUser := testingutils.SaveUser(suite.T(), b)

	assert.Equal(suite.T(), updatedUser.EmailAddress, email)
	assert.Equal(suite.T(), updatedUser.FirstName, "Ola2")
	assert.Equal(suite.T(), updatedUser.LastName, "Okelola2")
	assert.Equal(suite.T(), user.ID, updatedUser.ID)
}

func (suite *mutationBuilderSuite) TestDeletion() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)

	testingutils.VerifyUserObj(suite.T(), user, email)

	b := testingutils.GetUserBuilder(
		ent.DeleteOperation,
		user,
	)
	updatedUser := testingutils.SaveUser(suite.T(), b)

	assert.Nil(suite.T(), updatedUser)

	userData, err := ent.LoadNodeRawData(user.ID, models.NewUserLoader(b.Viewer))
	assert.NotNil(suite.T(), err)
	assert.Equal(suite.T(), err, sql.ErrNoRows)
	assert.Nil(suite.T(), userData)
}

func (suite *mutationBuilderSuite) TestAddSimpleEdgeAtCreation() {
	user2 := testingutils.CreateTestUserWithEmail(suite.T(), util.GenerateRandEmail())

	email := util.GenerateRandEmail()
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	b := testingutils.GetUserBuilderWithFields(
		ent.InsertOperation,
		nil,
		map[string]interface{}{
			"email_address": email,
			"password":      pwd,
			"first_name":    "Ola",
			"last_name":     "Okelola",
		},
	)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	user := testingutils.SaveUser(suite.T(), b)

	testingutils.VerifyUserObj(suite.T(), user, email)
	testingutils.VerifyFamilyEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddSimpleEdgeEditing() {
	user2 := testingutils.CreateTestUserWithEmail(suite.T(), util.GenerateRandEmail())

	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)
	testingutils.VerifyUserObj(suite.T(), user, email)
	testingutils.VerifyNoFamilyEdge(suite.T(), user, user2)

	// add edge
	b := testingutils.GetUserBuilder(ent.EditOperation, user)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	updatedUser := testingutils.SaveUser(suite.T(), b)

	testingutils.VerifyUserObj(suite.T(), updatedUser, email)
	testingutils.VerifyFamilyEdge(suite.T(), user, user2)

	// remove edge
	b2 := testingutils.GetUserBuilder(ent.EditOperation, user)
	b2.RemoveOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	updatedUser2 := testingutils.SaveUser(suite.T(), b2)
	testingutils.VerifyUserObj(suite.T(), updatedUser2, email)
	testingutils.VerifyNoFamilyEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestAddInverseEdge() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)
	event := testingutils.CreateTestEvent(suite.T(), user)

	testingutils.VerifyUserObj(suite.T(), user, email)
	testingutils.VerifyEventObj(suite.T(), event, user)
	testingutils.VerifyNoInvitedToEventEdge(suite.T(), user, event)

	// added automatically by CreateTestEvent since that'll be added by the generated builder
	testingutils.VerifyUserToEventEdge(suite.T(), user, event)

	// add inverse edge
	b := testingutils.GetEventBuilder(ent.EditOperation, event)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent := testingutils.SaveEvent(suite.T(), b)

	testingutils.VerifyEventObj(suite.T(), updatedEvent, user)
	testingutils.VerifyInvitedToEventEdge(suite.T(), user, event)

	// remove edge
	b2 := testingutils.GetEventBuilder(ent.EditOperation, event)
	b2.RemoveOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent2 := testingutils.SaveEvent(suite.T(), b2)
	testingutils.VerifyEventObj(suite.T(), updatedEvent2, user)
	testingutils.VerifyNoInvitedToEventEdge(suite.T(), user, event)
}

func (suite *mutationBuilderSuite) TestComplexMutation() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)
	testingutils.VerifyUserObj(suite.T(), user, email)

	// create an event, add an inverse outbound edge and an inbound edge
	b := testingutils.GetEventBuilderwithFields(
		ent.InsertOperation,
		nil,
		testingutils.GetDefaultEventFields(user),
	)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	event := testingutils.SaveEvent(suite.T(), b)

	testingutils.VerifyInvitedToEventEdge(suite.T(), user, event)
	testingutils.VerifyUserToEventEdge(suite.T(), user, event)

	// delete event and edges
	b2 := testingutils.GetEventBuilderwithFields(
		ent.DeleteOperation,
		event,
		make(map[string]interface{}),
	)
	b2.RemoveOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	b2.RemoveInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	event2 := testingutils.SaveEvent(suite.T(), b2)

	assert.Nil(suite.T(), event2)
	testingutils.VerifyNoInvitedToEventEdge(suite.T(), user, event)
	testingutils.VerifyNoUserToEventEdge(suite.T(), user, event)
}

func (suite *mutationBuilderSuite) TestAddSymmetricEdge() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)
	email2 := util.GenerateRandEmail()
	user2 := testingutils.CreateTestUserWithEmail(suite.T(), email2)

	testingutils.VerifyUserObj(suite.T(), user, email)
	testingutils.VerifyUserObj(suite.T(), user2, email2)

	// add friends edge (symmetric edge)
	b := testingutils.GetUserBuilder(ent.EditOperation, user)
	b.AddOutboundEdge(models.UserToFriendsEdge, user2.ID, user2.GetType())
	updatedUser := testingutils.SaveUser(suite.T(), b)
	testingutils.VerifyUserObj(suite.T(), updatedUser, email)

	testingutils.VerifyFriendsEdge(suite.T(), user, user2)

	// remove friends edge
	b2 := testingutils.GetUserBuilder(ent.EditOperation, user)
	b2.RemoveOutboundEdge(models.UserToFriendsEdge, user2.ID, user2.GetType())
	updatedUser2 := testingutils.SaveUser(suite.T(), b2)
	testingutils.VerifyUserObj(suite.T(), updatedUser2, email)
	testingutils.VerifyNoFriendsEdge(suite.T(), user, user2)
}

func (suite *mutationBuilderSuite) TestInboudEdge() {
	email := util.GenerateRandEmail()
	user := testingutils.CreateTestUserWithEmail(suite.T(), email)
	event := testingutils.CreateTestEvent(suite.T(), user)

	// edge automatically added by CreateTestEvent
	testingutils.VerifyUserToEventEdge(suite.T(), user, event)
	testingutils.VerifyUserObj(suite.T(), user, email)
	testingutils.VerifyEventObj(suite.T(), event, user)

	// remove edge
	b2 := testingutils.GetEventBuilder(ent.EditOperation, event)
	b2.RemoveInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	updatedEvent2 := testingutils.SaveEvent(suite.T(), b2)

	testingutils.VerifyEventObj(suite.T(), updatedEvent2, user)
	testingutils.VerifyNoUserToEventEdge(suite.T(), user, event)
}

func (suite *mutationBuilderSuite) TestPlaceholderID() {
	b := testingutils.GetDefaultUserBuilder(util.GenerateRandEmail())
	user := testingutils.SaveUser(suite.T(), b)

	b2 := testingutils.GetDefaultUserBuilder(util.GenerateRandEmail())
	b2.AddOutboundEdge(models.UserToFamilyMembersEdge, user.ID, user.GetType())
	user2 := testingutils.SaveUser(suite.T(), b2)

	testingutils.VerifyFamilyEdge(suite.T(), user2, user)

	// different place holder ids, different user objects, placeholder ids get resolved
	assert.NotEqual(suite.T(), b.GetPlaceholderID(), b2.GetPlaceholderID())
	assert.NotEqual(suite.T(), user.GetID(), user2.GetID())
}

func (suite *mutationBuilderSuite) TestManualDataField() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())

	b := testingutils.GetUserBuilderWithFields(
		ent.EditOperation,
		user,
		map[string]interface{}{},
	)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType(), ent.EdgeData("brother"))
	testingutils.SaveUser(suite.T(), b)

	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(suite.T(), err)
	testingutils.VerifyEdge(suite.T(), &ent.AssocEdge{
		ID1:      user.ID,
		ID2:      user2.ID,
		EdgeType: models.UserToFamilyMembersEdge,
		ID1Type:  user.GetType(),
		ID2Type:  user.GetType(),
		Data: sql.NullString{
			String: "brother",
			Valid:  true,
		},
	}, edge)
}

func (suite *mutationBuilderSuite) TestManualTimeField() {
	t := time.Now()

	var testCases = map[string]struct {
		t time.Time
		f func(*ent.EdgeOperation)
	}{
		"future": {
			t.Add(3 * time.Hour), // time in the future
			ent.EdgeTime(t.Add(3 * time.Hour)),
		},
		"past": {
			t.Add(-3 * time.Hour), // time in the past
			ent.EdgeTime(t.Add(-3 * time.Hour)),
		},
		"raw number": {
			time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC).Add(1 * time.Second),
			ent.EdgeTimeRawNumber(1),
		},
	}
	for key, tt := range testCases {

		suite.T().Run(key, func(t *testing.T) {
			user := testingutils.CreateTestUser(suite.T())
			user2 := testingutils.CreateTestUser(suite.T())

			b := testingutils.GetUserBuilderWithFields(
				ent.EditOperation,
				user,
				map[string]interface{}{},
			)
			b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType(), tt.f)
			testingutils.SaveUser(t, b)

			edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
			assert.Nil(t, err)
			testingutils.VerifyEdge(t, &ent.AssocEdge{
				ID1:      user.ID,
				ID2:      user2.ID,
				EdgeType: models.UserToFamilyMembersEdge,
				ID1Type:  user.GetType(),
				ID2Type:  user.GetType(),
				Time:     tt.t,
			}, edge)
		})

	}
}

func TestMutationBuilder(t *testing.T) {
	suite.Run(t, new(mutationBuilderSuite))
}
