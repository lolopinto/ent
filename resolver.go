package main

import (
	"context"
	"fmt"

	"github.com/lolopinto/jarvis/models"
)

type Resolver struct{}

func (r *Resolver) Contact() ContactResolver {
	return &contactResolver{r}
}
func (r *Resolver) ContactDate() ContactDateResolver {
	return &contactDateResolver{r}
}
func (r *Resolver) ContactEmail() ContactEmailResolver {
	return &contactEmailResolver{r}
}
func (r *Resolver) ContactPhoneNumber() ContactPhoneNumberResolver {
	return &contactPhoneNumberResolver{r}
}
func (r *Resolver) Note() NoteResolver {
	return &noteResolver{r}
}
func (r *Resolver) Query() QueryResolver {
	return &queryResolver{r}
}
func (r *Resolver) User() UserResolver {
	return &userResolver{r}
}

type contactResolver struct{ *Resolver }

func (r *contactResolver) User(ctx context.Context, obj *models.Contact) (models.User, error) {
	return models.LoadUser(obj.UserID)
}
func (r *contactResolver) ContactEmails(ctx context.Context, obj *models.Contact) ([]models.ContactEmail, error) {
	return obj.GetContactEmails()
}
func (r *contactResolver) ContactDates(ctx context.Context, obj *models.Contact) ([]models.ContactDate, error) {
	return obj.GetContactDates()
}
func (r *contactResolver) ContactPhoneNumbers(ctx context.Context, obj *models.Contact) ([]models.ContactPhoneNumber, error) {
	return obj.GetContactPhoneNumbers()
}

type contactDateResolver struct{ *Resolver }

func (r *contactDateResolver) Contact(ctx context.Context, obj *models.ContactDate) (models.Contact, error) {
	return models.LoadContact(obj.ContactID)
}

type contactEmailResolver struct{ *Resolver }

func (r *contactEmailResolver) Contact(ctx context.Context, obj *models.ContactEmail) (models.Contact, error) {
	return models.LoadContact(obj.ContactID)
}

type contactPhoneNumberResolver struct{ *Resolver }

func (r *contactPhoneNumberResolver) Contact(ctx context.Context, obj *models.ContactPhoneNumber) (models.Contact, error) {
	return models.LoadContact(obj.ContactID)
}

type noteResolver struct{ *Resolver }

func (r *noteResolver) Owner(ctx context.Context, obj *models.Note) (models.User, error) {
	return models.LoadUser(obj.OwnerID)
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) User(ctx context.Context, id *string) (*models.User, error) {
	user, err := models.LoadUser(*id)
	return &user, err
}

type userResolver struct{ *Resolver }

func (r *userResolver) Contacts(ctx context.Context, obj *models.User) ([]models.Contact, error) {
	return obj.GetContacts()
}
func (r *userResolver) ContactsConnection(ctx context.Context, obj *models.User, first *int, after *string) (ContactsConnection, error) {
	contacts, err := obj.GetContacts()
	if err != nil {
		return ContactsConnection{}, err
	}
	return ContactsConnection{
		Nodes:      contacts,
		TotalCount: len(contacts),
		Edges:      make([]ContactsEdge, len(contacts)), // TODO these 2
		PageInfo:   PageInfo{},
	}, nil
}
func (r *userResolver) Notes(ctx context.Context, obj *models.User) ([]models.Note, error) {
	return obj.GetNotes()
}
func (r *userResolver) NotesConnection(ctx context.Context, obj *models.User, first *int, after *string) (NotesConnection, error) {
	notes, err := obj.GetNotes()
	if err != nil {
		return NotesConnection{}, err
	}
	// TODO this.
	// TODO also have to build connections in a way that we don't load
	// the notes until it's needed
	fmt.Println(ctx)
	return NotesConnection{
		Nodes:      notes,
		TotalCount: len(notes),
		Edges:      make([]NotesEdge, len(notes)), // TODO these 2
		PageInfo:   PageInfo{},
	}, nil
}
