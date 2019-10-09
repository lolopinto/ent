package privacy

import "github.com/lolopinto/ent/ent"

// InlinePrivacyPolicy is a policy that takes an ordered list of rules that
// determine what the access control for an ent or action is
type InlinePrivacyPolicy struct {
	Ruless []ent.PrivacyPolicyRule
}

// Rules returns the given list of rules
func (p InlinePrivacyPolicy) Rules() []ent.PrivacyPolicyRule {
	return p.Ruless
}

// Rules is a helper method for passing in a list of Privacy Rules to InlinePrivacyPolicy and other places which take in a list of rules
func Rules(rules ...ent.PrivacyPolicyRule) []ent.PrivacyPolicyRule {
	return rules
}
