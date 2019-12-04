package privacy

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type AlwaysAllowPrivacyPolicy struct {
	ent.Entity
}

func (p AlwaysAllowPrivacyPolicy) GetPrivacyPolicy() ent.PrivacyPolicy {
	return InlinePrivacyPolicy{
		PolicyRules: []ent.PrivacyPolicyRule{
			AlwaysAllowRule{},
		},
		PolicyEnt: p.Entity,
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
		PolicyEnt: p.Entity,
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
		PolicyEnt: p.Entity,
	}
}

type alwaysPanicRule struct{}

func (rule alwaysPanicRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	panic("this is just a default implementation that should be overriden")
}
