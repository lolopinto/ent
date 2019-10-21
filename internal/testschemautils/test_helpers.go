package testschemautils

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/stretchr/testify/assert"
)

func VerifyUserObj(t *testing.T, user *models.User, email string) {
	// TODO we need to set viewer in response of new API
	//assert.NotNil(suite.T(), user.Viewer)
	assert.Equal(t, user.EmailAddress, email)
	assert.Equal(t, user.FirstName, "Ola")
	assert.Equal(t, user.LastName, "Okelola")
}

func VerifyEventObj(t *testing.T, event *models.Event, user *models.User) {
	// TODO we need to set viewer in response of new API
	//assert.NotNil(suite.T(), event.Viewer)
	assert.Equal(t, event.Name, "Fun event")
	assert.Equal(t, event.UserID, user.ID)
	assert.NotNil(t, event.StartTime)
	assert.NotNil(t, event.EndTime)
	assert.Equal(t, event.Location, "fun location!")
}

func VerifyFamilyEdge(t *testing.T, user, user2 *models.User) {
	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID2:      user2.ID,
		EdgeType: models.UserToFamilyMembersEdge,
		ID1Type:  user.GetType(),
		ID2Type:  user.GetType(),
		Data:     "",
	}, edge)
}

func VerifyNoFamilyEdge(t *testing.T, user, user2 *models.User) {
	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(t, err)
	assert.Zero(t, *edge)
}

func VerifyInvitedToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	invitedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToInvitedEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.Edge{
		ID1:      event.ID,
		ID1Type:  event.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.EventToInvitedEdge,
		Data:     "",
	}, invitedEdge)

	userInvitedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToInvitedEventsEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToInvitedEventsEdge,
		Data:     "",
	}, userInvitedEdge)
}

func VerifyNoInvitedToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	invitedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToInvitedEdge)
	assert.Nil(t, err)
	assert.Zero(t, *invitedEdge)
	userInvitedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToInvitedEventsEdge)
	assert.Nil(t, err)
	assert.Zero(t, *userInvitedEdge)
}

func VerifyUserToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	userToEventEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToEventsEdge,
		Data:     "",
	}, userToEventEdge)
}

func VerifyNoUserToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	userToEventEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsEdge)
	assert.Nil(t, err)
	assert.Zero(t, *userToEventEdge)
}

func VerifyFriendsEdge(t *testing.T, user, user2 *models.User) {
	friends1Edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	friends2Edge, err := ent.LoadEdgeByType(user2.ID, user.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)

	VerifyEdge(t, &ent.Edge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      user2.ID,
		ID2Type:  user2.GetType(),
		EdgeType: models.UserToFriendsEdge,
		Data:     "",
	}, friends1Edge)
	VerifyEdge(t, &ent.Edge{
		ID1:      user2.ID,
		ID1Type:  user2.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.UserToFriendsEdge,
		Data:     "",
	}, friends2Edge)
}

func VerifyNoFriendsEdge(t *testing.T, user, user2 *models.User) {
	friends1Edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	friends2Edge, err := ent.LoadEdgeByType(user2.ID, user.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	assert.Zero(t, *friends1Edge)
	assert.Zero(t, *friends2Edge)
}

func VerifyEdge(t *testing.T, expectedEdge, edge *ent.Edge) {
	assert.Equal(t, expectedEdge.EdgeType, edge.EdgeType)
	assert.Equal(t, expectedEdge.ID1, edge.ID1)
	assert.Equal(t, expectedEdge.ID2, edge.ID2)
	assert.Equal(t, expectedEdge.ID1Type, edge.ID1Type)
	assert.Equal(t, expectedEdge.ID2Type, edge.ID2Type)
	assert.Equal(t, expectedEdge.Data, edge.Data)
	assert.NotNil(t, edge.Time)
}
