// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package models

import (
	"context"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
	"golang.org/x/crypto/bcrypt"
)

const (
	// UserType is the node type for the User object. Used to identify this node in edges and other places.
	UserType ent.NodeType = "user"

	// UserToDeclinedEventsEdge is the edgeType for the user to declinedevents edge.
	UserToDeclinedEventsEdge ent.EdgeType = "14f2d5b4-d0fd-4088-ba25-e417ab40307c"
	// UserToEventsAttendingEdge is the edgeType for the user to eventsattending edge.
	UserToEventsAttendingEdge ent.EdgeType = "4afef8fc-f75a-406e-aafc-8b571980e6ef"
	// UserToEventsEdge is the edgeType for the user to events edge.
	UserToEventsEdge ent.EdgeType = "41bddf81-0c26-432c-9133-2f093af2c07c"
	// UserToFamilyMembersEdge is the edgeType for the user to familymembers edge.
	UserToFamilyMembersEdge ent.EdgeType = "38176101-6adc-4e0d-bd36-08cdc45f5ed2"
	// UserToFriendsEdge is the edgeType for the user to friends edge.
	UserToFriendsEdge ent.EdgeType = "d78d13dc-85d6-4f55-a72d-5dbcdc36131d"
	// UserToInvitedEventsEdge is the edgeType for the user to invitedevents edge.
	UserToInvitedEventsEdge ent.EdgeType = "e89302ca-c76b-41ad-a823-9e3964b821dd"
)

// User represents the `User` model
type User struct {
	ent.Node
	privacy.AlwaysDenyPrivacyPolicy
	Bio          *string `db:"bio"`
	EmailAddress string  `db:"email_address"`
	FirstName    string  `db:"first_name"`
	LastName     string  `db:"last_name"`
	password     string  `db:"password"`
	PhoneNumber  *string `db:"phone_number"`
	Viewer       viewer.ViewerContext
}

// UserResult stores the result of loading a User. It's a tuple type which has 2 fields:
// a User and an error
type UserResult struct {
	User *User
	Err  error
}

func (res *UserResult) Error() string {
	return res.Err.Error()
}

// UsersResult stores the result of loading a slice of Users. It's a tuple type which has 2 fields:
// a []*User and an error
type UsersResult struct {
	Users []*User
	Err   error
}

func (res *UsersResult) Error() string {
	return res.Err.Error()
}

// IsNode is needed by gqlgen to indicate that this implements the Node interface in GraphQL
func (user User) IsNode() {}

// GetType returns the NodeType of this entity. In this case: ContactType
func (user *User) GetType() ent.NodeType {
	return UserType
}

// GetViewer returns the viewer for this entity.
func (user *User) GetViewer() viewer.ViewerContext {
	return user.Viewer
}

// GetConfig returns the config for this entity.
func (user *User) GetConfig() ent.Config {
	return &configs.UserConfig{}
}

// LoadUserFromContext loads the given User given the context and id
func LoadUserFromContext(ctx context.Context, id string) (*User, error) {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		return nil, err
	}
	return LoadUser(v, id)
}

// GenLoadUserFromContext loads the given User given the context and id
func GenLoadUserFromContext(ctx context.Context, id string) <-chan *UserResult {
	res := make(chan *UserResult)
	go func() {
		v, err := viewer.ForContext(ctx)
		if err != nil {
			res <- &UserResult{
				Err: err,
			}
			return
		}
		res <- <-(GenLoadUser(v, id))
	}()
	return res
}

// LoadUser loads the given User given the viewer and id
func LoadUser(v viewer.ViewerContext, id string) (*User, error) {
	var user User
	err := ent.LoadNode(v, id, &user)
	return &user, err
}

// GenLoadUser loads the given User given the id
func GenLoadUser(v viewer.ViewerContext, id string) <-chan *UserResult {
	res := make(chan *UserResult)
	go func() {
		var result UserResult
		var user User
		result.Err = <-ent.GenLoadNode(v, id, &user)
		result.User = &user
		res <- &result
	}()
	return res
}

// LoadUsers loads multiple Users given the ids
func LoadUsers(v viewer.ViewerContext, ids ...string) ([]*User, error) {
	var users []*User
	err := ent.LoadNodes(v, ids, &users, &configs.UserConfig{})
	return users, err
}

// GenLoadUsers loads multiple Users given the ids
func GenLoadUsers(v viewer.ViewerContext, ids ...string) <-chan *UsersResult {
	res := make(chan *UsersResult)
	go func() {
		var result UsersResult
		errChan := make(chan error)
		go ent.GenLoadNodes(v, ids, &result.Users, &configs.UserConfig{}, errChan)
		result.Err = <-errChan
		res <- &result
	}()
	return res
}

func LoadUserIDFromEmailAddress(emailAddress string) (string, error) {
	// TODO this is a short term API that needs to be killed
	// since it shouldn't be possible to get an ent without privacy
	// change the underlying API to only return a map[string]interface{} or something else
	var user User
	err := ent.LoadNodeFromParts(&user, &configs.UserConfig{}, "email_address", emailAddress)
	if err != nil {
		return "", err
	}
	return user.ID, nil
}

func LoadUserIDFromPhoneNumber(phoneNumber string) (string, error) {
	// TODO this is a short term API that needs to be killed
	// since it shouldn't be possible to get an ent without privacy
	// change the underlying API to only return a map[string]interface{} or something else
	var user User
	err := ent.LoadNodeFromParts(&user, &configs.UserConfig{}, "phone_number", phoneNumber)
	if err != nil {
		return "", err
	}
	return user.ID, nil
}

func ValidateEmailPassword(emailAddress, password string) (string, error) {
	var user User
	err := ent.LoadNodeFromParts(&user, &configs.UserConfig{}, "email_address", emailAddress)
	if err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.password), []byte(password)); err != nil {
		return "", err
	}

	return user.ID, nil
}

// GenContacts returns the Contacts associated with the User instance
func (user *User) GenContacts() <-chan *ContactsResult {
	res := make(chan *ContactsResult)
	go func() {
		var result ContactsResult
		chanErr := make(chan error)
		go ent.GenLoadForeignKeyNodes(user.Viewer, user.ID, &result.Contacts, "user_id", &configs.ContactConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadContacts returns the Contacts associated with the User instance
func (user *User) LoadContacts() ([]*Contact, error) {
	var contacts []*Contact
	err := ent.LoadForeignKeyNodes(user.Viewer, user.ID, &contacts, "user_id", &configs.ContactConfig{})
	return contacts, err
}

// LoadEventsEdges returns the Events edges associated with the User instance
func (user *User) LoadEventsEdges() ([]*ent.AssocEdge, error) {
	return ent.LoadEdgesByType(user.ID, UserToEventsEdge)
}

// GenEventsEdges returns the Event edges associated with the User instance
func (user *User) GenEventsEdges() <-chan *ent.AssocEdgesResult {
	return ent.GenLoadEdgesByType(user.ID, UserToEventsEdge)
}

// GenEvents returns the Events associated with the User instance
func (user *User) GenEvents() <-chan *EventsResult {
	res := make(chan *EventsResult)
	go func() {
		var result EventsResult
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(user.Viewer, user.ID, UserToEventsEdge, &result.Events, &configs.EventConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadEvents returns the Events associated with the User instance
func (user *User) LoadEvents() ([]*Event, error) {
	var events []*Event
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToEventsEdge, &events, &configs.EventConfig{})
	return events, err
}

// LoadEventEdgeFor loads the ent.AssocEdge between the current node and the given id2 for the Events edge.
func (user *User) LoadEventEdgeFor(id2 string) (*ent.AssocEdge, error) {
	return ent.LoadEdgeByType(user.ID, id2, UserToEventsEdge)
}

// GenEventEdgeFor provides a concurrent API to load the ent.AssocEdge between the current node and the given id2 for the Events edge.
func (user *User) GenLoadEventEdgeFor(id2 string) <-chan *ent.AssocEdgeResult {
	return ent.GenLoadEdgeByType(user.ID, id2, UserToEventsEdge)
}

// LoadFamilyMembersEdges returns the FamilyMembers edges associated with the User instance
func (user *User) LoadFamilyMembersEdges() ([]*ent.AssocEdge, error) {
	return ent.LoadEdgesByType(user.ID, UserToFamilyMembersEdge)
}

// GenFamilyMembersEdges returns the User edges associated with the User instance
func (user *User) GenFamilyMembersEdges() <-chan *ent.AssocEdgesResult {
	return ent.GenLoadEdgesByType(user.ID, UserToFamilyMembersEdge)
}

// GenFamilyMembers returns the Users associated with the User instance
func (user *User) GenFamilyMembers() <-chan *UsersResult {
	res := make(chan *UsersResult)
	go func() {
		var result UsersResult
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(user.Viewer, user.ID, UserToFamilyMembersEdge, &result.Users, &configs.UserConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadFamilyMembers returns the Users associated with the User instance
func (user *User) LoadFamilyMembers() ([]*User, error) {
	var users []*User
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToFamilyMembersEdge, &users, &configs.UserConfig{})
	return users, err
}

// LoadFamilyMemberEdgeFor loads the ent.AssocEdge between the current node and the given id2 for the FamilyMembers edge.
func (user *User) LoadFamilyMemberEdgeFor(id2 string) (*ent.AssocEdge, error) {
	return ent.LoadEdgeByType(user.ID, id2, UserToFamilyMembersEdge)
}

// GenFamilyMemberEdgeFor provides a concurrent API to load the ent.AssocEdge between the current node and the given id2 for the FamilyMembers edge.
func (user *User) GenLoadFamilyMemberEdgeFor(id2 string) <-chan *ent.AssocEdgeResult {
	return ent.GenLoadEdgeByType(user.ID, id2, UserToFamilyMembersEdge)
}

// LoadFriendsEdges returns the Friends edges associated with the User instance
func (user *User) LoadFriendsEdges() ([]*ent.AssocEdge, error) {
	return ent.LoadEdgesByType(user.ID, UserToFriendsEdge)
}

// GenFriendsEdges returns the User edges associated with the User instance
func (user *User) GenFriendsEdges() <-chan *ent.AssocEdgesResult {
	return ent.GenLoadEdgesByType(user.ID, UserToFriendsEdge)
}

// GenFriends returns the Users associated with the User instance
func (user *User) GenFriends() <-chan *UsersResult {
	res := make(chan *UsersResult)
	go func() {
		var result UsersResult
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(user.Viewer, user.ID, UserToFriendsEdge, &result.Users, &configs.UserConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadFriends returns the Users associated with the User instance
func (user *User) LoadFriends() ([]*User, error) {
	var users []*User
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToFriendsEdge, &users, &configs.UserConfig{})
	return users, err
}

// LoadFriendEdgeFor loads the ent.AssocEdge between the current node and the given id2 for the Friends edge.
func (user *User) LoadFriendEdgeFor(id2 string) (*ent.AssocEdge, error) {
	return ent.LoadEdgeByType(user.ID, id2, UserToFriendsEdge)
}

// GenFriendEdgeFor provides a concurrent API to load the ent.AssocEdge between the current node and the given id2 for the Friends edge.
func (user *User) GenLoadFriendEdgeFor(id2 string) <-chan *ent.AssocEdgeResult {
	return ent.GenLoadEdgeByType(user.ID, id2, UserToFriendsEdge)
}

// LoadInvitedEventsEdges returns the InvitedEvents edges associated with the User instance
func (user *User) LoadInvitedEventsEdges() ([]*ent.AssocEdge, error) {
	return ent.LoadEdgesByType(user.ID, UserToInvitedEventsEdge)
}

// GenInvitedEventsEdges returns the Event edges associated with the User instance
func (user *User) GenInvitedEventsEdges() <-chan *ent.AssocEdgesResult {
	return ent.GenLoadEdgesByType(user.ID, UserToInvitedEventsEdge)
}

// GenInvitedEvents returns the Events associated with the User instance
func (user *User) GenInvitedEvents() <-chan *EventsResult {
	res := make(chan *EventsResult)
	go func() {
		var result EventsResult
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(user.Viewer, user.ID, UserToInvitedEventsEdge, &result.Events, &configs.EventConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadInvitedEvents returns the Events associated with the User instance
func (user *User) LoadInvitedEvents() ([]*Event, error) {
	var events []*Event
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToInvitedEventsEdge, &events, &configs.EventConfig{})
	return events, err
}

// LoadInvitedEventEdgeFor loads the ent.AssocEdge between the current node and the given id2 for the InvitedEvents edge.
func (user *User) LoadInvitedEventEdgeFor(id2 string) (*ent.AssocEdge, error) {
	return ent.LoadEdgeByType(user.ID, id2, UserToInvitedEventsEdge)
}

// GenInvitedEventEdgeFor provides a concurrent API to load the ent.AssocEdge between the current node and the given id2 for the InvitedEvents edge.
func (user *User) GenLoadInvitedEventEdgeFor(id2 string) <-chan *ent.AssocEdgeResult {
	return ent.GenLoadEdgeByType(user.ID, id2, UserToInvitedEventsEdge)
}

// LoadEventsAttendingEdges returns the EventsAttending edges associated with the User instance
func (user *User) LoadEventsAttendingEdges() ([]*ent.AssocEdge, error) {
	return ent.LoadEdgesByType(user.ID, UserToEventsAttendingEdge)
}

// GenEventsAttendingEdges returns the Event edges associated with the User instance
func (user *User) GenEventsAttendingEdges() <-chan *ent.AssocEdgesResult {
	return ent.GenLoadEdgesByType(user.ID, UserToEventsAttendingEdge)
}

// GenEventsAttending returns the Events associated with the User instance
func (user *User) GenEventsAttending() <-chan *EventsResult {
	res := make(chan *EventsResult)
	go func() {
		var result EventsResult
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(user.Viewer, user.ID, UserToEventsAttendingEdge, &result.Events, &configs.EventConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadEventsAttending returns the Events associated with the User instance
func (user *User) LoadEventsAttending() ([]*Event, error) {
	var events []*Event
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToEventsAttendingEdge, &events, &configs.EventConfig{})
	return events, err
}

// LoadEventsAttendingEdgeFor loads the ent.AssocEdge between the current node and the given id2 for the EventsAttending edge.
func (user *User) LoadEventsAttendingEdgeFor(id2 string) (*ent.AssocEdge, error) {
	return ent.LoadEdgeByType(user.ID, id2, UserToEventsAttendingEdge)
}

// GenEventsAttendingEdgeFor provides a concurrent API to load the ent.AssocEdge between the current node and the given id2 for the EventsAttending edge.
func (user *User) GenLoadEventsAttendingEdgeFor(id2 string) <-chan *ent.AssocEdgeResult {
	return ent.GenLoadEdgeByType(user.ID, id2, UserToEventsAttendingEdge)
}

// LoadDeclinedEventsEdges returns the DeclinedEvents edges associated with the User instance
func (user *User) LoadDeclinedEventsEdges() ([]*ent.AssocEdge, error) {
	return ent.LoadEdgesByType(user.ID, UserToDeclinedEventsEdge)
}

// GenDeclinedEventsEdges returns the Event edges associated with the User instance
func (user *User) GenDeclinedEventsEdges() <-chan *ent.AssocEdgesResult {
	return ent.GenLoadEdgesByType(user.ID, UserToDeclinedEventsEdge)
}

// GenDeclinedEvents returns the Events associated with the User instance
func (user *User) GenDeclinedEvents() <-chan *EventsResult {
	res := make(chan *EventsResult)
	go func() {
		var result EventsResult
		chanErr := make(chan error)
		go ent.GenLoadNodesByType(user.Viewer, user.ID, UserToDeclinedEventsEdge, &result.Events, &configs.EventConfig{}, chanErr)
		result.Err = <-chanErr
		res <- &result
	}()
	return res
}

// LoadDeclinedEvents returns the Events associated with the User instance
func (user *User) LoadDeclinedEvents() ([]*Event, error) {
	var events []*Event
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToDeclinedEventsEdge, &events, &configs.EventConfig{})
	return events, err
}

// LoadDeclinedEventEdgeFor loads the ent.AssocEdge between the current node and the given id2 for the DeclinedEvents edge.
func (user *User) LoadDeclinedEventEdgeFor(id2 string) (*ent.AssocEdge, error) {
	return ent.LoadEdgeByType(user.ID, id2, UserToDeclinedEventsEdge)
}

// GenDeclinedEventEdgeFor provides a concurrent API to load the ent.AssocEdge between the current node and the given id2 for the DeclinedEvents edge.
func (user *User) GenLoadDeclinedEventEdgeFor(id2 string) <-chan *ent.AssocEdgeResult {
	return ent.GenLoadEdgeByType(user.ID, id2, UserToDeclinedEventsEdge)
}

// DBFields is used by the ent framework to load the ent from the underlying database
func (user *User) DBFields() ent.DBFields {
	return ent.DBFields{
		"id": func(v interface{}) error {
			var err error
			user.ID, err = cast.ToUUIDString(v)
			return err
		},
		"bio": func(v interface{}) error {
			var err error
			user.Bio, err = cast.ToNullableString(v)
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
		"password": func(v interface{}) error {
			var err error
			user.password, err = cast.ToString(v)
			return err
		},
		"phone_number": func(v interface{}) error {
			var err error
			user.PhoneNumber, err = cast.ToNullableString(v)
			return err
		},
	}
}

// UnsupportedScan flags that we can't call StructScan() on the ent to get data out of the db, have to always use MapScan() and DBFields() method above
func (user *User) UnsupportedScan() bool {
	return true
}

var _ ent.Entity = &User{}
