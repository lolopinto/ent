//go:generate go run scripts/gqlgen.go -v
// this file requires copying to somewhere else or regenerating at everytime :(
package main

import (
	"context"

	"github.com/lolopinto/jarvis/models"
)

type Resolver struct{}

func (r *Resolver) Contact() ContactResolver {
	return &contactResolver{r}
}
func (r *Resolver) ContactEmail() ContactEmailResolver {
	return &contactEmailResolver{r}
}
func (r *Resolver) ContactPhoneNumber() ContactPhoneNumberResolver {
	return &contactPhoneNumberResolver{r}
}
func (r *Resolver) ContactDate() ContactDateResolver {
	return &contactDateResolver{r}
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
func (r *contactResolver) ContactEmails(ctx context.Context, obj *models.Contact) ([]*models.ContactEmail, error) {
	emails, err := obj.GetContactEmails()
	var list []*models.ContactEmail
	for idx := range emails {
		email := emails[idx]
		list = append(list, &email)
	}
	return list, err
}

func (r *contactResolver) ContactDates(ctx context.Context, obj *models.Contact) ([]*models.ContactDate, error) {
	dates, err := obj.GetContactDates()
	var list []*models.ContactDate
	for idx := range dates {
		date := dates[idx]
		list = append(list, &date)
	}
	return list, err
}

func (r *contactResolver) ContactPhoneNumbers(ctx context.Context, obj *models.Contact) ([]*models.ContactPhoneNumber, error) {
	phoneNumbers, err := obj.GetContactPhoneNumbers()
	var list []*models.ContactPhoneNumber
	for idx := range phoneNumbers {
		phoneNumber := phoneNumbers[idx]
		list = append(list, &phoneNumber)
	}
	return list, err
}

type contactEmailResolver struct{ *Resolver }

func (r *contactEmailResolver) Contact(ctx context.Context, obj *models.ContactEmail) (models.Contact, error) {
	return models.LoadContact(obj.ContactID)
}

type contactPhoneNumberResolver struct{ *Resolver }

func (r *contactPhoneNumberResolver) Contact(ctx context.Context, obj *models.ContactPhoneNumber) (models.Contact, error) {
	return models.LoadContact(obj.ContactID)
}

type contactDateResolver struct{ *Resolver }

func (r *contactDateResolver) Contact(ctx context.Context, obj *models.ContactDate) (models.Contact, error) {
	return models.LoadContact(obj.ContactID)
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) User(ctx context.Context, id *string) (*models.User, error) {
	user, err := models.LoadUser(*id)
	return &user, err
}

type userResolver struct{ *Resolver }

func (r *userResolver) Contacts(ctx context.Context, obj *models.User) ([]*models.Contact, error) {
	contacts, err := obj.GetContacts()
	var list []*models.Contact
	for idx := range contacts {
		contact := contacts[idx]
		list = append(list, &contact)
	}
	return list, err
}
