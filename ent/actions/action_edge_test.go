package actions_test

import (
	"database/sql"
	"testing"

	"github.com/lib/pq"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type actionEdgesSuite struct {
	testingutils.Suite
}

func (suite *actionEdgesSuite) SetupSuite() {
	suite.Tables = []string{
		"events",
		"event_creator_edges",
		"event_hosts_edges",
		"users",
	}
	suite.Suite.SetupSuite()
}

func (suite *actionEdgesSuite) TestUniqueEdges() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)

	event, err := action.Save()
	assert.Nil(suite.T(), err)

	verifyEventCreationState(suite.T(), event, user)

	// can't add new creator since unique edge.
	user2 := testingutils.CreateTestUser(suite.T())

	b := testingutils.GetEventBuilder(ent.EditOperation, event)
	b.AddOutboundEdge(models.EventToCreatorEdge, user2.GetID(), models.UserType)

	c, err := b.GetChangeset()
	assert.Nil(suite.T(), err)
	err = ent.SaveChangeset(c)
	assert.NotNil(suite.T(), err)
	assert.IsType(suite.T(), &pq.Error{}, err)

	pErr := err.(*pq.Error)
	// unique violation from https://www.postgresql.org/docs/9.3/errcodes-appendix.html
	assert.Equal(suite.T(), pq.ErrorCode("23505"), pErr.Code)

	// can modify or rewrite to the edge for the same id
	b2 := testingutils.GetEventBuilder(ent.EditOperation, event)
	b2.AddOutboundEdge(models.EventToCreatorEdge, user.GetID(), models.UserType, ent.EdgeData("creator!"))
	testingutils.SaveBuilder(suite.T(), b2)

	edge, err := ent.LoadEdgeByType(event.ID, user.ID, models.EventToCreatorEdge)
	assert.Nil(suite.T(), err)
	testingutils.VerifyEdge(suite.T(), &ent.AssocEdge{
		ID1:      event.GetID(),
		ID1Type:  event.GetType(),
		ID2:      user.GetID(),
		ID2Type:  user.GetType(),
		EdgeType: models.EventToCreatorEdge,
		Data: sql.NullString{
			String: "creator!",
			Valid:  true,
		},
	}, edge)
}

func TestActionEdges(t *testing.T) {
	suite.Run(t, new(actionEdgesSuite))
}
