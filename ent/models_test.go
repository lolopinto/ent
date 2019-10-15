package ent_test

import (
	"database/sql"
	"sync"

	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
)

type modelsTestSuite struct {
	testingutils.Suite
}

func (suite *modelsTestSuite) SetupSuite() {
	// TODO make this automatic based on db
	suite.Tables = []string{
		"users",
		"events",
		"user_events_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *modelsTestSuite) TestLoadNodeFromParts() {
	user := testingutils.CreateTestUser(suite.T())

	var testCases = []struct {
		parts       []interface{}
		foundResult bool
	}{
		{
			[]interface{}{
				"first_name",
				"Ola",
			},
			true,
		},
		{
			[]interface{}{
				"first_name",
				"Ola",
				"last_name",
				"Okelola",
			},
			true,
		},
		{
			[]interface{}{
				"email_address",
				user.EmailAddress,
				"last_name",
				"Okelola",
			},
			true,
		},
		{
			[]interface{}{
				"email_address",
				"Okelola",
			},
			false,
		},
	}

	for _, tt := range testCases {
		var existingUser models.User
		err := ent.LoadNodeFromParts(&existingUser, &configs.UserConfig{}, tt.parts...)
		if tt.foundResult {
			assert.Nil(suite.T(), err)
			assert.NotZero(suite.T(), existingUser)
		} else {
			assert.NotNil(suite.T(), err)
			assert.Equal(suite.T(), err, sql.ErrNoRows)
			assert.Zero(suite.T(), existingUser)
		}
	}
}

func (suite *modelsTestSuite) TestLoadNodeFromID() {
	user := testingutils.CreateTestUser(suite.T())

	var testCases = []struct {
		id          string
		foundResult bool
	}{
		{
			user.ID,
			true,
		},
		{
			uuid.New().String(),
			false,
		},
	}

	for _, tt := range testCases {
		var existingUser models.User
		err := ent.LoadNodeRawData(tt.id, &existingUser, &configs.UserConfig{})
		if tt.foundResult {
			assert.Nil(suite.T(), err)
			assert.NotZero(suite.T(), existingUser)
		} else {
			assert.NotNil(suite.T(), err)
			assert.Equal(suite.T(), err, sql.ErrNoRows)
			assert.Zero(suite.T(), existingUser)
		}
	}
}

func (suite *modelsTestSuite) TestGetEdgeInfo() {
	var testCases = []struct {
		edgeType    ent.EdgeType
		foundResult bool
	}{
		{
			models.UserToEventsEdge,
			true,
		},
		{
			ent.EdgeType(uuid.New().String()),
			false,
		},
	}

	for _, tt := range testCases {
		edgeData, err := ent.GetEdgeInfo(tt.edgeType, nil)
		if tt.foundResult {
			assert.Nil(suite.T(), err)
			assert.NotZero(suite.T(), edgeData)
		} else {
			assert.NotNil(suite.T(), err)
			assert.Equal(suite.T(), err, sql.ErrNoRows)
			assert.Zero(suite.T(), *edgeData)
		}
	}
}

func (suite *modelsTestSuite) TestLoadEdgesByType() {
	testLoadEdgesByType(suite, func(id string) ([]*ent.Edge, error) {
		return ent.LoadEdgesByType(id, models.UserToEventsEdge)
	})
}

func (suite *modelsTestSuite) TestGenLoadEdgesByType() {
	testLoadEdgesByType(suite, func(id string) ([]*ent.Edge, error) {
		chanResult := make(chan ent.EdgesResult)
		go ent.GenLoadEdgesByType(id, models.UserToEventsEdge, chanResult)
		result := <-chanResult
		return result.Edges, result.Error
	})
}

func (suite *modelsTestSuite) TestGeneratedLoadEdgesByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)

	verifyEdges(
		suite,
		func() ([]*ent.Edge, error) {
			v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

			user, err := models.LoadUser(v, user.ID)
			util.Die(err)
			return user.LoadEventsEdges()
		},
		[]string{
			event.ID,
			event2.ID,
		},
		true,
	)
}

func (suite *modelsTestSuite) TestGeneratedGenLoadEdgesByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)

	verifyEdges(
		suite,
		func() ([]*ent.Edge, error) {
			v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
			user, err := models.LoadUser(v, user.ID)
			util.Die(err)

			var result ent.EdgesResult
			var wg sync.WaitGroup
			wg.Add(1)
			go user.GenEventsEdges(&result, &wg)
			wg.Wait()
			return result.Edges, result.Error
		},
		[]string{
			event.ID,
			event2.ID,
		},
		true,
	)
}

func testLoadEdgesByType(suite *modelsTestSuite, f func(id string) ([]*ent.Edge, error)) {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)

	var testCases = []struct {
		id1         string
		foundResult bool
	}{
		{
			user.ID,
			true,
		},
		{
			event.ID,
			false,
		},
		{
			"",
			false,
		},
	}

	for _, tt := range testCases {
		verifyEdges(
			suite,
			func() ([]*ent.Edge, error) {
				return f(tt.id1)
			},
			[]string{event.ID, event2.ID},
			tt.foundResult,
		)
	}
}

func verifyEdges(
	suite *modelsTestSuite,
	f func() ([]*ent.Edge, error),
	expectedIds []string,
	foundResult bool,
) {
	edges, err := f()
	assert.Nil(suite.T(), err)
	if foundResult {
		assert.NotEmpty(suite.T(), edges)

		assert.Len(suite.T(), edges, len(expectedIds))
		for _, edge := range edges {
			assert.NotZero(suite.T(), edge)
			assert.Contains(suite.T(), expectedIds, edge.ID2)
		}
	} else {
		assert.Len(suite.T(), edges, 0)
		assert.Empty(suite.T(), edges)
	}
}

func (suite *modelsTestSuite) TestLoadEdgeByType() {
	testLoadEdgeByType(suite, func(id1, id2 string) (*ent.Edge, error) {
		return ent.LoadEdgeByType(id1, id2, models.UserToEventsEdge)
	})
}

func (suite *modelsTestSuite) TestGenLoadEdgeByType() {
	testLoadEdgeByType(suite, func(id1, id2 string) (*ent.Edge, error) {
		chanResult := make(chan ent.EdgeResult)
		go ent.GenLoadEdgeByType(id1, id2, models.UserToEventsEdge, chanResult)
		result := <-chanResult
		return result.Edge, result.Error
	})
}

func (suite *modelsTestSuite) TestGeneratedLoadEdgeByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	verifyEdgeByType(
		suite,
		func() (*ent.Edge, error) {
			v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

			user, err := models.LoadUser(v, user.ID)
			util.Die(err)
			return user.LoadEventsEdgeFor(event.ID)
		},
		user.ID,
		event.ID,
	)
}

func (suite *modelsTestSuite) TestGeneratedGenLoadEdgeByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	verifyEdgeByType(
		suite,
		func() (*ent.Edge, error) {
			v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

			user, err := models.LoadUser(v, user.ID)
			util.Die(err)

			var wg sync.WaitGroup
			var result ent.EdgeResult
			wg.Add(1)
			go user.GenLoadEventsEdgeFor(event.ID, &result, &wg)
			wg.Wait()
			return result.Edge, result.Error
		},
		user.ID,
		event.ID,
	)
}

func (suite *modelsTestSuite) TestInvalidLoadEdgeByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	edge, err := ent.LoadEdgeByType(event.ID, user.ID, models.UserToEventsEdge)
	assert.Nil(suite.T(), err)
	assert.Zero(suite.T(), *edge)
}

func (suite *modelsTestSuite) TestLoadEdgeByTypeEmptyID1() {
	user := testingutils.CreateTestUser(suite.T())
	edge, err := ent.LoadEdgeByType("", user.ID, models.UserToEventsEdge)
	assert.Nil(suite.T(), err)
	assert.Zero(suite.T(), *edge)
}

func (suite *modelsTestSuite) TestLoadEdgeByTypeEmptyID2() {
	user := testingutils.CreateTestUser(suite.T())
	edge, err := ent.LoadEdgeByType(user.ID, "", models.UserToEventsEdge)
	assert.Nil(suite.T(), err)
	assert.Zero(suite.T(), *edge)
}

func testLoadEdgeByType(suite *modelsTestSuite, f func(id, id2 string) (*ent.Edge, error)) {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	verifyEdgeByType(
		suite,
		func() (*ent.Edge, error) {
			return f(user.ID, event.ID)
		},
		user.ID,
		event.ID,
	)
}

func verifyEdgeByType(suite *modelsTestSuite, f func() (*ent.Edge, error), id1, id2 string) {
	edge, err := f()
	assert.Nil(suite.T(), err)
	assert.NotZero(suite.T(), edge)
	assert.Equal(suite.T(), edge.ID1, id1)
	assert.Equal(suite.T(), edge.ID2, id2)
}

func (suite *modelsTestSuite) TestLoadAssocEdges() {
	// This is dependent on 2 things:
	// 1/ table already existing so first pass of chained loader works
	// 2/ table not being empty and full of valid data
	// we can't remove and re-add fresh data because of how dbcleaner works
	// we can't validate the number of edges here because that's subject to change
	var existingEdges []*ent.AssocEdgeData
	err := ent.GenLoadAssocEdges(&existingEdges)

	assert.NotEmpty(suite.T(), existingEdges)
	assert.Nil(suite.T(), err)
}

func (suite *modelsTestSuite) TestLoadForeignKeyNodes() {
	user := testingutils.CreateTestUser(suite.T())
	contact := testingutils.CreateTestContact(suite.T(), user)
	contact2 := testingutils.CreateTestContact(suite.T(), user)

	var testCases = []struct {
		id          string
		foundResult bool
	}{
		{
			user.ID,
			true,
		},
		{
			contact.ID,
			false,
		},
	}

	for _, tt := range testCases {
		var contacts []*models.Contact
		err := ent.LoadRawForeignKeyNodes(tt.id, &contacts, "user_id", &configs.ContactConfig{})
		assert.Nil(suite.T(), err)
		if tt.foundResult {
			assert.NotEmpty(suite.T(), contacts)

			assert.Len(suite.T(), contacts, 2)
			for _, loadedContact := range contacts {
				assert.NotZero(suite.T(), loadedContact)
				assert.Contains(suite.T(), []string{contact.ID, contact2.ID}, loadedContact.ID)
			}
		} else {
			assert.Len(suite.T(), contacts, 0)
			assert.Empty(suite.T(), contacts)
		}
	}
}

func (suite *modelsTestSuite) TestLoadNodesByType() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)
	event2 := testingutils.CreateTestEvent(suite.T(), user)

	var testCases = []struct {
		id1         string
		foundResult bool
	}{
		{
			user.ID,
			true,
		},
		{
			event.ID,
			false,
		},
	}

	for _, tt := range testCases {
		var events []*models.Event
		err := ent.LoadRawNodesByType(tt.id1, models.UserToEventsEdge, &events, &configs.EventConfig{})
		assert.Nil(suite.T(), err)
		if tt.foundResult {
			assert.NotEmpty(suite.T(), events)

			assert.Len(suite.T(), events, 2)
			for _, loadedEvent := range events {
				assert.NotZero(suite.T(), loadedEvent)
				assert.Contains(suite.T(), []string{event.ID, event2.ID}, loadedEvent.ID)
			}
		} else {
			assert.Len(suite.T(), events, 0)
			assert.Empty(suite.T(), events)
		}
	}
}

func TestModelsSuite(t *testing.T) {
	suite.Run(t, new(modelsTestSuite))
}
