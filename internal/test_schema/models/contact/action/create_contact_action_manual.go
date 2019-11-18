package action

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
)

func (action *CreateContactAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			// can create contact in the middle of a user mutation (even if logged out) or while logged in
			privacy.AllowIfValidMutationBuilderRule{
				action.GetTypedBuilder().GetUserIDBuilder(),
			},
			privacy.DenyIfLoggedOutRule{},
			privacy.AlwaysAllowRule{},
		),
		action.ExistingEnt(),
	}
}
