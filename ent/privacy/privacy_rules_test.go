package privacy

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/stretchr/testify/assert"
)

type simpleObj struct{}

func (obj *simpleObj) GetType() ent.NodeType {
	panic("whaa")
}

func (obj *simpleObj) GetPrivacyPolicy() ent.PrivacyPolicy {
	return simplePrivacyPolicy{}
}

type simplePrivacyPolicy struct{}

func (policy simplePrivacyPolicy) Rules() []ent.PrivacyPolicyRule {
	return []ent.PrivacyPolicyRule{
		// it actually doesn't require any rules for now so this is fine.
		// also, we only need this for interface purposes
	}
}

// manual for now until I figure out code generated and all that jazz
type testUser struct {
	simpleObj
	ent.Node
	EmailAddress string `db:"email_address"`
	Viewer       viewer.ViewerContext
}

func (user *testUser) DBFields() ent.DBFields {
	return ent.DBFields{
		"id": func(v interface{}) error {
			var err error
			user.ID, err = cast.ToUUIDString(v)
			return err
		},
		"email_address": func(v interface{}) error {
			var err error
			user.EmailAddress, err = cast.ToString(v)
			return err
		},
	}
}

type omniViewerContext struct {
	viewer.LoggedOutViewerContext
}

func (omniViewerContext) IsOmniscient() bool {
	return true
}

type loggedinViewerContext struct {
	viewer.LoggedOutViewerContext
	viewerID string
}

func (v loggedinViewerContext) GetViewerID() string {
	if v.viewerID != "" {
		return v.viewerID
	}
	return "1"
}

func (loggedinViewerContext) HasIdentity() bool {
	return true
}

func TestRules(t *testing.T) {
	var testCases = []struct {
		rule           ent.PrivacyPolicyRule
		viewer         viewer.ViewerContext
		expectedResult ent.PrivacyResult
		testCase       string
	}{
		// AlwasyAllowRule
		{
			AlwaysAllowRule{},
			viewer.LoggedOutViewer(),
			ent.AllowPrivacyResult,
			"AlwaysAllowRule with logged out viewer",
		},
		{
			AlwaysAllowRule{},
			omniViewerContext{},
			ent.AllowPrivacyResult,
			"AlwaysAllowRule with omni viewer",
		},
		{
			AlwaysAllowRule{},
			loggedinViewerContext{},
			ent.AllowPrivacyResult,
			"AlwaysAllowRule with logged in viewer",
		},

		// AlwaysDenyRule
		{
			AlwaysDenyRule{},
			viewer.LoggedOutViewer(),
			ent.DenyPrivacyResult,
			"AlwaysDenyRule with logged out viewer",
		},
		{
			AlwaysDenyRule{},
			omniViewerContext{},
			ent.DenyPrivacyResult,
			"AlwaysDenyRule with omni viewer",
		},
		{
			AlwaysDenyRule{},
			loggedinViewerContext{},
			ent.DenyPrivacyResult,
			"AlwaysDenyRule with logged in viewer",
		},

		// AllowIfOmniscientRule
		{
			AllowIfOmniscientRule{},
			viewer.LoggedOutViewer(),
			ent.SkipPrivacyResult,
			"AllowIfOmniscientRule with logged out viewer",
		},
		{
			AllowIfOmniscientRule{},
			omniViewerContext{},
			ent.AllowPrivacyResult,
			"AllowIfOmniscientRule with omni viewer",
		},
		{
			AllowIfOmniscientRule{},
			loggedinViewerContext{},
			ent.SkipPrivacyResult,
			"AllowIfOmniscientRule with logged in viewer",
		},

		// DenyIfLoggedOutRule
		{
			DenyIfLoggedOutRule{},
			viewer.LoggedOutViewer(),
			ent.DenyPrivacyResult,
			"DenyIfLoggedOutRule with logged out viewer",
		},
		{
			DenyIfLoggedOutRule{},
			omniViewerContext{},
			ent.DenyPrivacyResult,
			"DenyIfLoggedOutRule with omni viewer",
		},
		{
			DenyIfLoggedOutRule{},
			loggedinViewerContext{},
			ent.SkipPrivacyResult,
			"DenyIfLoggedOutRule with logged in viewer",
		},

		// AllowIfViewerIsOwnerRule
		{
			AllowIfViewerIsOwnerRule{OwnerID: "1"},
			viewer.LoggedOutViewer(),
			ent.SkipPrivacyResult,
			"AllowIfViewerIsOwnerRule with out logged out viewer",
		},
		{
			AllowIfViewerIsOwnerRule{OwnerID: "1"},
			omniViewerContext{},
			ent.SkipPrivacyResult,
			"AllowIfViewerIsOwnerRule with omni viewer",
		},
		{
			AllowIfViewerIsOwnerRule{OwnerID: "1"},
			loggedinViewerContext{},
			ent.AllowPrivacyResult,
			"AllowIfViewerIsOwnerRule with logged in viewer",
		},
		{
			AllowIfViewerIsOwnerRule{OwnerID: "1"},
			loggedinViewerContext{viewerID: "3"},
			ent.SkipPrivacyResult,
			"AllowIfViewerIsOwnerRule with different logged in viewer",
		},

		// AllowIfViewerRule
		{
			AllowIfViewerRule{EntID: "1"},
			viewer.LoggedOutViewer(),
			ent.SkipPrivacyResult,
			"AllowIfViewerRule with out logged out viewer",
		},
		{
			AllowIfViewerRule{EntID: "1"},
			omniViewerContext{},
			ent.SkipPrivacyResult,
			"AllowIfViewerRule with omni viewer",
		},
		{
			AllowIfViewerRule{EntID: "1"},
			loggedinViewerContext{},
			ent.AllowPrivacyResult,
			"AllowIfViewerRule with logged in viewer",
		},
		{
			AllowIfViewerRule{EntID: "1"},
			loggedinViewerContext{viewerID: "3"},
			ent.SkipPrivacyResult,
			"AllowIfViewerRule with different logged in viewer",
		},

		// TODO AllowIfClosureRule
		// TODO AllowIfEdgeExistsRule
	}

	user := testUser{EmailAddress: "ola@test.com"}
	user.ID = "1"

	for _, tt := range testCases {
		rule := tt.rule
		viewer := tt.viewer

		result := rule.Eval(viewer, &user)
		assert.Equal(t, tt.expectedResult, result, tt.testCase)
	}
}
