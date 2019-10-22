package testingutils

import (
	"testing"
	"time"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
)

func CreateTestUser(t *testing.T) *models.User {
	var user models.User

	fields := map[string]interface{}{
		"EmailAddress": util.GenerateRandEmail(),
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

func CreateTestEvent(t *testing.T, user *models.User, invitedUsers ...*models.User) *models.Event {
	var event models.Event

	fields := map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    user.ID,
		"StartTime": time.Now(),
		"EndTime":   time.Now().Add(time.Hour * 24 * 3),
		"Location":  "fun location",
	}
	outboundEdges := []*ent.EditedEdgeInfo{}
	for _, user := range invitedUsers {
		outboundEdges = append(outboundEdges, &ent.EditedEdgeInfo{
			EdgeType: models.EventToInvitedEdge,
			Id:       user.ID,
			NodeType: user.GetType(),
		})
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
			OutboundEdges: outboundEdges,
		},
	)
	assert.Nil(t, err)

	return &event
}

func CreateTestContact(t *testing.T, user *models.User, allowList ...*models.User) *models.Contact {
	var contact models.Contact

	fields := map[string]interface{}{
		"EmailAddress": util.GenerateRandEmail(),
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

func GetBaseBuilder(
	operation ent.WriteOperation,
	config ent.Config,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	v := viewertesting.OmniViewerContext{}
	return &actions.EntMutationBuilder{
		Viewer:         v,
		EntConfig:      config,
		Operation:      operation,
		ExistingEntity: existingEnt,
	}
}

func GetUserBuilderWithFields(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
	fields map[string]interface{},
) *actions.EntMutationBuilder {
	b := GetBaseBuilder(
		operation,
		&configs.UserConfig{},
		existingEnt,
	)
	setFields(b, fields)
	return b
}

func GetEventBuilderwithFields(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
	fields map[string]interface{},
) *actions.EntMutationBuilder {
	b := GetBaseBuilder(
		operation,
		&configs.EventConfig{},
		existingEnt,
	)
	setFields(b, fields)
	return b
}

func SaveBuilder(t *testing.T, b ent.MutationBuilder, entity ent.Entity) {
	c, err := b.GetChangeset(entity)
	assert.Nil(t, err)
	err = ent.SaveChangeset(c)
	assert.Nil(t, err)
}

func SaveUser(t *testing.T, b ent.MutationBuilder) *models.User {
	if b.GetOperation() == ent.DeleteOperation {
		SaveBuilder(t, b, nil)
		return nil
	}
	var user models.User
	SaveBuilder(t, b, &user)
	return &user
}

func SaveEvent(t *testing.T, b ent.MutationBuilder) *models.Event {
	if b.GetOperation() == ent.DeleteOperation {
		SaveBuilder(t, b, nil)
		return nil
	}
	var event models.Event
	SaveBuilder(t, b, &event)
	return &event
}

func CreateUser(t *testing.T, email string) *models.User {
	return SaveUser(t, GetDefaultUserBuilder(email))
}

func GetDefaultUserBuilder(email string) *actions.EntMutationBuilder {
	return GetUserBuilderWithFields(
		ent.InsertOperation,
		nil,
		map[string]interface{}{
			"EmailAddress": email,
			"FirstName":    "Ola",
			"LastName":     "Okelola",
		},
	)
}

func CreateEvent(t *testing.T, user *models.User) *models.Event {
	b := GetEventBuilderwithFields(
		ent.InsertOperation,
		nil,
		GetDefaultEventFields(user),
	)
	return SaveEvent(t, b)
}

func GetDefaultEventFields(user *models.User) map[string]interface{} {
	return map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    user.ID,
		"StartTime": time.Now(),
		"EndTime":   time.Now(),
		"Location":  "fun location!",
	}
}

func setFields(
	b *actions.EntMutationBuilder,
	fields map[string]interface{},
) {
	for k, v := range fields {
		b.SetField(k, v)
	}
}
