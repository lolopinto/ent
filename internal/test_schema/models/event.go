package models

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
)

// GetPrivacyPolicy returns the privacy policy for evaluating if the Event is visible to the viewer
func (event *Event) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			privacy.AllowIfOmniscientRule{},
			privacy.AllowIfViewerIsOwnerRule{
				OwnerID: event.UserID,
			},
			privacy.AllowIfViewerOutboundEdgeExistsRule{
				EdgeType: EventToInvitedEdge,
			},
			privacy.AlwaysDenyRule{},
		},
	}
}
