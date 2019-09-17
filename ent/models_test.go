package ent

import (
	"database/sql"
	"fmt"
	"time"

	"math/rand"
	"strconv"
	"strings"

	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/iancoleman/strcase"
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

type simpleObj struct{}

func (obj *simpleObj) GetType() NodeType {
	panic("whaa")
}

func (obj *simpleObj) GetPrivacyPolicy() PrivacyPolicy {
	return simplePrivacyPolicy{}
}

type simplePrivacyPolicy struct{}

func (policy simplePrivacyPolicy) Rules() []PrivacyPolicyRule {
	return []PrivacyPolicyRule{
		// it actually doesn't require any rules for now so this is fine.
		// also, we only need this for interface purposes
	}
}

// manual for now until I figure out code generated and all that jazz
type testUser struct {
	simpleObj
	Node
	EmailAddress string `db:"email_address"`
	FirstName    string `db:"first_name"`
	LastName     string `db:"last_name"`
	Viewer       viewer.ViewerContext
}

func (user *testUser) DBFields() DBFields {
	return DBFields{
		"id": func(v interface{}) error {
			var err error
			user.ID, err = cast.ToUUIDString(v)
			return err
		},
		"email_address": func(v interface{}) error {
			var err error
			user.EmailAddress, err = cast.ToString(v)
			return err
		},
		"first_name": func(v interface{}) error {
			var err error
			user.FirstName, err = cast.ToString(v)
			return err
		},
		"last_name": func(v interface{}) error {
			var err error
			user.LastName, err = cast.ToString(v)
			return err
		},
	}
}

type testUserConfig struct{}

const TestUserToEventsEdge EdgeType = "41bddf81-0c26-432c-9133-2f093af2c07c"

func (config *testUserConfig) GetTableName() string {
	return "users"
}

func (config *testUserConfig) GetEdges() EdgeMap {
	return EdgeMap{
		"Events": &AssociationEdge{
			EntConfig: testEventConfig{},
		},
	}
}

type testEvent struct {
	simpleObj
	Node
	Name      string    `db:"name"`
	UserID    string    `db:"user_id"`
	StartTime time.Time `db:"start_time"`
	EndTime   time.Time `db:"end_time"`
	Location  string    `db:"location"`
	Viewer    viewer.ViewerContext
}

func (event *testEvent) DBFields() DBFields {
	return DBFields{
		"id": func(v interface{}) error {
			var err error
			event.ID, err = cast.ToUUIDString(v)
			return err
		},
		"name": func(v interface{}) error {
			var err error
			event.Name, err = cast.ToString(v)
			return err
		},
		"user_id": func(v interface{}) error {
			var err error
			event.UserID, err = cast.ToString(v)
			return err
		},
		"location": func(v interface{}) error {
			var err error
			event.Location, err = cast.ToString(v)
			return err
		},
		"start_time": func(v interface{}) error {
			var err error
			event.StartTime, err = cast.ToTime(v)
			return err
		},
		"end_time": func(v interface{}) error {
			var err error
			event.EndTime, err = cast.ToTime(v)
			return err
		},
	}
}

type testEventConfig struct{}

func (config *testEventConfig) GetTableName() string {
	return "events"
}

type testContact struct {
	simpleObj
	Node
	EmailAddress string `db:"email_address"`
	FirstName    string `db:"first_name"`
	LastName     string `db:"last_name"`
	UserID       string `db:"user_id"`
	Viewer       viewer.ViewerContext
}

func (contact *testContact) DBFields() DBFields {
	return DBFields{
		"id": func(v interface{}) error {
			var err error
			contact.ID, err = cast.ToUUIDString(v)
			return err
		},
		"email_address": func(v interface{}) error {
			var err error
			contact.EmailAddress, err = cast.ToString(v)
			return err
		},
		"first_name": func(v interface{}) error {
			var err error
			contact.FirstName, err = cast.ToString(v)
			return err
		},
		"last_name": func(v interface{}) error {
			var err error
			contact.LastName, err = cast.ToString(v)
			return err
		},
		"user_id": func(v interface{}) error {
			var err error
			contact.UserID, err = cast.ToString(v)
			return err
		},
	}
}

type testContactConfig struct{}

func (config *testContactConfig) GetTableName() string {
	return "contacts"
}

func (suite *modelsTestSuite) TestLoadNodeFromParts() {
	createTestUser(suite)

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
		err := LoadNodeFromParts(&existingUser, &testUserConfig{}, tt.parts...)
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
	user := createTestUser(suite)

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
		err := loadNodeRawData(tt.id, &existingUser, &testUserConfig{})
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
		edgeType    EdgeType
		foundResult bool
	}{
		{
			TestUserToEventsEdge,
			true,
		},
		{
			EdgeType(uuid.New().String()),
			false,
		},
	}

	for _, tt := range testCases {
		edgeData, err := getEdgeInfo(tt.edgeType, nil)
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

func createTestUser(suite *modelsTestSuite) *testUser {
	var user testUser

	fields := map[string]interface{}{
		"EmailAddress": "test@email.com",
		"FirstName":    "Ola",
		"LastName":     "Okelola",
	}

	err := CreateNodeFromActionMap(
		&EditedNodeInfo{
			Entity:         &user,
			EntConfig:      &testUserConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
		},
	)
	assert.Nil(suite.T(), err)
	return &user
}

func createTestEvent(suite *modelsTestSuite, user *testUser) *testEvent {
	var event testEvent

	fields := map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    user.ID,
		"StartTime": time.Now(),
		"EndTime":   time.Now().Add(time.Hour * 24 * 3),
		"Location":  "fun location",
	}
	err := CreateNodeFromActionMap(
		&EditedNodeInfo{
			Entity:         &event,
			EntConfig:      &testEventConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
		},
	)
	// manual testing until we come up with better way of doing this
	// when i fix the bugs
	assert.Nil(suite.T(), err)
	err = addEdgeInTransactionRaw(
		TestUserToEventsEdge,
		user.ID,
		event.ID,
		NodeType("user"),
		NodeType("event"),
		EdgeOptions{},
		nil,
	)
	assert.Nil(suite.T(), err)

	return &event
}

func generateRandCode(n int) string {
	rand.Seed(time.Now().UnixNano())

	var sb strings.Builder
	for i := 0; i < n; i++ {
		sb.WriteString(strconv.Itoa(rand.Intn(9)))
	}
	return sb.String()
}

func createTestContact(suite *modelsTestSuite, user *testUser) *testContact {
	var contact testContact

	fields := map[string]interface{}{
		"EmailAddress": fmt.Sprintf("test-contact-%s@email.com", generateRandCode(9)),
		"UserID":       user.ID,
		"FirstName":    "first-name",
		"LastName":     "last-name",
	}
	err := CreateNodeFromActionMap(
		&EditedNodeInfo{
			Entity:         &contact,
			EntConfig:      &testContactConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
		},
	)
	assert.Nil(suite.T(), err)
	return &contact
}

func getFieldMapFromFields(fields map[string]interface{}) ActionFieldMap {
	ret := make(ActionFieldMap)
	for k := range fields {
		ret[k] = &MutatingFieldInfo{
			DB:       strcase.ToSnake(k),
			Required: true,
		}
	}
	return ret
}

func (suite *modelsTestSuite) TestLoadEdgesByType() {
	user := createTestUser(suite)
	event := createTestEvent(suite, user)
	event2 := createTestEvent(suite, user)

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
		edges, err := LoadEdgesByType(tt.id1, TestUserToEventsEdge)
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
	var existingEdges []*AssocEdgeData
	err := GenLoadAssocEdges(&existingEdges)

	assert.NotEmpty(suite.T(), existingEdges)
	assert.Nil(suite.T(), err)
}

func (suite *modelsTestSuite) TestLoadForeignKeyNodes() {
	user := createTestUser(suite)
	contact := createTestContact(suite, user)
	contact2 := createTestContact(suite, user)

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
		var contacts []*testContact
		err := loadForeignKeyNodes(tt.id, &contacts, "user_id", &testContactConfig{})
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
	user := createTestUser(suite)
	event := createTestEvent(suite, user)
	event2 := createTestEvent(suite, user)

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
		var events []*testEvent
		err := loadNodesByType(tt.id1, TestUserToEventsEdge, &events, &testEventConfig{})
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
