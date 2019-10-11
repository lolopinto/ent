// Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

package models

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"
)

// UserPrivacyPolicy is the privacy policy for the User ent which helps decides if it's
// visible to the viewer
type UserPrivacyPolicy struct {
	User *User
}

// Rules is the list of rules that decides the visibility of the User ent to the viewer
func (policy UserPrivacyPolicy) Rules() []ent.PrivacyPolicyRule {
	return []ent.PrivacyPolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN MANUAL SECTION: Add custom privacy rules below
		privacy.AllowIfViewerIsOwnerRule{OwnerID: policy.User.ID},
		// END MANUAL SECTION of privacy rules
		privacy.AlwaysDenyRule{},
	}
}

// AllowIfViewerCanSeeUserRule is a reusable rule that can be called by different ents to see if the contact can be visible
type AllowIfViewerCanSeeUserRule struct {
	UserID string
}

// Eval evaluates that the ent is visible to the user
func (rule AllowIfViewerCanSeeUserRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	_, err := LoadUser(viewer, rule.UserID)
	if err != nil {
		return ent.Skip()
	}
	return ent.Allow()
}
