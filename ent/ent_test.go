package ent

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/stretchr/testify/assert"
)

type simpleObj struct {
	Entity
}

func (obj *simpleObj) GetType() NodeType {
	panic("whaa")
}

func (obj *simpleObj) GetPrivacyPolicy() PrivacyPolicy {
	return simplePrivacyPolicy{EntID: obj.GetID()}
}

// todo these are duplicated from privacy_rules.go
type allowIfOmniscientRule struct{}

func (allowIfOmniscientRule) Eval(viewer viewer.ViewerContext, entity Entity) PrivacyResult {
	if viewer.IsOmniscient() {
		return Allow()
	}
	return Skip()
}

type allowIfViewerIsOwnerRule struct {
	OwnerID string
}

func (rule allowIfViewerIsOwnerRule) Eval(viewer viewer.ViewerContext, entity Entity) PrivacyResult {
	if viewer.GetViewerID() == rule.OwnerID {
		return Allow()
	}
	return Skip()
}

type alwaysDenyRule struct{}

// Eval is the method called to evaluate the visibility of the ent and always returns DenyResult
func (rule alwaysDenyRule) Eval(viewer viewer.ViewerContext, entity Entity) PrivacyResult {
	return Deny()
}

type simplePrivacyPolicy struct {
	EntID string
}

func (policy simplePrivacyPolicy) Rules() []PrivacyPolicyRule {
	spew.Dump(policy.EntID)
	return []PrivacyPolicyRule{
		allowIfOmniscientRule{},
		allowIfViewerIsOwnerRule{OwnerID: policy.EntID},
		alwaysDenyRule{},
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

func (user *testUser) GetPrivacyPolicy() PrivacyPolicy {
	return simplePrivacyPolicy{EntID: user.GetID()}
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

// TODO these are duplicated from privacy_rules_test.go
type omniViewerContext struct {
	viewer.LoggedOutViewerContext
}

func (omniViewerContext) IsOmniscient() bool {
	return true
}

type loggedinViewerContext struct {
	viewer.LoggedOutViewerContext
	viewerID string
}

func (v loggedinViewerContext) GetViewerID() string {
	if v.viewerID != "" {
		return v.viewerID
	}
	return "1"
}

func (loggedinViewerContext) HasIdentity() bool {
	return true
}

func createTestUser(t *testing.T) *testUser {
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
	assert.Nil(t, err)
	return &user
}

func createTestEvent(t *testing.T, user *testUser) *testEvent {
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
	assert.Nil(t, err)
	err = addEdgeInTransactionRaw(
		TestUserToEventsEdge,
		user.ID,
		event.ID,
		NodeType("user"),
		NodeType("event"),
		EdgeOptions{},
		nil,
	)
	assert.Nil(t, err)

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

func createTestContact(t *testing.T, user *testUser) *testContact {
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
	assert.Nil(t, err)
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
