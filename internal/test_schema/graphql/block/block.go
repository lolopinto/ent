package block

import "github.com/lolopinto/ent/internal/test_schema/models"

import "context"

// Block takes a user and blocks that user for the viewer
// @graphql viewerBlock Mutation
func Block(ctx context.Context, user *models.User) error {
	// function that takes a user and has the viewer block the other user
	return nil
}

// AdminBlock takes 2 users and blocks those users
// @graphql adminBlock Mutation
// TODO this doesn't work with names like user, user2 because the expected ids in resolver.go aren't userID, user2ID
// TODO fix.
func AdminBlock(ctx context.Context, blocker, blockee *models.User) error {
	return nil
}
