package action

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/internal/testingutils"
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
	}
}

func (action *CreateContactAction) GetObservers() []actions.Observer {
	return []actions.Observer{
		&testingutils.ActionLoggerObserver{Action: action},
	}
}
