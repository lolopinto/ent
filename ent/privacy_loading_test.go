package ent

import (
	"testing"

	"github.com/lolopinto/ent/config"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gopkg.in/khaiql/dbcleaner.v2"
	"gopkg.in/khaiql/dbcleaner.v2/engine"
)

type privacyTestSuite struct {
	suite.Suite
	cleaner dbcleaner.DbCleaner
}

func (suite *privacyTestSuite) SetupSuite() {
	suite.cleaner = dbcleaner.New()
	postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	suite.cleaner.SetEngine(postgres)
}

func (suite *privacyTestSuite) SetupTest() {
	suite.cleaner.Acquire("users")
}

func (suite *privacyTestSuite) TearDownTest() {
	suite.cleaner.Clean("users")
}

func (suite *privacyTestSuite) TestLoadNode() {
	dbUser := createTestUser(suite.T())

	var testCases = []struct {
		viewer   viewer.ViewerContext
		visible  bool
		testCase string
	}{
		{
			omniViewerContext{},
			true,
			"logged in viewer",
		},
		{
			viewer.LoggedOutViewer(),
			false,
			"logged out viewer",
		},
		{
			loggedinViewerContext{viewerID: dbUser.ID},
			true,
			"logged in viewer same as user",
		},
		{
			loggedinViewerContext{viewerID: "1"},
			false,
			"logged in viewer different from user",
		},
	}

	for _, tt := range testCases {
		var user testUser

		err := LoadNode(tt.viewer, dbUser.ID, &user, &testUserConfig{})

		if tt.visible {
			assert.Nil(suite.T(), err)
			assert.NotZero(suite.T(), user)
			assert.Equal(suite.T(), user.Viewer, tt.viewer)
		} else {
			assert.Error(suite.T(), err)
			assert.True(suite.T(), IsPrivacyError(err))
			assert.Zero(suite.T(), user)
		}
	}
}

func TestPrivacySuite(t *testing.T) {
	suite.Run(t, new(privacyTestSuite))
}
