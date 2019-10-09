package ent_test

import (
	"database/sql"

	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"github.com/lolopinto/ent/config"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"gopkg.in/khaiql/dbcleaner.v2"
	"gopkg.in/khaiql/dbcleaner.v2/engine"
)

type modelsTestSuite struct {
	suite.Suite
	cleaner dbcleaner.DbCleaner
}

func (suite *modelsTestSuite) SetupSuite() {
	suite.cleaner = dbcleaner.New()
	postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	suite.cleaner.SetEngine(postgres)
}

// TODO make this automatic based on db
// TODO make this a base class for all future tests that operate on the db
func (suite *modelsTestSuite) SetupTest() {
	suite.cleaner.Acquire("users")
	suite.cleaner.Acquire("user_events_edges")
	suite.cleaner.Acquire("events")
}

func (suite *modelsTestSuite) TearDownTest() {
	suite.cleaner.Clean("users")
	suite.cleaner.Clean("user_events_edges")
	suite.cleaner.Clean("events")
}

func (suite *modelsTestSuite) TestLoadNodeFromParts() {
	createTestUser(suite.T())

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
				"test@email.com",
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
	user := createTestUser(suite.T())

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
	user := createTestUser(suite.T())
	event := createTestEvent(suite.T(), user)
	event2 := createTestEvent(suite.T(), user)

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
		edges, err := ent.LoadEdgesByType(tt.id1, models.UserToEventsEdge)
		assert.Nil(suite.T(), err)
		if tt.foundResult {
			assert.NotEmpty(suite.T(), edges)

			assert.Len(suite.T(), edges, 2)
			for _, edge := range edges {
				assert.NotZero(suite.T(), edge)
				assert.Contains(suite.T(), []string{event.ID, event2.ID}, edge.ID2)
			}
		} else {
			assert.Len(suite.T(), edges, 0)
			assert.Empty(suite.T(), edges)
		}
	}
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
	user := createTestUser(suite.T())
	contact := createTestContact(suite.T(), user)
	contact2 := createTestContact(suite.T(), user)

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
	user := createTestUser(suite.T())
	event := createTestEvent(suite.T(), user)
	event2 := createTestEvent(suite.T(), user)

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
