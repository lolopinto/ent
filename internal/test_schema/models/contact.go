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
