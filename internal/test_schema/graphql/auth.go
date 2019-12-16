package graphql

import "github.com/lolopinto/ent/internal/test_schema/models"

import "context"

import "errors"

// @graphql authUser Query
// TODO come back to support javadoc style things. for now depend on the return list of items
// only support returning existing ents/ or simple types...
// @graphqlparam
// @graphqlresult
func authenticate(ctx context.Context, email string, password string) (user *models.User, token string, err error) {
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
