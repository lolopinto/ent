package viewertesting

import (
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
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
	user := &models.User{}
	user.ID = v.GetViewerID()
	return user
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
