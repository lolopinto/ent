package auth

import "github.com/lolopinto/ent/internal/test_schema/models"

import "context"

import "errors"

// Authenticate authenticates a user/password combo
// @graphql authUser Query
func Authenticate(ctx context.Context, email string, password string) (user *models.User, token string, err error) {
	// all fake for now...
	if email == "test@email.com" && password == "123" {
		user, err := models.LoadUserFromContext(ctx, "1")
		if err != nil {
			return nil, "", err
		}
		return user, user.GetID(), nil
	}
	return nil, "", errors.New("logged out user")
}

// AuthMutation authenticates a user/password combo
// Assume we want a mutation for this
// @graphql authUser Mutation
// @graphqlreturn user
// @graphqlreturn token
func AuthMutation(ctx context.Context, email string, password string) (*models.User, string, error) {
	return Authenticate(ctx, email, password)
}
