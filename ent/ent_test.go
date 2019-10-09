package ent_test

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/stretchr/testify/assert"
)

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

func createTestUser(t *testing.T) *models.User {
	var user models.User

	fields := map[string]interface{}{
		"EmailAddress": "test@email.com",
		"FirstName":    "Ola",
		"LastName":     "Okelola",
	}

	err := ent.CreateNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &user,
			EntConfig:      &configs.UserConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
		},
	)
	assert.Nil(t, err)
	return &user
}

func createTestEvent(t *testing.T, user *models.User) *models.Event {
	var event models.Event

	fields := map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    user.ID,
		"StartTime": time.Now(),
		"EndTime":   time.Now().Add(time.Hour * 24 * 3),
		"Location":  "fun location",
	}
	err := ent.CreateNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &event,
			EntConfig:      &configs.EventConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
			InboundEdges: []*ent.EditedEdgeInfo{
				&ent.EditedEdgeInfo{
					EdgeType: models.UserToEventsEdge,
					Id:       user.ID,
					NodeType: user.GetType(),
				},
			},
		},
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

func createTestContact(t *testing.T, user *models.User) *models.Contact {
	var contact models.Contact

	fields := map[string]interface{}{
		"EmailAddress": fmt.Sprintf("test-contact-%s@email.com", generateRandCode(9)),
		"UserID":       user.ID,
		"FirstName":    "first-name",
		"LastName":     "last-name",
	}
	err := ent.CreateNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &contact,
			EntConfig:      &configs.ContactConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
		},
	)
	assert.Nil(t, err)
	return &contact
}

func getFieldMapFromFields(fields map[string]interface{}) ent.ActionFieldMap {
	ret := make(ent.ActionFieldMap)
	for k := range fields {
		ret[k] = &ent.MutatingFieldInfo{
			DB:       strcase.ToSnake(k),
			Required: true,
		}
	}
	return ret
}
