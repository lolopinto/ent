package testingutils

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
)

// AllowOneRule sandwiches the given rule between an AllowIfOmniscientRule and an AlwaysDenyRule
func AllowOneRule(p ent.PrivacyPolicyRule) []ent.PrivacyPolicyRule {
	return privacy.Rules(
		privacy.AllowIfOmniscientRule{},
		p,
		privacy.AlwaysDenyRule{},
	)
}

// DenyOneRule sandwiches the given rule between an AllowIfOmniscientRule and an AlwaysDenyRule
func DenyOneRule(p ent.PrivacyPolicyRule) []ent.PrivacyPolicyRule {
	return privacy.Rules(
		privacy.AllowIfOmniscientRule{},
		p,
		privacy.AlwaysAllowRule{},
	)
}

// AllowOneInlinePrivacyPolicy wraps AllowOneRule() by an InlinePrivacyPolicy
func AllowOneInlinePrivacyPolicy(p ent.PrivacyPolicyRule) privacy.InlinePrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		AllowOneRule(p),
	}
}

// DenyOneInlinePrivacyPolicy wraps DenyOneRule() by an InlinePrivacyPolicy
func DenyOneInlinePrivacyPolicy(p ent.PrivacyPolicyRule) privacy.InlinePrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		DenyOneRule(p),
	}
}
