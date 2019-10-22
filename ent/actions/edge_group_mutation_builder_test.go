package actions_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"

	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/suite"
)

type edgeGroupMutationBuilderSuite struct {
	testingutils.Suite
}

func (suite *edgeGroupMutationBuilderSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"event_invited_edges",
		"events",
		"user_family_members_edges",
		"user_friends_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *edgeGroupMutationBuilderSuite) TestEdgeGroupBuilder() {
	user := testingutils.CreateUser(suite.T(), util.GenerateRandEmail())
	event := testingutils.CreateEvent(suite.T(), user)

	// add invited edge
	b := testingutils.GetBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event)
	b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	updatedEvent := testingutils.SaveEvent(suite.T(), b)

	testingutils.VerifyEventObj(suite.T(), updatedEvent, user)
	testingutils.VerifyInvitedToEventEdge(suite.T(), user, event)

	// add attending edge
	b2 := &actions.EdgeGroupMutationBuilder{
		EntMutationBuilder: *testingutils.GetBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event),
	}
	b2.SetEnumValue("EVENT_ATTENDING")
	b2.SetIDValue(user.GetID(), user.GetType())
	b2.SetStatusMap(event.RsvpStatusMap())
	testingutils.SaveEvent(suite.T(), b2)

	testingutils.VerifyUserAttendingEventEdge(suite.T(), user, event)
	testingutils.VerifyNoUserDeclinedEventEdge(suite.T(), user, event)
	testingutils.VerifyInvitedToEventEdge(suite.T(), user, event)

	// add declined edge
	b3 := &actions.EdgeGroupMutationBuilder{
		EntMutationBuilder: *testingutils.GetBaseBuilder(ent.EditOperation, &configs.EventConfig{}, event),
	}
	b3.SetEnumValue("EVENT_DECLINED")
	b3.SetIDValue(user.GetID(), user.GetType())
	b3.SetStatusMap(event.RsvpStatusMap())
	testingutils.SaveEvent(suite.T(), b3)

	// adding declined, removes attending.
	// user is still invited.
	testingutils.VerifyUserDeclinedEventEdge(suite.T(), user, event)
	testingutils.VerifyNoUserAttendingEventEdge(suite.T(), user, event)
	testingutils.VerifyInvitedToEventEdge(suite.T(), user, event)
}

func TestEdgeGroupMutationBuilder(t *testing.T) {
	suite.Run(t, new(edgeGroupMutationBuilderSuite))
}
