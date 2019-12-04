package privacy_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"

	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/stretchr/testify/assert"
)

func TestRules(t *testing.T) {
	var testCases = []struct {
		rule           ent.PrivacyPolicyRule
		viewer         viewer.ViewerContext
		expectedResult ent.PrivacyResult
		testCase       string
	}{
		// AlwaysAllowRule
		{
			privacy.AlwaysAllowRule{},
			viewer.LoggedOutViewer(),
			ent.Allow(),
			"AlwaysAllowRule with logged out viewer",
		},
		{
			privacy.AlwaysAllowRule{},
			viewertesting.OmniViewerContext{},
			ent.Allow(),
			"AlwaysAllowRule with omni viewer",
		},
		{
			privacy.AlwaysAllowRule{},
			viewertesting.LoggedinViewerContext{},
			ent.Allow(),
			"AlwaysAllowRule with logged in viewer",
		},

		// AlwaysDenyRule
		{
			privacy.AlwaysDenyRule{},
			viewer.LoggedOutViewer(),
			ent.Deny(),
			"AlwaysDenyRule with logged out viewer",
		},
		{
			privacy.AlwaysDenyRule{},
			viewertesting.OmniViewerContext{},
			ent.Deny(),
			"AlwaysDenyRule with omni viewer",
		},
		{
			privacy.AlwaysDenyRule{},
			viewertesting.LoggedinViewerContext{},
			ent.Deny(),
			"AlwaysDenyRule with logged in viewer",
		},

		// AllowIfOmniscientRule
		{
			privacy.AllowIfOmniscientRule{},
			viewer.LoggedOutViewer(),
			ent.Skip(),
			"AllowIfOmniscientRule with logged out viewer",
		},
		{
			privacy.AllowIfOmniscientRule{},
			viewertesting.OmniViewerContext{},
			ent.Allow(),
			"AllowIfOmniscientRule with omni viewer",
		},
		{
			privacy.AllowIfOmniscientRule{},
			viewertesting.LoggedinViewerContext{},
			ent.Skip(),
			"AllowIfOmniscientRule with logged in viewer",
		},

		// DenyIfLoggedOutRule
		{
			privacy.DenyIfLoggedOutRule{},
			viewer.LoggedOutViewer(),
			ent.Deny(),
			"DenyIfLoggedOutRule with logged out viewer",
		},
		{
			privacy.DenyIfLoggedOutRule{},
			viewertesting.OmniViewerContext{},
			ent.Deny(),
			"DenyIfLoggedOutRule with omni viewer",
		},
		{
			privacy.DenyIfLoggedOutRule{},
			viewertesting.LoggedinViewerContext{},
			ent.Skip(),
			"DenyIfLoggedOutRule with logged in viewer",
		},

		// AllowIfViewerIsOwnerRule
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewer.LoggedOutViewer(),
			ent.Skip(),
			"AllowIfViewerIsOwnerRule with out logged out viewer",
		},
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewertesting.OmniViewerContext{},
			ent.Skip(),
			"AllowIfViewerIsOwnerRule with omni viewer",
		},
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewertesting.LoggedinViewerContext{},
			ent.Allow(),
			"AllowIfViewerIsOwnerRule with logged in viewer",
		},
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewertesting.LoggedinViewerContext{ViewerID: "3"},
			ent.Skip(),
			"AllowIfViewerIsOwnerRule with different logged in viewer",
		},

		// AllowIfViewerRule
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewer.LoggedOutViewer(),
			ent.Skip(),
			"AllowIfViewerRule with out logged out viewer",
		},
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewertesting.OmniViewerContext{},
			ent.Skip(),
			"AllowIfViewerRule with omni viewer",
		},
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewertesting.LoggedinViewerContext{},
			ent.Allow(),
			"AllowIfViewerRule with logged in viewer",
		},
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewertesting.LoggedinViewerContext{ViewerID: "3"},
			ent.Skip(),
			"AllowIfViewerRule with different logged in viewer",
		},

		// TODO AllowIfClosureRule
	}

	user := models.User{EmailAddress: "ola@test.com"}
	user.ID = "1"

	for _, tt := range testCases {
		rule := tt.rule
		viewer := tt.viewer

		result := rule.Eval(viewer, &user)
		assert.Equal(t, tt.expectedResult, result, tt.testCase)
	}
}
