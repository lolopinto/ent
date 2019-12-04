package privacy

import "github.com/lolopinto/ent/ent"

// InlinePrivacyPolicy is a policy that takes an ordered list of rules that
// determine what the access control for an ent or action is
type InlinePrivacyPolicy struct {
	PolicyRules []ent.PrivacyPolicyRule
}

// GetPrivacyPolicy returns the inline privacy policy as a privacy policy
// This enables InlinePrivacyPolicy to implement the interface ObjectWithPrivacyPolicy
func (p InlinePrivacyPolicy) GetPrivacyPolicy() ent.PrivacyPolicy {
	return p
}

// Rules returns the given list of rules
func (p InlinePrivacyPolicy) Rules() []ent.PrivacyPolicyRule {
	return p.PolicyRules
}

// Rules is a helper method for passing in a list of Privacy Rules to InlinePrivacyPolicy and other places which take in a list of rules
func Rules(rules ...ent.PrivacyPolicyRule) []ent.PrivacyPolicyRule {
	return rules
}
