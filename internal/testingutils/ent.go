package testingutils

import (
	"testing"
	"time"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
)

func CreateTestUser(t *testing.T) *models.User {
	return SaveUser(t, GetDefaultUserBuilder(util.GenerateRandEmail()))
}

func CreateTestUserWithEmail(t *testing.T, email string) *models.User {
	return SaveUser(t, GetDefaultUserBuilder(email))
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
	// this will be automatically added my generated builders
	b.AddInboundEdge(models.UserToEventsEdge, user.ID, user.GetType())
	return SaveEvent(t, b)
}

func CreateTestContact(t *testing.T, user *models.User, allowList ...*models.User) *models.Contact {
	var contact models.Contact

	b := GetBaseBuilder(
		ent.InsertOperation,
		&configs.ContactConfig{},
		nil,
	)
	setFields(b, map[string]interface{}{
		"EmailAddress": util.GenerateRandEmail(),
		"UserID":       user.ID,
		"FirstName":    "first-name",
		"LastName":     "last-name",
	})
	for _, user := range allowList {
		b.AddOutboundEdge(models.ContactToAllowListEdge, user.ID, user.GetType())
	}
	SaveBuilder(t, b, &contact)
	return &contact
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
	return map[string]interface{}{
		"Name":      "Fun event",
		"UserID":    user.ID,
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
