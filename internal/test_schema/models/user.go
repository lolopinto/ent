package models

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
)

// GetPrivacyPolicy returns the privacy policy for evaluating if the user is visible to the viewer
func (user *User) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			privacy.AllowIfOmniscientRule{},
			privacy.AllowIfViewerIsOwnerRule{OwnerID: user.ID},
			privacy.AllowIfViewerInboundEdgeExistsRule{
				EdgeType: UserToFamilyMembersEdge,
			},
			privacy.AlwaysDenyRule{},
		},
	}
}
