package testingutils

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/stretchr/testify/assert"
)

func VerifyUserObj(t *testing.T, user *models.User, email string) {
	assert.NotNil(t, user.GetViewer())
	assert.Equal(t, user.EmailAddress, email)
	assert.Equal(t, user.FirstName, "Ola")
	assert.Equal(t, user.LastName, "Okelola")
}

func VerifyEventObj(t *testing.T, event *models.Event, user *models.User) {
	assert.NotNil(t, user.GetViewer())
	assert.Equal(t, event.Name, "Fun event")
	assert.Equal(t, event.UserID, user.ID)
	assert.NotNil(t, event.StartTime)
	assert.Nil(t, event.EndTime)
	assert.Equal(t, event.Location, "fun location!")
}

func VerifyFamilyEdge(t *testing.T, user, user2 *models.User) {
	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user.ID,
		ID2:      user2.ID,
		EdgeType: models.UserToFamilyMembersEdge,
		ID1Type:  user.GetType(),
		ID2Type:  user.GetType(),
	}, edge)
}

func VerifyNoFamilyEdge(t *testing.T, user, user2 *models.User) {
	edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFamilyMembersEdge)
	assert.Nil(t, err)
	assert.Nil(t, edge)
}

func VerifyInvitedToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	invitedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToInvitedEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      event.ID,
		ID1Type:  event.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.EventToInvitedEdge,
	}, invitedEdge)

	userInvitedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToInvitedEventsEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToInvitedEventsEdge,
	}, userInvitedEdge)
}

func VerifyNoInvitedToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	invitedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToInvitedEdge)
	assert.Nil(t, err)
	assert.Nil(t, invitedEdge)
	userInvitedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToInvitedEventsEdge)
	assert.Nil(t, err)
	assert.Nil(t, userInvitedEdge)
}

func VerifyUserAttendingEventEdge(t *testing.T, user *models.User, event *models.Event) {
	attendingEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToAttendingEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      event.ID,
		ID1Type:  event.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.EventToAttendingEdge,
	}, attendingEdge)

	userAttendingEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsAttendingEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToEventsAttendingEdge,
	}, userAttendingEdge)
}

func VerifyNoUserAttendingEventEdge(t *testing.T, user *models.User, event *models.Event) {
	attendingEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToAttendingEdge)
	assert.Nil(t, err)
	assert.Nil(t, attendingEdge)
	userAttendingEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsAttendingEdge)
	assert.Nil(t, err)
	assert.Nil(t, userAttendingEdge)
}

func VerifyUserDeclinedEventEdge(t *testing.T, user *models.User, event *models.Event) {
	declinedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToDeclinedEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      event.ID,
		ID1Type:  event.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.EventToDeclinedEdge,
	}, declinedEdge)

	userDeclinedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToDeclinedEventsEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToDeclinedEventsEdge,
	}, userDeclinedEdge)
}

func VerifyNoUserDeclinedEventEdge(t *testing.T, user *models.User, event *models.Event) {
	declinedEdge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToDeclinedEdge)
	assert.Nil(t, err)
	assert.Nil(t, declinedEdge)
	userDeclinedEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToDeclinedEventsEdge)
	assert.Nil(t, err)
	assert.Zero(t, userDeclinedEdge)
}

func VerifyUserToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	userToEventEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      event.ID,
		ID2Type:  event.GetType(),
		EdgeType: models.UserToEventsEdge,
	}, userToEventEdge)
}

func VerifyNoUserToEventEdge(t *testing.T, user *models.User, event *models.Event) {
	userToEventEdge, err := ent.LoadEdgeByType(user.ID, event.ID, models.UserToEventsEdge)
	assert.Nil(t, err)
	assert.Nil(t, userToEventEdge)
}

func VerifyEventToHostEdge(t *testing.T, event *models.Event, user *models.User) {
	edge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToHostsEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      event.GetID(),
		ID1Type:  event.GetType(),
		ID2:      user.GetID(),
		ID2Type:  user.GetType(),
		EdgeType: models.EventToHostsEdge,
	}, edge)
}

func VerifyEventToCreatorEdge(t *testing.T, event *models.Event, user *models.User) {
	edge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToCreatorEdge)
	assert.Nil(t, err)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      event.GetID(),
		ID1Type:  event.GetType(),
		ID2:      user.GetID(),
		ID2Type:  user.GetType(),
		EdgeType: models.EventToCreatorEdge,
	}, edge)
}

func VerifyFriendsEdge(t *testing.T, user, user2 *models.User) {
	friends1Edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	friends2Edge, err := ent.LoadEdgeByType(user2.ID, user.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)

	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user.ID,
		ID1Type:  user.GetType(),
		ID2:      user2.ID,
		ID2Type:  user2.GetType(),
		EdgeType: models.UserToFriendsEdge,
	}, friends1Edge)
	VerifyEdge(t, &ent.AssocEdge{
		ID1:      user2.ID,
		ID1Type:  user2.GetType(),
		ID2:      user.ID,
		ID2Type:  user.GetType(),
		EdgeType: models.UserToFriendsEdge,
	}, friends2Edge)
}

func VerifyNoFriendsEdge(t *testing.T, user, user2 *models.User) {
	friends1Edge, err := ent.LoadEdgeByType(user.ID, user2.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	friends2Edge, err := ent.LoadEdgeByType(user2.ID, user.ID, models.UserToFriendsEdge)
	assert.Nil(t, err)
	assert.Nil(t, friends1Edge)
	assert.Nil(t, friends2Edge)
}

func VerifyEdge(t *testing.T, expectedEdge, edge *ent.AssocEdge) {
	assert.Equal(t, expectedEdge.EdgeType, edge.EdgeType)
	assert.Equal(t, expectedEdge.ID1, edge.ID1)
	assert.Equal(t, expectedEdge.ID2, edge.ID2)
	assert.Equal(t, expectedEdge.ID1Type, edge.ID1Type)
	assert.Equal(t, expectedEdge.ID2Type, edge.ID2Type)
	assert.Equal(t, expectedEdge.Data, edge.Data)
	assert.NotNil(t, edge.Time)
}
