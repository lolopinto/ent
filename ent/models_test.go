package ent

import (
	"database/sql"

	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"gopkg.in/khaiql/dbcleaner.v2"
	"gopkg.in/khaiql/dbcleaner.v2/engine"

	"github.com/lolopinto/ent/config"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/viewer"
	//	"github.com/davecgh/go-spew/spew"
	// "github.com/lolopinto/ent/ent/testdata/models"
	// "github.com/lolopinto/ent/ent/testdata/models/configs"
)

type user struct {
	Node
	FirstName string `db:"first_name"`
	LastName  string `db:"last_name"`
	UserID    string `db:"user_id"`
}

type assocEdgeWithPkey struct {
	EdgeType string `db:"edge_type" pkey:"true"` // this is a pkey telling getFieldsAndValuesOfStruct() to not get the id key or try and set it
	EdgeName string `db:"edge_name"`
	// we still add magical created_at and updated_at fields here though because we're cheating and it works for what we want.
	// TODO: change getFieldsAndValuesOfStruct() to go down the rabbit hole and do the right thing by checking the fields we care
	// about instead of this
}

func TestGetFieldsAndValuesOfNodeStruct(t *testing.T) {
	u := &user{
		FirstName: "John",
		LastName:  "Snow",
		UserID:    "1234",
	}
	insertData := getFieldsAndValuesOfStruct(reflect.ValueOf(u), false)
	if len(insertData.columns) != 6 {
		t.Errorf("number of columns returned were not as expected, expected %d, got %d", 6, len(insertData.columns))
	}
	expectedColumnOrder := []string{
		"id",
		"first_name",
		"last_name",
		"user_id",
		"updated_at",
		"created_at",
	}
	for idx, col := range expectedColumnOrder {
		if insertData.columns[idx] != col {
			t.Errorf("expected %s column in the %dth position, didn't get it, got %s instead", col, idx, insertData.columns[idx])
		}
	}

	if len(insertData.values) != 6 {
		t.Errorf("number of values returned were not as expected, expected %d, got %d", 6, len(insertData.columns))
	}

	if u.ID != "" {
		t.Errorf("expected the Id field to not be set. was set instead")
	}
}

func TestGetFieldsAndValuesOfNodeSetIDFieldStruct(t *testing.T) {
	u := &user{
		FirstName: "John",
		LastName:  "Snow",
		UserID:    "1234",
	}
	getFieldsAndValuesOfStruct(reflect.ValueOf(u), true)

	if u.ID == "" {
		t.Errorf("expected the Id field to be set. was not set")
	}
}

func TestGetFieldsAndValuesOfNonNodeStruct(t *testing.T) {
	edge := &assocEdgeWithPkey{
		EdgeName: "user_to_notes_edge",
		EdgeType: "friends_edge",
	}
	insertData := getFieldsAndValuesOfStruct(reflect.ValueOf(edge), false)
	if len(insertData.columns) != 4 {
		t.Errorf("number of columns returned were not as expected, expected %d, got %d", 4, len(insertData.columns))
	}
	expectedColumnOrder := []string{
		"edge_type",
		"edge_name",
		"updated_at",
		"created_at",
	}
	for idx, col := range expectedColumnOrder {
		if insertData.columns[idx] != col {
			t.Errorf("expected %s column in the %dth position, didn't get it, got %s instead", col, idx, insertData.columns[idx])
		}
	}

	if len(insertData.values) != 4 {
		t.Errorf("number of values returned were not as expected, expected %d, got %d", 4, len(insertData.columns))
	}
}

func TestGetFieldsAndValuesOfNonNodeSetIDFieldStruct(t *testing.T) {
	edge := &assocEdgeWithPkey{
		EdgeName: "user_to_notes_edge",
		EdgeType: "friends_edge",
	}
	// calling with setIDField true shouldn't break anything
	getFieldsAndValuesOfStruct(reflect.ValueOf(edge), true)
}

type modelsTestSuite struct {
	suite.Suite
}

var Cleaner = dbcleaner.New()

func (suite *modelsTestSuite) SetupSuite() {
	postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	Cleaner.SetEngine(postgres)
}

// TODO make this automatic based on db
// TODO make this a base class for all future tests that operate on the db
func (suite *modelsTestSuite) SetupTest() {
	Cleaner.Acquire("users")
	Cleaner.Acquire("user_events_edges")
	Cleaner.Acquire("events")
}

func (suite *modelsTestSuite) TearDownTest() {
	Cleaner.Clean("users")
	Cleaner.Clean("user_events_edges")
	Cleaner.Clean("events")
}

// manual for now until I figure out code generated and all that jazz
type testUser struct {
	Node
	EmailAddress string `db:"email_address"`
	FirstName    string `db:"first_name"`
	LastName     string `db:"last_name"`
	Viewer       viewer.ViewerContext
}

func (user *testUser) FillFromMap(data map[string]interface{}) error {
	for k, v := range data {
		var err error
		switch k {
		case "id":
			user.ID, err = cast.ToUUIDString(v)
			if err != nil {
				return err
			}
			break
		case "email_address":
			user.EmailAddress, err = cast.ToString(v)
			if err != nil {
				return err
			}
			break
		case "first_name":
			user.FirstName, err = cast.ToString(v)
			if err != nil {
				return err
			}
			break
		case "last_name":
			user.LastName, err = cast.ToString(v)
			if err != nil {
				return err
			}
			break
		}
	}
	return nil
}

type testUserConfig struct{}

func (config *testUserConfig) GetTableName() string {
	return "users"
}

func (suite *modelsTestSuite) TestLoadNodeFromParts() {
	user := testUser{
		EmailAddress: "test@email.com",
		FirstName:    "Ola",
		LastName:     "Okelola",
	}
	err := CreateNode(&user, &testUserConfig{})
	assert.Nil(suite.T(), err)

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
		var existingUser testUser
		err = LoadNodeFromParts(&existingUser, &testUserConfig{}, tt.parts...)
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
	user := testUser{
		EmailAddress: "test@email.com",
		FirstName:    "Ola",
		LastName:     "Okelola",
	}
	err := CreateNode(&user, &testUserConfig{})
	assert.Nil(suite.T(), err)

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
		var existingUser testUser
		err = loadNodeRawData(tt.id, &existingUser, &testUserConfig{})
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
		edgeType    string
		foundResult bool
	}{
		{
			// constant in user.go testdata
			"41bddf81-0c26-432c-9133-2f093af2c07c",
			true,
		},
		{
			uuid.New().String(),
			false,
		},
	}

	for _, tt := range testCases {
		edgeData, err := getEdgeInfo(EdgeType(tt.edgeType), nil)
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

func TestModelsSuite(t *testing.T) {
	suite.Run(t, new(modelsTestSuite))
}
