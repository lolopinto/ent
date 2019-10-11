package ent_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
)

func createTestUser(t *testing.T) *models.User {
	var user models.User

	fields := map[string]interface{}{
		"EmailAddress": fmt.Sprintf("test-%s@email.com", util.GenerateRandCode(9)),
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

func createTestContact(t *testing.T, user *models.User) *models.Contact {
	var contact models.Contact

	fields := map[string]interface{}{
		"EmailAddress": fmt.Sprintf("test-contact-%s@email.com", util.GenerateRandCode(9)),
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
