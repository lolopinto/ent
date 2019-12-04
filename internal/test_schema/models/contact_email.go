package models

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
)

// GetPrivacyPolicy returns the privacy policy for evaluating if the contactEmail is visible to the viewer
func (contactEmail *ContactEmail) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			privacy.AllowIfOmniscientRule{},
			AllowIfViewerCanSeeContactRule{ContactID: contactEmail.ContactID},
			privacy.AlwaysDenyRule{},
		},
	}
}
