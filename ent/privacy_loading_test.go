package ent_test

import (
	"sort"
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

func (suite *privacyTestSuite) TestManualLoadForeignKeyNodes() {
	testLoadForeignKeyNodes(suite, func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
		var contacts []*models.Contact
		err := ent.LoadForeignKeyNodes(v, id, &contacts, "user_id", &configs.ContactConfig{})
		return contacts, err
	})
}

func (suite *privacyTestSuite) TestManualGenLoadForeignKeyNodes() {
	testLoadForeignKeyNodes(suite, func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
		var contacts []*models.Contact
		chanErr := make(chan error)
		go ent.GenLoadForeignKeyNodes(v, id, &contacts, "user_id", &configs.ContactConfig{}, chanErr)
		err := <-chanErr
		return contacts, err
	})
}

func (suite *privacyTestSuite) TestGeneratedForeignKeyNodes() {
	user := testingutils.CreateTestUser(suite.T())
	contact := testingutils.CreateTestContact(suite.T(), user)
	contact2 := testingutils.CreateTestContact(suite.T(), user)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	entreflect.SetViewerInEnt(v, user)
	verifyLoadedForeignKeyNodes(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
			return user.LoadContacts()
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

	entreflect.SetViewerInEnt(v, user)
	verifyLoadedForeignKeyNodes(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Contact, error) {
			var wg sync.WaitGroup
			var result models.ContactsResult
			wg.Add(1)
			go user.GenContacts(&result, &wg)
			wg.Wait()
			return result.Contacts, result.Error
		},
		[]string{
			contact.ID,
			contact2.ID,
		},
		"generated synchronous API",
	)
}

func (suite *privacyTestSuite) TestLoadNodesByType() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		var events []*models.Event
		err := ent.LoadNodesByType(v, id, models.UserToEventsEdge, &events, &configs.EventConfig{})
		return events, err
	})
}

func (suite *privacyTestSuite) TestGenLoadNodesByType() {
	testLoadNodesByType(suite, func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
		var events []*models.Event
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(v, id, models.UserToEventsEdge, &events, &configs.EventConfig{}, chanErr)
		err := <-chanErr
		return events, err
	})
}

func (suite *privacyTestSuite) TestGeneratedLoadNodesByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	entreflect.SetViewerInEnt(v, user)

	verifyLoadedNodesByType(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
			return user.LoadEvents()
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

	entreflect.SetViewerInEnt(v, user)

	verifyLoadedNodesByType(
		suite,
		v,
		user.ID,
		func(v viewer.ViewerContext, id string) ([]*models.Event, error) {
			var wg sync.WaitGroup
			var result models.EventsResult
			wg.Add(1)
			go user.GenEvents(&result, &wg)
			wg.Wait()
			return result.Events, result.Error
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
			assert.Equal(suite.T(), user.Viewer, tt.viewer, tt.testCase)
		} else {
			assert.Error(suite.T(), err, tt.testCase)
			assert.True(suite.T(), ent.IsPrivacyError(err), tt.testCase)
			assert.Zero(suite.T(), *user, tt.testCase)
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
				assert.Equal(suite.T(), contact.Viewer, v, testCase)
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
				assert.Equal(suite.T(), event.Viewer, v, testCase)
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
	assert.Nil(suite.T(), err, testCase)
	actualIds := buildIds()
	assert.Equal(suite.T(), len(actualIds), len(expectedIds), testCase)

	sort.Strings(expectedIds)
	sort.Strings(actualIds)
	assert.Equal(suite.T(), expectedIds, actualIds, testCase)
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
