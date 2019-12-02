// Code generated by github.com/99designs/gqlgen, DO NOT EDIT.

package graphql

import (
	"context"

	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/contact/action"
	action1 "github.com/lolopinto/ent/internal/test_schema/models/event/action"
	action2 "github.com/lolopinto/ent/internal/test_schema/models/user/action"
)

type Resolver struct{}

func (r *Resolver) Contact() ContactResolver {
	return &contactResolver{r}
}
func (r *Resolver) ContactEmail() ContactEmailResolver {
	return &contactEmailResolver{r}
}
func (r *Resolver) Event() EventResolver {
	return &eventResolver{r}
}
func (r *Resolver) Mutation() MutationResolver {
	return &mutationResolver{r}
}
func (r *Resolver) Query() QueryResolver {
	return &queryResolver{r}
}
func (r *Resolver) User() UserResolver {
	return &userResolver{r}
}

type contactResolver struct{ *Resolver }

func (r *contactResolver) AllowList(ctx context.Context, obj *models.Contact) ([]*models.User, error) {
	return obj.LoadAllowList()
}

func (r *contactResolver) ContactEmails(ctx context.Context, obj *models.Contact) ([]*models.ContactEmail, error) {
	return obj.LoadContactEmails()
}

type contactEmailResolver struct{ *Resolver }

func (r *contactEmailResolver) Contact(ctx context.Context, obj *models.ContactEmail) (*models.Contact, error) {
	return obj.LoadContact()
}

type eventResolver struct{ *Resolver }

func (r *eventResolver) Attending(ctx context.Context, obj *models.Event) ([]*models.User, error) {
	return obj.LoadAttending()
}

func (r *eventResolver) Creator(ctx context.Context, obj *models.Event) (*models.User, error) {
	return obj.LoadCreator()
}

func (r *eventResolver) Declined(ctx context.Context, obj *models.Event) ([]*models.User, error) {
	return obj.LoadDeclined()
}

func (r *eventResolver) Hosts(ctx context.Context, obj *models.Event) ([]*models.User, error) {
	return obj.LoadHosts()
}

func (r *eventResolver) Invited(ctx context.Context, obj *models.Event) ([]*models.User, error) {
	return obj.LoadInvited()
}

func (r *eventResolver) User(ctx context.Context, obj *models.Event) (*models.User, error) {
	return obj.LoadUser()
}

func (r *eventResolver) ViewerRsvpStatus(ctx context.Context, obj *models.Event) (*EventRsvpStatus, error) {
	enum, err := obj.ViewerRsvpStatusForGQL()
	if err != nil {
		return nil, err
	}
	// cast to enum that graphql resolve would have generated
	cast := EventRsvpStatus(*enum)
	return &cast, err
}

type mutationResolver struct{ *Resolver }

func (r *mutationResolver) ContactCreate(ctx context.Context, input ContactCreateInput) (*ContactCreateResponse, error) {
	node, err := action.CreateContactFromContext(ctx).
		SetEmailAddress(input.EmailAddress).
		SetFirstName(input.FirstName).
		SetLastName(input.LastName).
		SetUserID(input.UserID).
		SetNilableFavorite(input.Favorite).
		SetNilableNumberOfCalls(input.NumberOfCalls).
		SetNilablePi(input.Pi).
		Save()

	if err != nil {
		return nil, err
	}

	return &ContactCreateResponse{
		Contact: node,
	}, nil
}

func (r *mutationResolver) EventCreate(ctx context.Context, input EventCreateInput) (*EventCreateResponse, error) {
	node, err := action1.CreateEventFromContext(ctx).
		SetName(input.Name).
		SetUserID(input.UserID).
		SetStartTime(input.StartTime).
		SetNilableEndTime(input.EndTime).
		SetLocation(input.Location).
		Save()

	if err != nil {
		return nil, err
	}

	return &EventCreateResponse{
		Event: node,
	}, nil
}

func (r *mutationResolver) EventRsvpStatusEdit(ctx context.Context, input EventRsvpStatusEditInput) (*EventRsvpStatusEditResponse, error) {
	existingNode, err := models.LoadEventFromContext(ctx, input.EventID)
	if err != nil {
		return nil, err
	}

	node, err := action1.EditEventRsvpStatusFromContext(ctx, existingNode).
		AddRsvpStatus(input.RsvpStatus).
		AddUserID(input.UserID).
		Save()

	if err != nil {
		return nil, err
	}

	return &EventRsvpStatusEditResponse{
		Event: node,
	}, nil
}

func (r *mutationResolver) UserAddFamilyMembers(ctx context.Context, input UserAddFamilyMembersInput) (*UserAddFamilyMembersResponse, error) {
	existingNode, err := models.LoadUserFromContext(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	node, err := action2.AddFamilyMembersFromContext(ctx, existingNode).
		AddFamilyMembersID(input.FamilyMembersID).
		Save()

	if err != nil {
		return nil, err
	}

	return &UserAddFamilyMembersResponse{
		User: node,
	}, nil
}

func (r *mutationResolver) UserAddFriends(ctx context.Context, input UserAddFriendsInput) (*UserAddFriendsResponse, error) {
	existingNode, err := models.LoadUserFromContext(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	node, err := action2.AddFriendsFromContext(ctx, existingNode).
		AddFriendsID(input.FriendsID).
		Save()

	if err != nil {
		return nil, err
	}

	return &UserAddFriendsResponse{
		User: node,
	}, nil
}

func (r *mutationResolver) UserCreate(ctx context.Context, input UserCreateInput) (*UserCreateResponse, error) {
	node, err := action2.CreateUserFromContext(ctx).
		SetEmailAddress(input.EmailAddress).
		SetFirstName(input.FirstName).
		SetLastName(input.LastName).
		SetNilableBio(input.Bio).
		Save()

	if err != nil {
		return nil, err
	}

	return &UserCreateResponse{
		User: node,
	}, nil
}

func (r *mutationResolver) UserDelete(ctx context.Context, input UserDeleteInput) (*UserDeleteResponse, error) {
	existingNode, err := models.LoadUserFromContext(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	err = action2.DeleteUserFromContext(ctx, existingNode).
		Save()

	if err != nil {
		return nil, err
	}

	return &UserDeleteResponse{
		DeletedUserID: &existingNode.ID,
	}, nil
}

func (r *mutationResolver) UserEdit(ctx context.Context, input UserEditInput) (*UserEditResponse, error) {
	existingNode, err := models.LoadUserFromContext(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	node, err := action2.EditUserFromContext(ctx, existingNode).
		SetEmailAddress(input.EmailAddress).
		SetFirstName(input.FirstName).
		SetLastName(input.LastName).
		SetNilableBio(input.Bio).
		Save()

	if err != nil {
		return nil, err
	}

	return &UserEditResponse{
		User: node,
	}, nil
}

func (r *mutationResolver) UserRemoveFamilyMembers(ctx context.Context, input UserRemoveFamilyMembersInput) (*UserRemoveFamilyMembersResponse, error) {
	existingNode, err := models.LoadUserFromContext(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	node, err := action2.RemoveFamilyMembersFromContext(ctx, existingNode).
		AddFamilyMembersID(input.FamilyMembersID).
		Save()

	if err != nil {
		return nil, err
	}

	return &UserRemoveFamilyMembersResponse{
		User: node,
	}, nil
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) Contact(ctx context.Context, id string) (*models.Contact, error) {
	return models.LoadContactFromContext(ctx, id)
}

func (r *queryResolver) ContactEmail(ctx context.Context, id string) (*models.ContactEmail, error) {
	return models.LoadContactEmailFromContext(ctx, id)
}

func (r *queryResolver) Event(ctx context.Context, id string) (*models.Event, error) {
	return models.LoadEventFromContext(ctx, id)
}

func (r *queryResolver) User(ctx context.Context, id string) (*models.User, error) {
	return models.LoadUserFromContext(ctx, id)
}

type userResolver struct{ *Resolver }

func (r *userResolver) Contacts(ctx context.Context, obj *models.User) ([]*models.Contact, error) {
	return obj.LoadContacts()
}

func (r *userResolver) DeclinedEvents(ctx context.Context, obj *models.User) ([]*models.Event, error) {
	return obj.LoadDeclinedEvents()
}

func (r *userResolver) Events(ctx context.Context, obj *models.User) ([]*models.Event, error) {
	return obj.LoadEvents()
}

func (r *userResolver) EventsAttending(ctx context.Context, obj *models.User) ([]*models.Event, error) {
	return obj.LoadEventsAttending()
}

func (r *userResolver) FamilyMembers(ctx context.Context, obj *models.User) ([]*models.User, error) {
	return obj.LoadFamilyMembers()
}

func (r *userResolver) Friends(ctx context.Context, obj *models.User) ([]*models.User, error) {
	return obj.LoadFriends()
}

func (r *userResolver) InvitedEvents(ctx context.Context, obj *models.User) ([]*models.Event, error) {
	return obj.LoadInvitedEvents()
}
