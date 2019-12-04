package privacy_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/stretchr/testify/assert"
)

type baseUser struct {
	ent.Node
	EmailAddress string
	Name         string
	Viewer       viewer.ViewerContext
}

func (user *baseUser) DBFields() ent.DBFields {
	// doesn't matter...
	return ent.DBFields{}
}

func (user *baseUser) GetID() string {
	return user.ID
}

func (user *baseUser) GetType() ent.NodeType {
	return ent.NodeType("user")
}

func (user *baseUser) GetViewer() viewer.ViewerContext {
	return user.Viewer
}

type alwaysAllowUser struct {
	baseUser
	privacy.AlwaysAllowPrivacyPolicy
}

var _ ent.Entity = &alwaysAllowUser{}

type alwaysDenyUser struct {
	baseUser
	privacy.AlwaysDenyPrivacyPolicy
}

var _ ent.Entity = &alwaysDenyUser{}

type alwaysPanicUser struct {
	baseUser
	privacy.AlwaysPanicPrivacyPolicy
}

var _ ent.Entity = &alwaysPanicUser{}

type userWithCustomPrivacy struct {
	baseUser
	privacy.AlwaysPanicPrivacyPolicy
}

// can override the privacy policy for as needed when the default doesn't suffice
func (user *userWithCustomPrivacy) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			privacy.DenyIfLoggedOutRule{},
			privacy.AlwaysAllowRule{},
		},
	}
}

type policyTestCase struct {
	viewer   viewer.ViewerContext
	testCase string
}

func getDefaultPolicyTestCases() []policyTestCase {
	return []policyTestCase{
		{
			viewer.LoggedOutViewer(),
			"logged out viewer",
		},
		{
			viewertesting.OmniViewerContext{},
			"omni viewer",
		},
		{
			viewertesting.LoggedinViewerContext{},
			"logged in viewer",
		},
	}
}

func TestAlwaysAllowPolicy(t *testing.T) {
	user := &alwaysAllowUser{}

	for _, tt := range getDefaultPolicyTestCases() {
		err := ent.ApplyPrivacyForEnt(tt.viewer, user)
		assert.Nil(t, err, tt.testCase)
	}
}

func TestAlwaysDenyPolicy(t *testing.T) {
	user := &alwaysDenyUser{}

	for _, tt := range getDefaultPolicyTestCases() {
		err := ent.ApplyPrivacyForEnt(tt.viewer, user)
		assert.NotNil(t, err, tt.testCase)
		assert.IsType(t, &ent.PrivacyError{}, err)
	}
}

func TestAlwaysPanicPolicy(t *testing.T) {
	user := &alwaysPanicUser{}

	for _, tt := range getDefaultPolicyTestCases() {
		testAlwaysPanic(t, tt, user)
	}
}

func testAlwaysPanic(t *testing.T, tt policyTestCase, user *alwaysPanicUser) {
	err := ent.ApplyPrivacyForEnt(tt.viewer, user)
	assert.NotNil(t, err, tt.testCase)
	assert.IsType(t, ent.DenyWithReasonResult{}, err)
}

func TestOverridenPrivacyPolicy(t *testing.T) {
	testCases := []struct {
		viewer   viewer.ViewerContext
		testCase string
		visible  bool
	}{
		{
			viewer.LoggedOutViewer(),
			"logged out viewer",
			false,
		},
		{
			viewertesting.OmniViewerContext{},
			"omni viewer",
			false,
		},
		{
			viewertesting.LoggedinViewerContext{},
			"logged in viewer",
			true,
		},
	}

	for _, tt := range testCases {
		user := &userWithCustomPrivacy{}
		err := ent.ApplyPrivacyForEnt(tt.viewer, user)
		if tt.visible {
			assert.Nil(t, err, tt.testCase)
		} else {
			assert.NotNil(t, err, tt.testCase)
			assert.IsType(t, &ent.PrivacyError{}, err)
		}
	}
}
