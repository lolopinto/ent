package ent_test

import (
	"sync"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	entreflect "github.com/lolopinto/ent/internal/reflect"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type privacyTestSuite struct {
	testingutils.Suite
}

func (suite *privacyTestSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"events",
		"user_events_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *privacyTestSuite) TestGeneratedLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// use generated LoadUser method
		return models.LoadUser(v, id)
	})
}

func (suite *privacyTestSuite) TestManualLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// call the method manually based on public APIs
		var user models.User
		err := ent.LoadNode(v, id, &user, &configs.UserConfig{})
		return &user, err
	})
}

func (suite *privacyTestSuite) TestGeneratedGenLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// use generated GenLoadUser method
		var wg sync.WaitGroup
		var userResult models.UserResult
		wg.Add(1)
		go models.GenLoadUser(v, id, &userResult, &wg)
		wg.Wait()
		return userResult.User, userResult.Error
	})
}

func (suite *privacyTestSuite) TestManualGenLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// call the method manually based on public APIs
		var user models.User
		errChan := make(chan error)
		go ent.GenLoadNode(v, id, &user, &configs.UserConfig{}, errChan)
		err := <-errChan
		return &user, err
	})
}

func (suite *privacyTestSuite) TestWaitForMultiple() {
	dbUser := testingutils.CreateTestUser(suite.T())
	dbEvent := testingutils.CreateTestEvent(suite.T(), dbUser)

	var userResult models.UserResult
	var eventResult models.EventResult
	var wg sync.WaitGroup
	v := viewertesting.OmniViewerContext{}
	wg.Add(2)
	go models.GenLoadEvent(v, dbEvent.ID, &eventResult, &wg)
	go models.GenLoadUser(v, dbUser.ID, &userResult, &wg)
	wg.Wait()

	assert.Nil(suite.T(), userResult.Error)
	assert.Nil(suite.T(), eventResult.Error)

	assert.Equal(suite.T(), dbEvent.ID, eventResult.Event.ID)
	assert.Equal(suite.T(), dbUser.ID, userResult.User.ID)
}

func (suite *privacyTestSuite) TestLoadFieldEdges() {
	dbUser := testingutils.CreateTestUser(suite.T())
	dbEvent := testingutils.CreateTestEvent(suite.T(), dbUser)

	v := viewertesting.OmniViewerContext{}
	event, err := models.LoadEvent(v, dbEvent.ID)
	assert.Nil(suite.T(), err)

	user, err := event.LoadUser()
	assert.Nil(suite.T(), err)
	assert.Equal(suite.T(), dbUser.ID, user.ID)

	var userResult models.UserResult
	var wg sync.WaitGroup
	wg.Add(1)
	go event.GenUser(&userResult, &wg)
	wg.Wait()

	assert.Nil(suite.T(), userResult.Error)
	assert.Equal(suite.T(), dbUser.ID, user.ID)
}

func (suite *privacyTestSuite) TestAllowIfViewerCanSeeEntRule() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// let's create a privacy policy that only works if viewer can see user
		// if true, return user loaded from db
		// done in this format to reuse the omni, logged in user, logged out logic from testLoadNode
		err := ent.ApplyPrivacyPolicy(
			v,
			testingutils.AllowOneInlinePrivacyPolicy(
				models.AllowIfViewerCanSeeUserRule{UserID: id},
				nil,
			),
			nil,
		)
		var user models.User
		if err != nil {
			return &user, err
		}
		entreflect.SetViewerInEnt(v, &user)
		err = ent.LoadNodeRawData(id, &user, &configs.UserConfig{})
		return &user, err
	})
}

func TestPrivacySuite(t *testing.T) {
	suite.Run(t, new(privacyTestSuite))
}

func testLoadNode(suite *privacyTestSuite, f func(viewer.ViewerContext, string) (*models.User, error)) {
	dbUser := testingutils.CreateTestUser(suite.T())

	var testCases = []struct {
		viewer   viewer.ViewerContext
		visible  bool
		testCase string
	}{
		{
			viewertesting.OmniViewerContext{},
			true,
			"omni viewer",
		},
		{
			viewer.LoggedOutViewer(),
			false,
			"logged out viewer",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: dbUser.ID},
			true,
			"logged in viewer same as user",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: "1"},
			false,
			"logged in viewer different from user",
		},
	}

	for _, tt := range testCases {
		user, err := f(tt.viewer, dbUser.ID)
		if tt.visible {
			assert.Nil(suite.T(), err, tt.testCase)
			assert.NotZero(suite.T(), user, tt.testCase)
			assert.Equal(suite.T(), user.Viewer, tt.viewer, tt.testCase)
		} else {
			assert.Error(suite.T(), err, tt.testCase)
			assert.True(suite.T(), ent.IsPrivacyError(err), tt.testCase)
			assert.Zero(suite.T(), *user, tt.testCase)
		}
	}
}
