package actions_test

import (
	"testing"

	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type actionsPermissionsSuite struct {
	testingutils.Suite
}

func (suite *actionsPermissionsSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"contacts",
		"event_creator_edges",
	}
	suite.Suite.SetupSuite()
}

func createUser(v viewer.ViewerContext) (*createUserAction, error) {
	action := userCreateAction(v)
	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = util.GenerateRandEmail()
	action.password = util.GenerateRandPassword()

	err := actions.Save(action)
	return action, err
}

func (suite *actionsPermissionsSuite) TestCreatePrivacy() {
	var testCases = []struct {
		viewer   viewer.ViewerContext
		allowed  bool
		testCase string
	}{
		{
			viewertesting.OmniViewerContext{},
			true,
			"omni viewer context",
		},
		{
			viewertesting.LoggedinViewerContext{},
			true,
			"logged in viewer context",
		},
		{
			viewer.LoggedOutViewer(),
			true,
			"logged out viewer context",
		},
	}

	for _, tt := range testCases {
		action, err := createUser(tt.viewer)
		if tt.allowed {
			assert.Nil(suite.T(), err)
			assert.NotZero(suite.T(), action.user)
		} else {
			assert.NotNil(suite.T(), err)
			assert.Zero(suite.T(), action.user)
		}
	}
}

func (suite *actionsPermissionsSuite) TestEditPrivacy() {
	action, err := createUser(viewer.LoggedOutViewer())
	assert.Nil(suite.T(), err)
	user := action.user
	assert.NotZero(suite.T(), user)

	var testCases = []struct {
		viewer   viewer.ViewerContext
		allowed  bool
		testCase string
	}{
		{
			viewertesting.OmniViewerContext{},
			false,
			"omni viewer context",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user.ID},
			true,
			"logged in viewer context with user",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: "1"},
			false,
			"logged in viewer context with different user",
		},
		{
			viewer.LoggedOutViewer(),
			false,
			"logged out viewer context",
		},
	}

	for _, tt := range testCases {
		action := userEditAction(tt.viewer, &user)
		action.firstName = "Ola2"
		err := actions.Save(action)
		if tt.allowed {
			assert.Nil(suite.T(), err, tt.testCase)
			assert.NotZero(suite.T(), action.user, tt.testCase)
			assert.Equal(suite.T(), "Ola2", action.user.FirstName, tt.testCase)
		} else {
			assert.NotNil(suite.T(), err, tt.testCase)
			assert.IsType(suite.T(), &actions.ActionPermissionsError{}, err, tt.testCase)
			assert.Zero(suite.T(), action.user, tt.testCase)
		}
	}
}

func TestActionPermissions(t *testing.T) {
	suite.Run(t, new(actionsPermissionsSuite))
}
