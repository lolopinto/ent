package actions_test

import (
	"fmt"
	"testing"

	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/logutil"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type actionsObserversSuite struct {
	testingutils.Suite
}

func (suite *actionsObserversSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"events",
		"event_creator_edges",
		"event_hosts_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *actionsObserversSuite) TestSimpleObserver() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)

	event, err := action.Save()
	assert.Nil(suite.T(), err)

	verifyEventCreationState(suite.T(), event, user)

	testingutils.AssertEntLogged(suite.T(), event)
}

func (suite *actionsObserversSuite) TestObserverReturnsError() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	// capture log
	l := logutil.CaptureLogger{}
	l.Capture()
	defer l.Reset()
	action := userDeleteAction(v, user)
	err := actions.Save(action)
	require.Nil(suite.T(), err)

	testingutils.AssertEmailSent(suite.T(), user.EmailAddress, fmt.Sprintf("Hello %s, we're sad to see you go from our magical website", user.FirstName))

	// assert that microservice error was logged
	// and that email was still sent and action was successful despite an error in an observer
	assert.True(suite.T(), l.Contains("error from observer: microservice down"))

	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), reloadedUser)
	assert.NotNil(suite.T(), err)
}

func TestActionObservers(t *testing.T) {
	suite.Run(t, new(actionsObserversSuite))
}
