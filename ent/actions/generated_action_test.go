package actions_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"

	"github.com/lolopinto/ent/internal/test_schema/models"
	addressaction "github.com/lolopinto/ent/internal/test_schema/models/address/action"
	contactaction "github.com/lolopinto/ent/internal/test_schema/models/contact/action"
	eventaction "github.com/lolopinto/ent/internal/test_schema/models/event/action"
	"github.com/lolopinto/ent/internal/test_schema/models/user/action"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type generatedActionSuite struct {
	testingutils.Suite
}

func (suite *generatedActionSuite) SetupSuite() {
	suite.Tables = []string{
		"addresses",
		"users",
		"contacts",
		"event_creator_edges",
		"event_invited_edges",
		"events",
		"user_family_members_edges",
		"user_friends_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *generatedActionSuite) createUser() *models.User {
	v := viewer.LoggedOutViewer()

	email := util.GenerateRandEmail()

	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	user, err := action.CreateUser(v).
		SetEmailAddress(email).
		SetPassword(pwd).
		SetFirstName("Ola").
		SetLastName("Okelola").
		Save()

	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), user, email)
	assert.True(suite.T(), user.Bio == nil)
	return user
}

func (suite *generatedActionSuite) TestCreation() {
	// can successfully create user (and associated contact)
	// we're allowed to create contact because it's in the process of creating a user
	user := suite.createUser()

	// TODO zero vs nil
	require.NotEqual(suite.T(), user.ID, "")

	// reload the user for privacy reasons.
	// confirm that creating a user also creates the contact since UserCreateContactTrigger is part of this action
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)

	contacts, err := reloadedUser.LoadContacts()
	assert.Nil(suite.T(), err)
	assert.Len(suite.T(), contacts, 1)

	contact := contacts[0]

	assert.Equal(suite.T(), contact.UserID, reloadedUser.ID)
	assert.Equal(suite.T(), contact.FirstName, reloadedUser.FirstName)
	assert.Equal(suite.T(), contact.LastName, reloadedUser.LastName)
	assert.Equal(suite.T(), contact.EmailAddress, reloadedUser.EmailAddress)

	// observers logged these!
	testingutils.AssertEntLogged(suite.T(), user)
	testingutils.AssertEmailSent(suite.T(), user.EmailAddress, fmt.Sprintf("Hello %s, welcome to our magical website", user.FirstName))

	// even the nested contact object which was created via trigger was logged!
	testingutils.AssertEntLogged(suite.T(), contact)
}

func (suite *generatedActionSuite) TestCreationNilField() {
	v := viewer.LoggedOutViewer()

	email := util.GenerateRandEmail()
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	user, err := action.CreateUser(v).
		SetEmailAddress(email).
		SetPassword(pwd).
		SetFirstName("Ola").
		SetLastName("Okelola").
		SetBio("long bio").
		Save()

	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), user, email)
	assert.Equal(suite.T(), "long bio", *user.Bio)
}

func (suite *generatedActionSuite) TestCreationNotAllFields() {
	v := viewer.LoggedOutViewer()

	_, err := action.CreateUser(v).
		SetFirstName("Ola").
		SetLastName("Okelola").
		Save()

	assert.NotNil(suite.T(), err)
	assert.Error(suite.T(), err)
}

func (suite *generatedActionSuite) TestValidate() {
	v := viewer.LoggedOutViewer()

	action := action.CreateUser(v).
		SetFirstName("Ola").
		SetLastName("Okelola")

	// TODO validate is broken for invalid privacy...
	// this should also not work if getchangeset doesn't work
	err := action.Validate()
	assert.Error(suite.T(), err)

	action.SetEmailAddress(util.GenerateRandEmail())
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	action.SetPassword(pwd)

	err = action.Validate()
	assert.Nil(suite.T(), err)
}

func (suite *generatedActionSuite) TestGetChangeset() {
	v := viewer.LoggedOutViewer()

	action := action.CreateUser(v).
		SetFirstName("Ola").
		SetLastName("Okelola")

	// GetChangeset fails if invalid
	_, err := action.GetChangeset()
	assert.Error(suite.T(), err)

	action.SetEmailAddress(util.GenerateRandEmail())
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	action.SetPassword(pwd)

	c, err := action.GetChangeset()
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), c)
}

func (suite *generatedActionSuite) TestEditing() {
	user := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	editedUser, err := action.EditUser(v, user).
		SetFirstName("Ola2").
		Save()

	assert.Nil(suite.T(), err)
	assert.Equal(suite.T(), editedUser.EmailAddress, user.EmailAddress)
	assert.Equal(suite.T(), editedUser.FirstName, "Ola2")
	assert.Equal(suite.T(), editedUser.LastName, user.LastName)
}

func (suite *generatedActionSuite) TestEditingAddNilField() {
	user := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	editedUser, err := action.EditUser(v, user).
		SetBio("long bio").
		Save()

	assert.Nil(suite.T(), err)
	assert.Equal(suite.T(), editedUser.EmailAddress, user.EmailAddress)
	assert.Equal(suite.T(), editedUser.FirstName, user.FirstName)
	assert.Equal(suite.T(), editedUser.LastName, user.LastName)
	assert.Equal(suite.T(), *editedUser.Bio, "long bio")
}

func (suite *generatedActionSuite) TestEditingSetNillableFieldToNil() {
	user := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	editedUser, err := action.EditUser(v, user).
		SetBio("long bio").
		Save()

	assert.Nil(suite.T(), err)
	assert.Equal(suite.T(), *editedUser.Bio, "long bio")
	testingutils.VerifyUserObj(suite.T(), editedUser, user.EmailAddress)

	editedUser2, err := action.EditUser(v, editedUser).
		SetNilableBio(nil).
		Save()

	assert.Nil(suite.T(), err)
	assert.True(suite.T(), editedUser2.Bio == nil)
	testingutils.VerifyUserObj(suite.T(), editedUser2, user.EmailAddress)
}

func (suite *generatedActionSuite) TestDeleting() {
	user := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	err := action.DeleteUser(v, user).
		Save()

	assert.Nil(suite.T(), err)

	user2, err := models.LoadUser(v, user.ID)
	assert.NotNil(suite.T(), err)
	assert.Nil(suite.T(), user2)
}

func (suite *generatedActionSuite) TestAddEdgeAction() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	updatedUser, err := action.AddFriend(v, user).
		AddFriendID(user2.ID).
		Save()

	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), updatedUser, user.EmailAddress)

	testingutils.VerifyFriendsEdge(suite.T(), user, user2)
}

func (suite *generatedActionSuite) addFamilyEdge(v viewer.ViewerContext, user, user2 *models.User) {
	_, err := action.AddFamilyMember(v, user).
		AddFamilyMemberID(user2.ID).
		Save()

	assert.Nil(suite.T(), err)

	testingutils.VerifyFamilyEdge(suite.T(), user, user2)
}

func (suite *generatedActionSuite) TestRemoveEdgeAction() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	suite.addFamilyEdge(v, user, user2)

	updatedUser, err := action.RemoveFamilyMember(v, user).
		RemoveFamilyMemberID(user2.ID).
		Save()

	assert.Nil(suite.T(), err)
	testingutils.VerifyUserObj(suite.T(), updatedUser, user.EmailAddress)
	testingutils.VerifyNoFamilyEdge(suite.T(), user, user2)
}

func (suite *generatedActionSuite) TestInboundEdge() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	event, err := eventaction.CreateEvent(v).
		SetLocation("home").
		SetStartTime(time.Now()).
		SetEndTime(time.Now().Add(3 * time.Hour)).
		SetUserID(user.ID).
		SetName("fun event").
		Save()

	assert.Nil(suite.T(), err)
	assert.Equal(suite.T(), event.UserID, user.ID)

	reloadedUser, err := models.LoadUser(v, user.ID)
	assert.Nil(suite.T(), err)

	events, err := reloadedUser.LoadEvents()
	assert.Nil(suite.T(), err)
	assert.Len(suite.T(), events, 1)
	assert.Equal(suite.T(), events[0].ID, event.ID)

	edge, err := reloadedUser.LoadEventEdgeFor(event.ID)
	assert.Nil(suite.T(), err)

	// validate the edge data is as expected
	testingutils.VerifyEdge(suite.T(), &ent.AssocEdge{
		ID1:      user.ID,
		ID2:      event.ID,
		EdgeType: models.UserToEventsEdge,
		ID1Type:  user.GetType(),
		ID2Type:  event.GetType(),
	}, edge)
}

func (suite *generatedActionSuite) TestInboundEdgeBuilder() {
	v := viewer.LoggedOutViewer()
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	userAction := action.CreateUser(v).
		SetEmailAddress(util.GenerateRandEmail()).
		SetPassword(pwd).
		SetFirstName("Ola").
		SetLastName("Okelola")

	eventAction := eventaction.CreateEvent(v).
		SetLocation("home").
		SetStartTime(time.Now()).
		SetEndTime(time.Now().Add(3 * time.Hour)).
		SetUserIDBuilder(userAction.GetBuilder()).
		SetName("fun event")

	// manually combine the changesets. this would normally be done in a trigger
	changeset, err := actions.MultiChangesets(
		eventAction.GetChangeset,
		userAction.GetChangeset,
	)
	assert.Nil(suite.T(), err)

	err = ent.SaveChangeset(changeset)
	assert.Nil(suite.T(), err)

	// confirm that right object was created and relationship is as expected
	// depends on implementation detail from actions.MultiChangesets to get the Event.
	createdEnt := changeset.Entity()
	event, ok := createdEnt.(*models.Event)
	assert.True(suite.T(), ok)

	v = viewertesting.LoggedinViewerContext{ViewerID: event.UserID}
	reloadedUser, err := models.LoadUser(v, event.UserID)
	assert.Nil(suite.T(), err)

	events, err := reloadedUser.LoadEvents()
	assert.Nil(suite.T(), err)
	assert.Len(suite.T(), events, 1)
	assert.Equal(suite.T(), events[0].ID, event.GetID())
}

func (suite *generatedActionSuite) TestDefaultValueTime() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	action := eventaction.CreateEvent(v).
		SetLocation("home").
		SetStartTime(time.Now()).
		SetUserID(user.ID).
		SetName("fun event")

	t := action.GetTypedBuilder().GetEndTime()
	assert.True(suite.T(), t == nil)

	t2 := action.GetTypedBuilder().GetStartTime()
	assert.False(suite.T(), t2.IsZero())
}

func (suite *generatedActionSuite) TestValidator() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	event, err := eventaction.CreateEvent(v).
		SetLocation("home").
		SetStartTime(time.Now()).
		SetEndTime(time.Now().Add(1 * time.Hour)).
		SetUserID(user.ID).
		SetName("fun event").
		Save()

	assert.NoError(suite.T(), err)

	assert.False(suite.T(), event.EndTime == nil)
}

func (suite *generatedActionSuite) TestValidatorEndTimeInvalid() {
	user := testingutils.CreateTestUser(suite.T())
	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	_, err := eventaction.CreateEvent(v).
		SetLocation("home").
		SetStartTime(time.Now()).
		SetEndTime(time.Now().Add(-1 * time.Hour)).
		SetUserID(user.ID).
		SetName("fun event").
		Save()

	assert.Error(suite.T(), err)
}

func (suite *generatedActionSuite) TestEventRSVP() {
	user := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}

	testingutils.VerifyNoUserAttendingEventEdge(suite.T(), user, event)

	_, err := eventaction.EditEventRsvpStatus(v, event).
		// TODO this should be the enum...
		AddRsvpStatus("event_attending").
		AddUserID(user.ID).
		Save()

	assert.Nil(suite.T(), err)
	testingutils.VerifyUserAttendingEventEdge(suite.T(), user, event)
}

func getContactAction(v viewer.ViewerContext) *contactaction.CreateContactAction {
	return contactaction.CreateContact(v).
		SetFirstName("Jon").SetLastName("Snow").
		SetEmailAddress(util.GenerateRandEmail()).
		SetUserID(v.GetViewerID())
}

func createContact(v viewer.ViewerContext) (*models.Contact, error) {
	return getContactAction(v).Save()
}

func (suite *generatedActionSuite) TestActionPrivacy() {
	// cannot create contact while logged out
	v := viewer.LoggedOutViewer()

	contact, err := createContact(v)
	assert.NotNil(suite.T(), err)
	assert.IsType(suite.T(), &actions.ActionPermissionsError{}, err)
	assert.Nil(suite.T(), contact)

	user := testingutils.CreateTestUser(suite.T())
	// can create contact when logged in
	contact, err = createContact(viewertesting.LoggedinViewerContext{ViewerID: user.ID})
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), contact)
	assert.NotZero(suite.T(), *contact)
}

func (suite *generatedActionSuite) TestGetChangesetNoPermissions() {
	v := viewer.LoggedOutViewer()

	// GetChangeset fails as expected
	c, err := getContactAction(v).GetChangeset()
	assert.NotNil(suite.T(), err)
	assert.IsType(suite.T(), &actions.ActionPermissionsError{}, err)
	assert.Nil(suite.T(), c)

	user := testingutils.CreateTestUser(suite.T())
	v = viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	c, err = getContactAction(v).GetChangeset()

	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), c)
}

func (suite *generatedActionSuite) createAddress(v viewer.ViewerContext) *models.Address {
	address, err := addressaction.CreateAddress(v).
		SetStreetAddress("").
		SetCity("Westminster").
		SetState("London").
		SetZip("Sw1A 1AA").
		SetCountry("UK").
		SetResidentNames([]string{
			"The Queen",
			"Prince Phillip",
		}).Save()

	require.Nil(suite.T(), err)

	return address
}

func (suite *generatedActionSuite) TestActionWithFieldsMethod() {
	v := viewer.LoggedOutViewer()

	address := suite.createAddress(v)
	// TODO nil vs zero!
	assert.NotEqual(suite.T(), address.ID, "")
	assert.Equal(suite.T(), "London", address.State)
	assert.Len(suite.T(), address.ResidentNames, 2)
}

func (suite *generatedActionSuite) TestActionWithFieldsMethodMissingField() {
	v := viewer.LoggedOutViewer()

	_, err := addressaction.CreateAddress(v).
		SetStreetAddress("").
		SetCity("Westminster").
		SetState("London").
		SetZip("Sw1A 1AA").
		SetResidentNames([]string{
			"The Queen",
			"Prince Phillip",
		}).Save()

	require.Error(suite.T(), err)
}

func (suite *generatedActionSuite) TestEditActionWithFieldsMethod() {
	v := viewer.LoggedOutViewer()

	address := suite.createAddress(v)
	assert.Equal(suite.T(), address.StreetAddress, "")

	address, err := addressaction.EditAddress(v, address).
		SetStreetAddress("Buckingham Palace Road").
		Save()

	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), address.StreetAddress, "Buckingham Palace Road")
}

func TestGeneratedAction(t *testing.T) {
	suite.Run(t, new(generatedActionSuite))
}
