package privacy_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"

	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
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
			ent.AllowPrivacyResult,
			"AlwaysAllowRule with logged out viewer",
		},
		{
			privacy.AlwaysAllowRule{},
			viewertesting.OmniViewerContext{},
			ent.AllowPrivacyResult,
			"AlwaysAllowRule with omni viewer",
		},
		{
			privacy.AlwaysAllowRule{},
			viewertesting.LoggedinViewerContext{},
			ent.AllowPrivacyResult,
			"AlwaysAllowRule with logged in viewer",
		},

		// AlwaysDenyRule
		{
			privacy.AlwaysDenyRule{},
			viewer.LoggedOutViewer(),
			ent.DenyPrivacyResult,
			"AlwaysDenyRule with logged out viewer",
		},
		{
			privacy.AlwaysDenyRule{},
			viewertesting.OmniViewerContext{},
			ent.DenyPrivacyResult,
			"AlwaysDenyRule with omni viewer",
		},
		{
			privacy.AlwaysDenyRule{},
			viewertesting.LoggedinViewerContext{},
			ent.DenyPrivacyResult,
			"AlwaysDenyRule with logged in viewer",
		},

		// AllowIfOmniscientRule
		{
			privacy.AllowIfOmniscientRule{},
			viewer.LoggedOutViewer(),
			ent.SkipPrivacyResult,
			"AllowIfOmniscientRule with logged out viewer",
		},
		{
			privacy.AllowIfOmniscientRule{},
			viewertesting.OmniViewerContext{},
			ent.AllowPrivacyResult,
			"AllowIfOmniscientRule with omni viewer",
		},
		{
			privacy.AllowIfOmniscientRule{},
			viewertesting.LoggedinViewerContext{},
			ent.SkipPrivacyResult,
			"AllowIfOmniscientRule with logged in viewer",
		},

		// DenyIfLoggedOutRule
		{
			privacy.DenyIfLoggedOutRule{},
			viewer.LoggedOutViewer(),
			ent.DenyPrivacyResult,
			"DenyIfLoggedOutRule with logged out viewer",
		},
		{
			privacy.DenyIfLoggedOutRule{},
			viewertesting.OmniViewerContext{},
			ent.DenyPrivacyResult,
			"DenyIfLoggedOutRule with omni viewer",
		},
		{
			privacy.DenyIfLoggedOutRule{},
			viewertesting.LoggedinViewerContext{},
			ent.SkipPrivacyResult,
			"DenyIfLoggedOutRule with logged in viewer",
		},

		// AllowIfViewerIsOwnerRule
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewer.LoggedOutViewer(),
			ent.SkipPrivacyResult,
			"AllowIfViewerIsOwnerRule with out logged out viewer",
		},
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewertesting.OmniViewerContext{},
			ent.SkipPrivacyResult,
			"AllowIfViewerIsOwnerRule with omni viewer",
		},
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewertesting.LoggedinViewerContext{},
			ent.AllowPrivacyResult,
			"AllowIfViewerIsOwnerRule with logged in viewer",
		},
		{
			privacy.AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewertesting.LoggedinViewerContext{ViewerID: "3"},
			ent.SkipPrivacyResult,
			"AllowIfViewerIsOwnerRule with different logged in viewer",
		},

		// AllowIfViewerRule
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewer.LoggedOutViewer(),
			ent.SkipPrivacyResult,
			"AllowIfViewerRule with out logged out viewer",
		},
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewertesting.OmniViewerContext{},
			ent.SkipPrivacyResult,
			"AllowIfViewerRule with omni viewer",
		},
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewertesting.LoggedinViewerContext{},
			ent.AllowPrivacyResult,
			"AllowIfViewerRule with logged in viewer",
		},
		{
			privacy.AllowIfViewerRule{EntID: "1"},
			viewertesting.LoggedinViewerContext{ViewerID: "3"},
			ent.SkipPrivacyResult,
			"AllowIfViewerRule with different logged in viewer",
		},

		// TODO AllowIfClosureRule
		// TODO AllowIfEdgeExistsRule
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
