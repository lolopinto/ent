// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package models

import (
	"context"
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/sql"
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

type Users map[string]*User

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

// userLoader is an ent.PrivacyBackedLoader which is used to
// load User
type userLoader struct {
	nodes   map[string]*User
	errs    map[string]error
	results []*User
	v       viewer.ViewerContext
	m       sync.Mutex
}

func (res *userLoader) GetNewInstance() ent.DBObject {
	var user User
	user.Viewer = res.v
	return &user
}

func (res *userLoader) GetConfig() ent.Config {
	return &configs.UserConfig{}
}

func (res *userLoader) SetPrivacyResult(id string, obj ent.DBObject, err error) {
	res.m.Lock()
	defer res.m.Unlock()
	if err != nil {
		res.errs[id] = err
	} else if obj != nil {
		// TODO kill results?
		ent := obj.(*User)
		res.nodes[id] = ent
		res.results = append(res.results, ent)
	}
}

func (res *userLoader) GetEntForID(id string) *User {
	return res.nodes[id]
}

// hmm make private...
func (res *userLoader) List() []*User {
	return res.results
}

func (res *userLoader) getFirstInstance() *User {
	if len(res.results) == 0 {
		return nil
	}
	return res.results[0]
}

func (res *userLoader) getFirstErr() error {
	for _, err := range res.errs {
		return err
	}
	return nil
}

// NewUserLoader returns a new userLoader which is used to load one or more Users
func NewUserLoader(v viewer.ViewerContext) *userLoader {
	return &userLoader{
		nodes: make(map[string]*User),
		errs:  make(map[string]error),
		v:     v,
	}
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
	loader := NewUserLoader(v)
	err := ent.LoadNode(v, id, loader)
	return loader.nodes[id], err
}

// GenLoadUser loads the given User given the id
func GenLoadUser(v viewer.ViewerContext, id string) <-chan *UserResult {
	res := make(chan *UserResult)
	go func() {
		var result UserResult
		loader := NewUserLoader(v)
		result.Err = <-ent.GenLoadNode(v, id, loader)
		result.User = loader.nodes[id]
		res <- &result
	}()
	return res
}

// LoadUsers loads multiple Users given the ids
func LoadUsers(v viewer.ViewerContext, ids ...string) ([]*User, error) {
	loader := NewUserLoader(v)
	err := ent.LoadNodes(v, ids, loader)
	return loader.results, err
}

// GenLoadUsers loads multiple Users given the ids
func GenLoadUsers(v viewer.ViewerContext, ids ...string) <-chan *UsersResult {
	res := make(chan *UsersResult)
	go func() {
		loader := NewUserLoader(v)
		var result UsersResult
		result.Err = <-ent.GenLoadNodes(v, ids, loader)
		result.Users = loader.results
		res <- &result
	}()
	return res
}

func LoadUserIDFromEmailAddress(emailAddress string) (string, error) {
	loader := NewUserLoader(viewer.LoggedOutViewer())
	data, err := ent.LoadNodeRawDataViaQueryClause(
		loader,
		sql.Eq("email_address", emailAddress),
	)
	if err != nil {
		return "", err
	}
	return cast.ToUUIDString(data["id"])
}

func LoadUserFromEmailAddress(v viewer.ViewerContext, emailAddress string) (*User, error) {
	loader := NewUserLoader(v)
	err := ent.LoadNodesViaQueryClause(v, loader, sql.Eq("email_address", emailAddress))
	if err != nil {
		return nil, err
	}
	return loader.getFirstInstance(), loader.getFirstErr()
}

func LoadUserIDFromPhoneNumber(phoneNumber string) (string, error) {
	loader := NewUserLoader(viewer.LoggedOutViewer())
	data, err := ent.LoadNodeRawDataViaQueryClause(
		loader,
		sql.Eq("phone_number", phoneNumber),
	)
	if err != nil {
		return "", err
	}
	return cast.ToUUIDString(data["id"])
}

func LoadUserFromPhoneNumber(v viewer.ViewerContext, phoneNumber string) (*User, error) {
	loader := NewUserLoader(v)
	err := ent.LoadNodesViaQueryClause(v, loader, sql.Eq("phone_number", phoneNumber))
	if err != nil {
		return nil, err
	}
	return loader.getFirstInstance(), loader.getFirstErr()
}

func ValidateEmailPassword(emailAddress, password string) (string, error) {
	loader := NewUserLoader(viewer.LoggedOutViewer())
	data, err := ent.LoadNodeRawDataViaQueryClause(
		loader,
		sql.Eq("email_address", emailAddress),
	)
	if err != nil {
		return "", err
	}
	storedHashedPassword, err := cast.ToString(data["password"])
	if err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHashedPassword), []byte(password)); err != nil {
		return "", err
	}

	return cast.ToUUIDString(data["id"])
}

// GenContacts returns the Contacts associated with the User instance
func (user *User) GenContacts() <-chan *ContactsResult {
	res := make(chan *ContactsResult)
	go func() {
		loader := NewContactLoader(user.Viewer)
		var result ContactsResult
		result.Err = <-ent.GenLoadNodesViaQueryClause(user.Viewer, loader, sql.Eq("user_id", user.ID))
		result.Contacts = loader.results
		res <- &result
	}()
	return res
}

// LoadContacts returns the Contacts associated with the User instance
func (user *User) LoadContacts() ([]*Contact, error) {
	loader := NewContactLoader(user.Viewer)
	err := ent.LoadNodesViaQueryClause(user.Viewer, loader, sql.Eq("user_id", user.ID))
	return loader.results, err
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
		loader := NewEventLoader(user.Viewer)
		var result EventsResult
		result.Err = <-ent.GenLoadNodesByType(user.Viewer, user.ID, UserToEventsEdge, loader)
		result.Events = loader.results
		res <- &result
	}()
	return res
}

// LoadEvents returns the Events associated with the User instance
func (user *User) LoadEvents() ([]*Event, error) {
	loader := NewEventLoader(user.Viewer)
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToEventsEdge, loader)
	return loader.results, err
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
		loader := NewUserLoader(user.Viewer)
		var result UsersResult
		result.Err = <-ent.GenLoadNodesByType(user.Viewer, user.ID, UserToFamilyMembersEdge, loader)
		result.Users = loader.results
		res <- &result
	}()
	return res
}

// LoadFamilyMembers returns the Users associated with the User instance
func (user *User) LoadFamilyMembers() ([]*User, error) {
	loader := NewUserLoader(user.Viewer)
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToFamilyMembersEdge, loader)
	return loader.results, err
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
		loader := NewUserLoader(user.Viewer)
		var result UsersResult
		result.Err = <-ent.GenLoadNodesByType(user.Viewer, user.ID, UserToFriendsEdge, loader)
		result.Users = loader.results
		res <- &result
	}()
	return res
}

// LoadFriends returns the Users associated with the User instance
func (user *User) LoadFriends() ([]*User, error) {
	loader := NewUserLoader(user.Viewer)
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToFriendsEdge, loader)
	return loader.results, err
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
		loader := NewEventLoader(user.Viewer)
		var result EventsResult
		result.Err = <-ent.GenLoadNodesByType(user.Viewer, user.ID, UserToInvitedEventsEdge, loader)
		result.Events = loader.results
		res <- &result
	}()
	return res
}

// LoadInvitedEvents returns the Events associated with the User instance
func (user *User) LoadInvitedEvents() ([]*Event, error) {
	loader := NewEventLoader(user.Viewer)
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToInvitedEventsEdge, loader)
	return loader.results, err
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
		loader := NewEventLoader(user.Viewer)
		var result EventsResult
		result.Err = <-ent.GenLoadNodesByType(user.Viewer, user.ID, UserToEventsAttendingEdge, loader)
		result.Events = loader.results
		res <- &result
	}()
	return res
}

// LoadEventsAttending returns the Events associated with the User instance
func (user *User) LoadEventsAttending() ([]*Event, error) {
	loader := NewEventLoader(user.Viewer)
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToEventsAttendingEdge, loader)
	return loader.results, err
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
		loader := NewEventLoader(user.Viewer)
		var result EventsResult
		result.Err = <-ent.GenLoadNodesByType(user.Viewer, user.ID, UserToDeclinedEventsEdge, loader)
		result.Events = loader.results
		res <- &result
	}()
	return res
}

// LoadDeclinedEvents returns the Events associated with the User instance
func (user *User) LoadDeclinedEvents() ([]*Event, error) {
	loader := NewEventLoader(user.Viewer)
	err := ent.LoadNodesByType(user.Viewer, user.ID, UserToDeclinedEventsEdge, loader)
	return loader.results, err
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
		"created_at": func(v interface{}) error {
			var err error
			user.CreatedAt, err = cast.ToTime(v)
			return err
		},
		"updated_at": func(v interface{}) error {
			var err error
			user.UpdatedAt, err = cast.ToTime(v)
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
