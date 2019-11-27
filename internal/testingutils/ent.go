package testingutils

import (
	"testing"
	"time"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
)

func CreateTestUser(t *testing.T) *models.User {
	return SaveUser(t, GetDefaultUserBuilder(util.GenerateRandEmail()))
}

func CreateTestUserWithEmail(t *testing.T, email string) *models.User {
	return SaveUser(t, GetDefaultUserBuilder(email))
}

func EditUser(t *testing.T, user *models.User, fields map[string]interface{}) *models.User {
	return SaveUser(t, GetUserBuilderWithFields(
		ent.EditOperation,
		user,
		fields,
	))
}

func CreateTestEvent(t *testing.T, user *models.User, invitedUsers ...*models.User) *models.Event {
	b := GetEventBuilderwithFields(
		ent.InsertOperation,
		nil,
		GetDefaultEventFields(user),
	)
	for _, user := range invitedUsers {
		b.AddOutboundEdge(models.EventToInvitedEdge, user.ID, user.GetType())
	}
	// this will be automatically added by generated builders
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	return SaveEvent(t, b)
}

func CreateTestContact(t *testing.T, user *models.User, allowList ...*models.User) *models.Contact {
	b := GetContactBuilder(ent.InsertOperation, nil)

	setFields(b, map[string]interface{}{
		"EmailAddress": util.GenerateRandEmail(),
		"UserID":       user.ID,
		"FirstName":    "first-name",
		"LastName":     "last-name",
	})
	for _, user := range allowList {
		b.AddOutboundEdge(models.ContactToAllowListEdge, user.ID, user.GetType())
	}
	return SaveContact(t, b)
}

func EditContact(t *testing.T, contact *models.Contact, fields map[string]interface{}) *models.Contact {
	b := GetContactBuilder(ent.EditOperation, contact)
	setFields(b, fields)
	return SaveContact(t, b)
}

func AddFamilyMember(t *testing.T, user1, user2 *models.User) {
	b := GetUserBuilderWithFields(
		ent.EditOperation,
		user1,
		make(map[string]interface{}),
	)
	b.AddOutboundEdge(models.UserToFamilyMembersEdge, user2.ID, user2.GetType())
	SaveUser(t, b)

	VerifyFamilyEdge(t, user1, user2)
}

func GetBaseBuilder(
	operation ent.WriteOperation,
	entity ent.Entity,
	config ent.Config,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	v := viewertesting.OmniViewerContext{}
	return actions.NewMutationBuilder(v, operation, entity, config, actions.ExistingEnt(existingEnt))
}

func CreateEdge(t *testing.T, edge *ent.AssocEdgeData) {
	var newEdge ent.AssocEdgeData
	b := GetBaseBuilder(
		ent.InsertOperation,
		&newEdge,
		&ent.AssocEdgeConfig{},
		nil,
	)
	setFields(b, map[string]interface{}{
		"edge_type":         edge.EdgeType,
		"inverse_edge_type": edge.InverseEdgeType,
		"edge_table":        edge.EdgeTable,
		"edge_name":         edge.EdgeName,
		"symmetric_edge":    edge.SymmetricEdge,
	},
	)
	SaveBuilder(t, b)
}

func EditEdge(t *testing.T, edge *ent.AssocEdgeData) {
	var newEdge ent.AssocEdgeData
	b := GetBaseBuilder(
		ent.EditOperation,
		&newEdge,
		&ent.AssocEdgeConfig{},
		edge,
	)
	setFields(b, map[string]interface{}{
		"edge_type":         edge.EdgeType,
		"inverse_edge_type": edge.InverseEdgeType,
		"edge_table":        edge.EdgeTable,
		"edge_name":         edge.EdgeName,
		"symmetric_edge":    edge.SymmetricEdge,
	},
	)
	SaveBuilder(t, b)
}

func GetUserBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	var user models.User
	b := GetBaseBuilder(
		operation,
		&user,
		&configs.UserConfig{},
		existingEnt,
	)
	return b
}

func GetUserBuilderWithFields(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
	fields map[string]interface{},
) *actions.EntMutationBuilder {
	b := GetUserBuilder(operation, existingEnt)
	setFields(b, fields)
	return b
}

func GetEventBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	var event models.Event
	b := GetBaseBuilder(
		operation,
		&event,
		&configs.EventConfig{},
		existingEnt,
	)
	return b
}

func GetEventBuilderwithFields(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
	fields map[string]interface{},
) *actions.EntMutationBuilder {
	b := GetEventBuilder(operation, existingEnt)
	setFields(b, fields)
	return b
}

func GetContactBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	var contact models.Contact
	b := GetBaseBuilder(
		operation,
		&contact,
		&configs.ContactConfig{},
		existingEnt,
	)
	return b
}

func SaveBuilder(t *testing.T, b ent.MutationBuilder) {
	// sad. todo come up with better long term approach for tests
	emb, ok := b.(*actions.EntMutationBuilder)
	if ok {
		emb.FieldMap = getFieldMapFromFields(emb.Operation, emb.GetFields())
	} else {
		egmb, ok := b.(*actions.EdgeGroupMutationBuilder)
		if ok {
			egmb.FieldMap = getFieldMapFromFields(egmb.Operation, egmb.GetFields())
		}
	}
	c, err := b.GetChangeset()
	assert.Nil(t, err)
	err = ent.SaveChangeset(c)
	assert.Nil(t, err)
}

func SaveUser(t *testing.T, b ent.MutationBuilder) *models.User {
	if b.GetOperation() == ent.DeleteOperation {
		SaveBuilder(t, b)
		return nil
	}
	SaveBuilder(t, b)
	user, ok := b.Entity().(*models.User)
	assert.True(t, ok)
	return user
}

func SaveEvent(t *testing.T, b ent.MutationBuilder) *models.Event {
	if b.GetOperation() == ent.DeleteOperation {
		SaveBuilder(t, b)
		return nil
	}
	SaveBuilder(t, b)
	event, ok := b.Entity().(*models.Event)
	assert.True(t, ok)
	return event
}

func SaveContact(t *testing.T, b ent.MutationBuilder) *models.Contact {
	if b.GetOperation() == ent.DeleteOperation {
		SaveBuilder(t, b)
		return nil
	}
	SaveBuilder(t, b)
	contact, ok := b.Entity().(*models.Contact)
	assert.True(t, ok)
	return contact
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

func GetDefaultEventFields(user *models.User) map[string]interface{} {
	return GetDefaultEventFieldsUserID(user.ID)
}

func GetDefaultEventFieldsUserID(userID string) map[string]interface{} {
	return map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    userID,
		"StartTime": time.Now(),
		"EndTime":   time.Now().Add(time.Hour * 24 * 3),
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

func getFieldMapFromFields(op ent.WriteOperation, fields map[string]interface{}) ent.ActionFieldMap {
	ret := make(ent.ActionFieldMap)
	for k := range fields {
		ret[k] = &ent.MutatingFieldInfo{
			DB:       strcase.ToSnake(k),
			Required: op == ent.InsertOperation,
		}
	}
	return ret
}
