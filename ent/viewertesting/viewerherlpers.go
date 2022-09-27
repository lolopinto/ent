package viewertesting

import (
	"github.com/lolopinto/ent/ent/viewer"
)

type OmniViewerContext struct {
	viewer.LoggedOutViewerContext
}

func (OmniViewerContext) IsOmniscient() bool {
	return true
}

type LoggedinViewerContext struct {
	ViewerID string
}

func (v LoggedinViewerContext) GetViewer() viewer.LoggedInEntity {
	panic("invalid call to LoggedinViewerContext.GetViewer")
}

func (v LoggedinViewerContext) GetViewerID() string {
	if v.ViewerID != "" {
		return v.ViewerID
	}
	return "1"
}

func GetLoggedInViewer(viewerID string) (viewer.ViewerContext, error) {
	return LoggedinViewerContext{ViewerID: viewerID}, nil
}
