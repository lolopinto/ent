package privacy

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/util"
)

type AlwaysAllowPrivacyPolicy struct {
	ent.Entity
}

func (p AlwaysAllowPrivacyPolicy) GetPrivacyPolicy() ent.PrivacyPolicy {
	return InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			AlwaysAllowRule{},
		},
	}
}

type AlwaysDenyPrivacyPolicy struct {
	ent.Entity
}

func (p AlwaysDenyPrivacyPolicy) GetPrivacyPolicy() ent.PrivacyPolicy {
	return InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			AlwaysDenyRule{},
		},
	}
}

type AlwaysPanicPrivacyPolicy struct {
	ent.Entity
}

func (p AlwaysPanicPrivacyPolicy) GetPrivacyPolicy() ent.PrivacyPolicy {
	return InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			alwaysPanicRule{},
		},
	}
}

type alwaysPanicRule struct{}

func (rule alwaysPanicRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	util.GoSchemaKill("this is just a default implementation that should be overriden")
	return nil
}
