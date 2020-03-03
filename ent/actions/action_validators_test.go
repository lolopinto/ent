package actions_test

import (
	"testing"
	"time"

	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type actionsValidatorsSuite struct {
	testingutils.Suite
}

func (suite *actionsValidatorsSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"events",
		"event_creator_edges",
		"event_hosts_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *actionsValidatorsSuite) TestWithValidEndTime() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)
	// in the future end time is valid
	action.builder.OverrideRawField("end_time", time.Now().Add(1*time.Hour))

	event, err := action.Save()
	assert.Nil(suite.T(), err)

	assert.NotNil(suite.T(), event.EndTime)

	testingutils.AssertEntLogged(suite.T(), event)
}

func (suite *actionsValidatorsSuite) TestWithInValidEndTime() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)
	// in the past
	action.builder.OverrideRawField("end_time", time.Now().Add(-1*time.Hour))

	err := actions.Save(action)
	assert.Error(suite.T(), err)
}

func (suite *actionsValidatorsSuite) TestWithInValidEndTimeValidate() {
	suite.T().Skip("need to change Validate in EntMutationBuilder")
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)
	// in the past
	action.builder.OverrideRawField("end_time", time.Now().Add(-1*time.Hour))

	err := action.Validate()
	assert.Error(suite.T(), err)
}

func TestActionValidators(t *testing.T) {
	suite.Run(t, new(actionsValidatorsSuite))
}
