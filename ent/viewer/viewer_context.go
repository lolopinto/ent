package viewer

import (
	"context"
	"fmt"
	"net/http"
)

type contextKey struct {
	name string
}

var viewerCtxKey = &contextKey{"viewer"}

func ForContext(ctx context.Context) (ViewerContext, error) {
	val, ok := ctx.Value(viewerCtxKey).(ViewerContext)
	if !ok {
		return nil, fmt.Errorf("invalid viewer passed to context")
	}
	return val, nil
}

func NewRequestWithContext(r *http.Request, viewer ViewerContext) *http.Request {
	ctx := context.WithValue(r.Context(), viewerCtxKey, viewer)
	return r.WithContext(ctx)
}

// LoggedInEntity returns the identity of the logged in viewer
type LoggedInEntity interface {
	GetID() string
}

// ViewerContext interface is to be implemented by clients to indicate
// who's trying to view the ent
type ViewerContext interface {

	// GetViewer returns the identity of the logged in viewer. should return nil if logged out
	// TODO this should probably be (LoggedInEntity, error). hmm
	GetViewer() LoggedInEntity

	// GetViewerID returns the id of the logged in viewer.
	// It's provided as a convenience method and in case GetViewer() is expensive to compute
	GetViewerID() string
}

// LoggedOutViewerContext struct is the default ViewerContext provided by the ent framework
// It represents a viewer with no logged in identity
type LoggedOutViewerContext struct{}

// GetViewer returns the Logged in Viewer. For the LoggedOutViewerContext, this is nil
func (LoggedOutViewerContext) GetViewer() LoggedInEntity {
	return nil
}

// GetViewerID returns the ID of the logged in viewer
func (LoggedOutViewerContext) GetViewerID() string {
	return ""
}

// LoggedOutViewer returns an instance of LoggedOutViewerContext as the default Viewer in the ent framework
func LoggedOutViewer() ViewerContext {
	return LoggedOutViewerContext{}
}

// HasIdentity returns a boolean indicating if the viewer has an identity
func HasIdentity(v ViewerContext) bool {
	return v.GetViewerID() != ""
	// user := v.GetUser()
	// if user == nil {
	// 	return false
	// }
	// return user.GetID() != ""
}

// TODO kill this. This isn't generic enough
// Returns a boolean indicating if this user can see everything
// Needed for places without actual privacy checks or for admin tools
// or other such things
// rename to CanSeeAllContent()? OverridePrivacyChecks()?
// Or just have a second interface that's not necessary to mandate and do a typecheck on that
// ViewerContextWhichOverridesPrivacy
type OmniscientViewerContext interface {
	IsOmniscient() bool
}

// IsOmniscient is a convenient method indicating that
func IsOmniscient(v ViewerContext) bool {
	omni, ok := v.(OmniscientViewerContext)
	if !ok {
		return false
	}
	return omni.IsOmniscient()
}
