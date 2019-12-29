package block

import (
	"github.com/lolopinto/ent/internal/test_schema/graphql/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
)

import "context"

// Block takes a user and blocks that user for the viewer
// mutation returns the viewer
// @graphql viewerBlock Mutation
func Block(ctx context.Context, blockee *models.User) (*viewer.Viewer, error) {
	// function that takes a user and has the viewer block the other user
	return viewer.ViewerResolver(ctx)
}

// BlockParam takes a user and blocks that user for the viewer
// mutation returns the viewer
// @graphql viewerBlockParam Mutation
// @graphqlinputtype false
// @graphqlparam blockee user
// this shows it's possible to refactor the name here in GoLand from user -> blockee but keep the graphql field the same so as to not break clients
func BlockParam(ctx context.Context, blockee *models.User) (*viewer.Viewer, error) {
	// function that takes a user and has the viewer block the other user
	return viewer.ViewerResolver(ctx)
}

// BlockMultiple takes a list of users and blocks those users for the viewer
// @graphql viewerBlockMultiple Mutation
func BlockMultiple(ctx context.Context, users []*models.User) (*viewer.Viewer, error) {
	return viewer.ViewerResolver(ctx)
}

// BlockMultipleID takes a list of user ids and blocks those users for the viewer
// @graphql viewerBlockMultipleIDs Mutation
func BlockMultipleIDs(ctx context.Context, userIDs []string) (*viewer.Viewer, error) {
	return viewer.ViewerResolver(ctx)
}

// AdminBlock takes 2 users and blocks those users
// @graphql adminBlock Mutation
// TODO this doesn't work with names like user, user2 because the expected ids in resolver.go aren't userID, user2ID
// TODO fix.
func AdminBlock(ctx context.Context, blocker, blockee *models.User) error {
	return nil
}
