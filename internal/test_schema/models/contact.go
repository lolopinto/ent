package models

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
)

// GetPrivacyPolicy returns the privacy policy for evaluating if the contact is visible to the viewer
func (contact *Contact) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			privacy.AllowIfOmniscientRule{},
			privacy.AllowIfViewerIsOwnerRule{OwnerID: contact.UserID},
			privacy.AllowIfViewerOutboundEdgeExistsRule{
				EdgeType: ContactToAllowListEdge,
			},
			privacy.AlwaysDenyRule{},
		},
	}
}

// GetContactFoo blah blah blah
// @graphql
func (contact *Contact) GetContactFoo() string {
	return "foo"
}

// @graphql

func (contact *Contact) GetContactBar(foo int) int {
	return foo + 1
}

func (contact *Contact) GetBaz() float64 {
	return 0
}
