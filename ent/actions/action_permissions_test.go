package actions_test

import (
	"testing"

	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	var err error
	action.password, err = util.GenerateRandPassword()
	if err != nil {
		return nil, err
	}

	err = actions.Save(action)
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
			assert.NotZero(suite.T(), action.GetUser())
		} else {
			assert.NotNil(suite.T(), err)
			assert.Nil(suite.T(), action.GetUser())
		}
	}
}

func (suite *actionsPermissionsSuite) TestEditPrivacy() {
	action, err := createUser(viewer.LoggedOutViewer())
	assert.Nil(suite.T(), err)
	user := action.GetUser()
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
		suite.T().Run(tt.testCase, func(t *testing.T) {
			action := userEditAction(tt.viewer, user)
			action.firstName = "Ola2"
			user, err := action.Save()
			if tt.allowed {
				assert.Nil(t, err)
				require.NotNil(t, user)
				assert.Equal(t, "Ola2", user.FirstName)
			} else {
				assert.NotNil(t, err)
				assert.IsType(t, &actions.ActionPermissionsError{}, err)
				assert.Nil(t, user)
			}
		})
	}
}

func TestActionPermissions(t *testing.T) {
	suite.Run(t, new(actionsPermissionsSuite))
}
