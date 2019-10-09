package viewertesting

import "github.com/lolopinto/ent/ent/viewer"

type OmniViewerContext struct {
	viewer.LoggedOutViewerContext
}

func (OmniViewerContext) IsOmniscient() bool {
	return true
}

type LoggedinViewerContext struct {
	viewer.LoggedOutViewerContext
	ViewerID string
}

func (v LoggedinViewerContext) GetViewerID() string {
	if v.ViewerID != "" {
		return v.ViewerID
	}
	return "1"
}

func (LoggedinViewerContext) HasIdentity() bool {
	return true
}
