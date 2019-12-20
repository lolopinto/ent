package block

import "github.com/lolopinto/ent/internal/test_schema/models"

import "context"

// Block takes a user and blocks that user for the viewer
// @graphql viewerBlock Mutation
func Block(ctx context.Context, user *models.User) (viewerr *models.User, err error) {
	// function that takes a user and has the viewer block the other user
	// make block return a "user". in an ideal world this will return the viewer. TODO
	return user, nil
}

// BlockMultiple takes a list of users and blocks those users for the viewer
// @graphql viewerBlockMultiple Mutation
func BlockMultiple(ctx context.Context, users []*models.User) error {
	return nil
}

// BlockMultipleID takes a list of user ids and blocks those users for the viewer
// @graphql viewerBlockMultipleIDs Mutation
func BlockMultipleIDs(ctx context.Context, userIDs []string) error {
	return nil
}

// AdminBlock takes 2 users and blocks those users
// @graphql adminBlock Mutation
// TODO this doesn't work with names like user, user2 because the expected ids in resolver.go aren't userID, user2ID
// TODO fix.
func AdminBlock(ctx context.Context, blocker, blockee *models.User) error {
	return nil
}
