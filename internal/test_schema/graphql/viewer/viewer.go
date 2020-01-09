package viewer

import (
	"context"

	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
)

// ViewerResolver takes the context and returns the logged in viewer
// @graphql viewer Query
// @graphqlreturn viewer @required
func ViewerResolver(ctx context.Context) (*Viewer, error) {
	return newViewer(ctx)
}

// useless
type foo struct {
}

// Viewer is the object returned to GraphQL to encode the viewer
// @graphqltype Viewer
type Viewer struct {
	viewer viewer.ViewerContext

	// @graphql @required
	User *models.User
}

// newViewer takes a context and returns the Viewer object which is the root of what should be returned in GraphQL
func newViewer(ctx context.Context) (viewerr *Viewer, err error) {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		return nil, err
	}
	// preload user since we'll need it often.
	// Also you should be able to load yourself
	user, err := models.LoadUser(v, v.GetViewerID())
	if err != nil {
		return nil, err
	}
	return &Viewer{viewer: v, User: user}, nil
}

// LoadViewerContact returns the contact information of the viewer
// @graphql Contact
func (v *Viewer) LoadViewerContact() (contact *models.Contact, err error) {
	contacts, err := v.User.LoadContacts()
	if err != nil {
		return nil, err
	}
	for _, contact := range contacts {
		if contact.UserID == v.viewer.GetViewerID() {
			return contact, nil
		}
	}
	return nil, nil
}
