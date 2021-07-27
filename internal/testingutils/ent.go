package testingutils

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	// these will be added in triggers for generated builders
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	b.AddOutboundEdge(models.EventToCreatorEdge, user.ID, user.GetType())
	b.AddOutboundEdge(models.EventToHostsEdge, user.ID, user.GetType())
	return SaveEvent(t, b)
}

func EditEvent(t *testing.T, event *models.Event, fields map[string]interface{}) *models.Event {
	b := GetEventBuilder(ent.EditOperation, event)
	b.SetRawFields(fields)
	return SaveEvent(t, b)
}

func CreateTestContact(t *testing.T, user *models.User, allowList ...*models.User) *models.Contact {
	b := GetContactBuilder(ent.InsertOperation, nil)
	b.SetRawFields(map[string]interface{}{
		"email_address": util.GenerateRandEmail(),
		"user_id":       user.ID,
		"first_name":    "first-name",
		"last_name":     "last-name",
	})
	for _, user := range allowList {
		b.AddOutboundEdge(models.ContactToAllowListEdge, user.ID, user.GetType())
	}
	return SaveContact(t, b)
}

func CreateTestAddress(t *testing.T, residentNames []string) *models.Address {
	b := GetAddressBuilder(ent.InsertOperation, nil)

	// have to manually marshall it because it's not going through ent framework
	byt, err := json.Marshal(residentNames)
	require.Nil(t, err)
	b.SetRawFields(map[string]interface{}{
		"street_address": "",
		"city":           "Westminster",
		"State":          "London",
		"zip":            "SW1A 1AA",
		"country":        "UK",
		"resident_names": byt,
	})
	return SaveAddress(t, b)
}

func EditContact(t *testing.T, contact *models.Contact, fields map[string]interface{}) *models.Contact {
	b := GetContactBuilder(ent.EditOperation, contact)
	b.SetRawFields(fields)
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
	loader ent.Loader,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	v := viewertesting.OmniViewerContext{}
	return actions.NewMutationBuilder(v, operation, loader.GetNewInstance().(ent.Entity), loader.GetConfig(), actions.ExistingEnt(existingEnt))
}

func CreateEdge(t *testing.T, edge *ent.AssocEdgeData) {
	b := GetBaseBuilder(
		ent.InsertOperation,
		&ent.AssocEdgeLoader{},
		nil,
	)
	b.SetRawFields(map[string]interface{}{
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
	b := GetBaseBuilder(
		ent.EditOperation,
		&ent.AssocEdgeLoader{},
		edge,
	)
	b.SetRawFields(map[string]interface{}{
		"edge_type":         edge.EdgeType,
		"inverse_edge_type": edge.InverseEdgeType,
		"edge_table":        edge.EdgeTable,
		"edge_name":         edge.EdgeName,
		"symmetric_edge":    edge.SymmetricEdge,
	})
	SaveBuilder(t, b)
}

func GetUserBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	b := GetBaseBuilder(
		operation,
		models.NewUserLoader(viewer.LoggedOutViewer()),
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
	b.SetRawFields(fields)
	return b
}

func GetEventBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	b := GetBaseBuilder(
		operation,
		models.NewEventLoader(viewer.LoggedOutViewer()),
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
	b.SetRawFields(fields)
	return b
}

func GetContactBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	b := GetBaseBuilder(
		operation,
		models.NewContactLoader(viewer.LoggedOutViewer()),
		existingEnt,
	)
	return b
}

func GetAddressBuilder(
	operation ent.WriteOperation,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	b := GetBaseBuilder(
		operation,
		models.NewAddressLoader(viewer.LoggedOutViewer()),
		existingEnt,
	)
	return b
}

func SaveBuilder(t *testing.T, b ent.MutationBuilder) {
	c, err := b.GetChangeset()
	assert.Nil(t, err)
	err = ent.SaveChangeset(c)
	assert.Nil(t, err)
}

func SaveUser(t *testing.T, b ent.MutationBuilder) *models.User {
	SaveBuilder(t, b)
	if b.GetOperation() == ent.DeleteOperation {
		return nil
	}
	user, ok := b.Entity().(*models.User)
	assert.True(t, ok)
	return user
}

func SaveEvent(t *testing.T, b ent.MutationBuilder) *models.Event {
	SaveBuilder(t, b)
	if b.GetOperation() == ent.DeleteOperation {
		return nil
	}
	event, ok := b.Entity().(*models.Event)
	assert.True(t, ok)
	return event
}

func SaveContact(t *testing.T, b ent.MutationBuilder) *models.Contact {
	SaveBuilder(t, b)
	if b.GetOperation() == ent.DeleteOperation {
		return nil
	}
	contact, ok := b.Entity().(*models.Contact)
	assert.True(t, ok)
	return contact
}

func SaveAddress(t *testing.T, b ent.MutationBuilder) *models.Address {
	SaveBuilder(t, b)
	if b.GetOperation() == ent.DeleteOperation {
		return nil
	}
	address, ok := b.Entity().(*models.Address)
	assert.True(t, ok)
	return address
}

func GetDefaultUserBuilder(email string) *actions.EntMutationBuilder {
	pwd, err := util.GenerateRandPassword()
	if err != nil {
		util.GoSchemaKill(err)
	}

	return GetUserBuilderWithFields(
		ent.InsertOperation,
		nil,
		map[string]interface{}{
			"email_address": email,
			"password":      pwd,
			"first_name":    "Ola",
			"last_name":     "Okelola",
		},
	)
}

func GetDefaultEventFields(user *models.User) map[string]interface{} {
	return GetDefaultEventFieldsUserID(user.ID)
}

func GetDefaultEventFieldsUserID(userID string) map[string]interface{} {
	return map[string]interface{}{
		"name":       "Fun event",
		"user_id":    userID,
		"start_time": time.Now().UTC(),
		"location":   "fun location!",
	}
}
