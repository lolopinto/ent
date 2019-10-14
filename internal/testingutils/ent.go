package testingutils

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

func CreateTestUser(t *testing.T) *models.User {
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

func CreateTestEvent(t *testing.T, user *models.User) *models.Event {
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

func CreateTestContact(t *testing.T, user *models.User, allowList ...*models.User) *models.Contact {
	var contact models.Contact

	fields := map[string]interface{}{
		"EmailAddress": fmt.Sprintf("test-contact-%s@email.com", util.GenerateRandCode(9)),
		"UserID":       user.ID,
		"FirstName":    "first-name",
		"LastName":     "last-name",
	}
	outboundEdges := []*ent.EditedEdgeInfo{}
	for _, user := range allowList {
		outboundEdges = append(outboundEdges, &ent.EditedEdgeInfo{
			EdgeType: models.ContactToAllowListEdge,
			Id:       user.ID,
			NodeType: user.GetType(),
		})
	}
	err := ent.CreateNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &contact,
			EntConfig:      &configs.ContactConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
			OutboundEdges:  outboundEdges,
		},
	)
	assert.Nil(t, err)
	return &contact
}

func AddFamilyMember(t *testing.T, user1, user2 *models.User) {
	var user models.User

	fields := make(map[string]interface{})
	err := ent.EditNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &user,
			ExistingEnt:    user1,
			EntConfig:      &configs.UserConfig{},
			Fields:         fields,
			EditableFields: getFieldMapFromFields(fields),
			OutboundEdges: []*ent.EditedEdgeInfo{
				&ent.EditedEdgeInfo{
					EdgeType: models.UserToFamilyMembersEdge,
					Id:       user2.ID,
					NodeType: user1.GetType(),
				},
			},
		},
	)

	assert.Nil(t, err)
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
