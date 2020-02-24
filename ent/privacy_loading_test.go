package ent_test

import (
	"context"
	"net/http"
	"sort"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/sql"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func (suite *privacyTestSuite) TestGeneratedGenLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// use generated GenLoadUser method
		userResult := <-models.GenLoadUser(v, id)
		return userResult.User, userResult.Err
	})
}

func (suite *privacyTestSuite) TestManualLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// call the method manually based on public APIs
		loader := models.NewUserLoader(v)
		err := ent.LoadNode(v, id, loader)
		return loader.GetEntForID(id), err
	})
}

func (suite *privacyTestSuite) TestManualGenLoadNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		// call the method manually based on public APIs
		loader := models.NewUserLoader(v)
		err := <-ent.GenLoadNode(v, id, loader)
		return loader.GetEntForID(id), err
	})
}

func (suite *privacyTestSuite) TestGeneratedLoadContextNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		req, err := http.NewRequest("GET", "bar", nil)
		require.NoError(suite.T(), err)

		ctx := viewer.NewRequestWithContext(req, v).Context()
		return models.LoadUserFromContext(ctx, id)
	})
}

func (suite *privacyTestSuite) TestGeneratedGenLoadContextNode() {
	testLoadNode(suite, func(v viewer.ViewerContext, id string) (*models.User, error) {
		req, err := http.NewRequest("GET", "bar", nil)
		require.NoError(suite.T(), err)

		ctx := viewer.NewRequestWithContext(req, v).Context()
		// use generated GenLoadUserFromContext method
		userResult := <-models.GenLoadUserFromContext(ctx, id)
		return userResult.User, userResult.Err
	})
}

func (suite *privacyTestSuite) TestGeneratedGenLoadContextNoViewer() {
	dbUser := testingutils.CreateTestUser(suite.T())

	userResult := <-models.GenLoadUserFromContext(context.TODO(), dbUser.GetID())
	require.Error(suite.T(), userResult.Err)
}

func (suite *privacyTestSuite) TestViewerMismatch() {
	dbUser := testingutils.CreateTestUser(suite.T())
	dbUser2 := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: dbUser.ID}
	v2 := viewertesting.LoggedinViewerContext{ViewerID: dbUser2.ID}

	loader := models.NewUserLoader(v2)

	err := ent.LoadNode(v, dbUser.ID, loader)
	assert.NotNil(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "viewer mismatch")
}

func (suite *privacyTestSuite) TestWaitForMultiple() {
	dbUser := testingutils.CreateTestUser(suite.T())
	dbEvent := testingutils.CreateTestEvent(suite.T(), dbUser)

	v := viewertesting.OmniViewerContext{}
	eventResult, userResult := <-models.GenLoadEvent(v, dbEvent.ID), <-models.GenLoadUser(v, dbUser.ID)

	require.Nil(suite.T(), userResult.Err)
	require.Nil(suite.T(), eventResult.Err)
	require.NotNil(suite.T(), userResult)
	require.NotNil(suite.T(), eventResult)

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

	userResult := <-event.GenUser()

	assert.Nil(suite.T(), userResult.Err)
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
			),
			nil,
		)
		if err != nil {
			return nil, err
		}
		// 🤦🏿‍♂️figure out what this test buys us again...
		loader := models.NewUserLoader(v)
		data, err := ent.LoadNodeRawData(id, loader)
		if err != nil {
			return nil, err
		}
		user := loader.GetNewInstance()
		for key, fn := range user.DBFields() {
			if err := fn(data[key]); err != nil {
				return nil, err
			}
		}
		return user.(*models.User), err
	})
}

func (suite *privacyTestSuite) TestManualLoadForeignKeyNodes() {
	testLoadForeignKeyNodes(suite, func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
		loader := models.NewContactLoader(v)
		err := ent.LoadNodesViaQueryClause(v, loader, sql.Eq("user_id", id))
		return loader.List(), err
	})
}

func (suite *privacyTestSuite) TestManualGenLoadForeignKeyNodes() {
	testLoadForeignKeyNodes(suite, func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
		loader := models.NewContactLoader(v)
		err := <-ent.GenLoadNodesViaQueryClause(v, loader, sql.Eq("user_id", id))
		return loader.List(), err
	})
}

func (suite *privacyTestSuite) TestGeneratedForeignKeyNodes() {
	user := testingutils.CreateTestUser(suite.T())
	contact := testingutils.CreateTestContact(suite.T(), user)
	contact2 := testingutils.CreateTestContact(suite.T(), user)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	reloadedUser, err := models.LoadUser(v, user.ID)
	require.Nil(suite.T(), err)

	verifyLoadedForeignKeyNodes(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
			return reloadedUser.LoadContacts()
		},
		[]string{
			contact.ID,
			contact2.ID,
		},
		"generated synchronous API",
	)
}

func (suite *privacyTestSuite) TestGeneratedGenForeignKeyNodes() {
	user := testingutils.CreateTestUser(suite.T())
	contact := testingutils.CreateTestContact(suite.T(), user)
	contact2 := testingutils.CreateTestContact(suite.T(), user)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	reloadedUser, err := models.LoadUser(v, user.ID)
	require.Nil(suite.T(), err)
	verifyLoadedForeignKeyNodes(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
			result := <-reloadedUser.GenContacts()
			return result.Contacts, result.Err
		},
		[]string{
			contact.ID,
			contact2.ID,
		},
		"generated asynchronous API",
	)
}

func (suite *privacyTestSuite) TestLoadNodesByType() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		loader := models.NewEventLoader(v)
		err := ent.LoadNodesByType(v, id, models.UserToEventsEdge, loader)
		return loader.List(), err
	})
}

func (suite *privacyTestSuite) TestGenLoadNodesByType() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		loader := models.NewEventLoader(v)
		err := <-ent.GenLoadNodesByType(v, id, models.UserToEventsEdge, loader)
		return loader.List(), err
	})
}

func (suite *privacyTestSuite) TestLoadNodes() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		loader := models.NewEventLoader(v)
		err := ent.LoadNodes(v, suite.getID2sForEdge(id, models.UserToEventsEdge), loader)
		return loader.List(), err
	})
}

func (suite *privacyTestSuite) TestGenLoadNodes() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		loader := models.NewEventLoader(v)
		err := <-ent.GenLoadNodes(v, suite.getID2sForEdge(id, models.UserToEventsEdge), loader)
		return loader.List(), err
	})
}

func (suite *privacyTestSuite) TestGeneratedLoadNodes() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		return models.LoadEvents(v, suite.getID2sForEdge(id, models.UserToEventsEdge)...)
	})
}

func (suite *privacyTestSuite) TestGeneratedGenLoadNodes() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		res := <-models.GenLoadEvents(v, suite.getID2sForEdge(id, models.UserToEventsEdge)...)
		return res.Events, res.Err
	})
}

func (suite *privacyTestSuite) getID2sForEdge(id string, edge ent.EdgeType) []string {
	edges, err := ent.LoadEdgesByType(id, edge)
	require.Nil(suite.T(), err)
	ids := make([]string, len(edges))
	for idx, edge := range edges {
		ids[idx] = edge.ID2
	}
	return ids
}

func (suite *privacyTestSuite) TestGeneratedLoadNodesByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	reloadedUser, err := models.LoadUser(v, user.ID)
	require.Nil(suite.T(), err)

	verifyLoadedNodesByType(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
			return reloadedUser.LoadEvents()
		},
		[]string{
			event.ID,
			event2.ID,
		},
		"generated loaded nodes",
	)
}

func (suite *privacyTestSuite) TestGeneratedGenLoadNodesByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	reloadedUser, err := models.LoadUser(v, user.ID)
	require.Nil(suite.T(), err)

	verifyLoadedNodesByType(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
			result := <-reloadedUser.GenEvents()
			return result.Events, result.Err
		},
		[]string{
			event.ID,
			event2.ID,
		},
		"generated loaded nodes",
	)
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
			assert.Equal(suite.T(), user.GetViewer(), tt.viewer, tt.testCase)
		} else {
			assert.Error(suite.T(), err, tt.testCase)
			assert.True(suite.T(), ent.IsPrivacyError(err), tt.testCase)
			assert.Nil(suite.T(), user, tt.testCase)
		}
	}
}

func testLoadForeignKeyNodes(suite *privacyTestSuite, f func(viewer.ViewerContext, string) ([]*models.Contact, error)) {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	user3 := testingutils.CreateTestUser(suite.T())
	user4 := testingutils.CreateTestUser(suite.T())

	// only owner can see this contact
	contact := testingutils.CreateTestContact(suite.T(), user)

	// owner and user2 can see this contact
	contact2 := testingutils.CreateTestContact(suite.T(), user, user2)

	// owner, user2, and user3 can see this contact
	contact3 := testingutils.CreateTestContact(suite.T(), user, user2, user3)

	var testCases = []struct {
		viewer    viewer.ViewerContext
		loadedIds []string
		testCase  string
	}{
		{
			viewertesting.OmniViewerContext{},
			[]string{
				contact.ID,
				contact2.ID,
				contact3.ID,
			},
			"omni viewer",
		},
		{
			viewer.LoggedOutViewer(),
			[]string{},
			"logged out viewer",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user.ID},
			[]string{
				contact.ID,
				contact2.ID,
				contact3.ID,
			},
			"viewer who owns contacts",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
			[]string{
				contact2.ID,
				contact3.ID,
			},
			"viewer who has access to 2 contacts",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user3.ID},
			[]string{
				contact3.ID,
			},
			"viewer who has access to 1 contact",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user4.ID},
			[]string{},
			"viewer who has access to no contacts",
		},
	}

	for _, tt := range testCases {
		verifyLoadedForeignKeyNodes(
			suite,
			tt.viewer,
			user.ID,
			f,
			tt.loadedIds,
			tt.testCase,
		)
	}
}

func verifyLoadedForeignKeyNodes(
	suite *privacyTestSuite,
	v viewer.ViewerContext,
	id string,
	f func(viewer.ViewerContext, string) ([]*models.Contact, error),
	expectedIds []string,
	testCase string,
) {
	contacts, err := f(v, id)
	verifyLoadedMultiNodes(
		suite,
		v,
		id,
		func() []string {
			actualIds := []string{}
			for _, contact := range contacts {
				assert.NotZero(suite.T(), contact, testCase)
				assert.Equal(suite.T(), contact.GetViewer(), v, testCase)
				assert.Equal(suite.T(), id, contact.UserID, testCase)
				actualIds = append(actualIds, contact.ID)
			}
			return actualIds
		},
		err,
		expectedIds,
		testCase,
	)
}

func verifyLoadedNodesByType(
	suite *privacyTestSuite,
	v viewer.ViewerContext,
	id string,
	f func(viewer.ViewerContext, string) ([]*models.Event, error),
	expectedIds []string,
	testCase string,
) {
	events, err := f(v, id)

	verifyLoadedMultiNodes(
		suite,
		v,
		id,
		func() []string {
			actualIds := []string{}
			for _, event := range events {
				assert.NotZero(suite.T(), event, testCase)
				assert.Equal(suite.T(), event.GetViewer(), v, testCase)
				assert.Equal(suite.T(), id, event.UserID, testCase)
				actualIds = append(actualIds, event.ID)
			}
			return actualIds
		},
		err,
		expectedIds,
		testCase,
	)
}

func verifyLoadedMultiNodes(
	suite *privacyTestSuite,
	v viewer.ViewerContext,
	id string,
	buildIds func() []string,
	err error,
	expectedIds []string,
	testCase string,
) {
	suite.T().Run(testCase, func(t *testing.T) {
		assert.Nil(t, err)
		actualIds := buildIds()
		assert.Equal(t, len(actualIds), len(expectedIds))

		sort.Strings(expectedIds)
		sort.Strings(actualIds)
		assert.Equal(t, expectedIds, actualIds)
	})
}

func testLoadNodesByType(suite *privacyTestSuite, f func(v viewer.ViewerContext, id string) ([]*models.Event, error)) {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	user3 := testingutils.CreateTestUser(suite.T())
	user4 := testingutils.CreateTestUser(suite.T())

	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user, user2)
	event3 := testingutils.CreateTestEvent(suite.T(), user, user2, user3)

	var testCases = []struct {
		viewer    viewer.ViewerContext
		loadedIds []string
		testCase  string
	}{
		{
			viewertesting.OmniViewerContext{},
			[]string{
				event.ID,
				event2.ID,
				event3.ID,
			},
			"omni viewer",
		},
		{
			viewer.LoggedOutViewer(),
			[]string{},
			"logged out viewer",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user.ID},
			[]string{
				event.ID,
				event2.ID,
				event3.ID,
			},
			"viewer who owns events",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
			[]string{
				event2.ID,
				event3.ID,
			},
			"viewer who was invited to 2 events",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user3.ID},
			[]string{
				event3.ID,
			},
			"viewer who was invited to 1 event",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user4.ID},
			[]string{},
			"viewer who was invited to no event",
		},
	}

	for _, tt := range testCases {
		verifyLoadedNodesByType(
			suite,
			tt.viewer,
			user.ID,
			f,
			tt.loadedIds,
			tt.testCase,
		)
	}
}
