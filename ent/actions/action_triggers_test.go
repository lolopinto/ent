package actions_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type actionsTriggersSuite struct {
	testingutils.Suite
}

func (suite *actionsTriggersSuite) SetupSuite() {
	suite.Tables = []string{
		"events",
		"event_creator_edges",
		"event_hosts_edges",
		"users",
		"contacts",
		"contact_emails",
	}
	suite.Suite.SetupSuite()
}

func verifyLoadContacts(t *testing.T, user *models.User) {
	contacts, err := user.LoadContacts()
	assert.Nil(t, err)
	require.Len(t, contacts, 1)
	assert.Equal(t, contacts[0].UserID, user.ID)
}

func verifyLoadContactEmail(t *testing.T, user *models.User) {
	contacts, err := user.LoadContacts()
	contact := contacts[0]

	contactEmails, err := contact.LoadContactEmails()
	assert.Nil(t, err)
	require.Len(t, contactEmails, 1)
	assert.Equal(t, contactEmails[0].ContactID, contact.ID)
}

func verifyLoadEvents(t *testing.T, user *models.User) {
	events, err := user.LoadEvents()
	assert.Nil(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, events[0].UserID, user.ID)

	verifyEventCreationState(t, events[0], user)
}

func (suite *actionsTriggersSuite) TestAddEdgesInCreationTrigger() {
	user := testingutils.CreateTestUser(suite.T())
	testingutils.VerifyUserObj(suite.T(), user, user.EmailAddress)
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := eventCreateAction(v)

	event, err := action.Save()
	assert.Nil(suite.T(), err)

	verifyEventCreationState(suite.T(), event, user)
}

func (suite *actionsTriggersSuite) TestCreateDependentObjectInTrigger() {
	// create a user + contact as part of one mutation
	action := userCreateAction(viewer.LoggedOutViewer())
	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = util.GenerateRandEmail()
	var err error
	action.password, err = util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user, err := action.Save()
	assert.Nil(suite.T(), err)

	testingutils.VerifyUserObj(suite.T(), user, user.EmailAddress)

	// reload user because of privacy reasons
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), reloadedUser, user.EmailAddress)

	verifyLoadContacts(suite.T(), reloadedUser)
}

func (suite *actionsTriggersSuite) TestCreateDependentObjectInTrigger2() {
	// create a user,
	user := testingutils.CreateTestUser(suite.T())

	// then create contact + email to show that this action + trigger works on its own

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	action := &createContactAndEmailAction{}
	action.viewer = v
	loader := models.NewContactLoader(v)
	action.builder = actions.NewMutationBuilder(
		v,
		ent.InsertOperation,
		loader.GetNewContact(),
		loader.GetConfig(),
	)
	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = user.EmailAddress
	action.userID = user.ID
	contact, err := action.Save()
	assert.Nil(suite.T(), err)

	assert.NotZero(suite.T(), contact)
	assert.Equal(suite.T(), contact.UserID, user.ID)
	assert.Equal(suite.T(), contact.EmailAddress, user.EmailAddress)

	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)

	verifyLoadContacts(suite.T(), reloadedUser)
	verifyLoadContactEmail(suite.T(), reloadedUser)
}

func (suite *actionsTriggersSuite) TestCreateDependentObjectAndEdgesTrigger() {
	v := viewer.LoggedOutViewer()
	action := &createUserAndEventAction{}
	action.viewer = v
	action.builder = getUserCreateBuilder(v)
	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = util.GenerateRandEmail()
	var err error
	action.password, err = util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	err = actions.Save(action)
	assert.Nil(suite.T(), err)

	user := action.GetUser()

	testingutils.VerifyUserObj(suite.T(), action.GetUser(), user.EmailAddress)

	// reload user because of privacy reasons
	v = viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), reloadedUser, user.EmailAddress)

	verifyLoadEvents(suite.T(), reloadedUser)
}

func (suite *actionsTriggersSuite) TestMultiLevelDeep() {
	v := viewer.LoggedOutViewer()
	action := &createUserContactAndEmailAction{}
	action.viewer = v
	action.builder = getUserCreateBuilder(v)

	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = util.GenerateRandEmail()
	var err error
	action.password, err = util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	err = actions.Save(action)
	assert.Nil(suite.T(), err)

	user := action.GetUser()

	testingutils.VerifyUserObj(suite.T(), action.GetUser(), user.EmailAddress)

	// reload user because of privacy reasons
	v = viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), reloadedUser, user.EmailAddress)

	verifyLoadContacts(suite.T(), reloadedUser)
	verifyLoadContactEmail(suite.T(), reloadedUser)
}

func (suite *actionsTriggersSuite) TestCreateAllTheThingsTrigger() {
	v := viewer.LoggedOutViewer()
	action := &createUserAndAllTheThingsAction{}
	action.viewer = v
	action.builder = getUserCreateBuilder(v)

	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = util.GenerateRandEmail()
	var err error
	action.password, err = util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	err = actions.Save(action)
	assert.Nil(suite.T(), err)

	user := action.GetUser()

	testingutils.VerifyUserObj(suite.T(), action.GetUser(), user.EmailAddress)

	// reload user because of privacy reasons
	v = viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), reloadedUser, user.EmailAddress)

	verifyLoadEvents(suite.T(), reloadedUser)
	verifyLoadContacts(suite.T(), reloadedUser)
	verifyLoadContactEmail(suite.T(), reloadedUser)
}

func TestActionTriggers(t *testing.T) {
	suite.Run(t, new(actionsTriggersSuite))
}
