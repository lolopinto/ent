package main


// TODO need to setup tests at some point
// for the manual files here's the cases we need to test

// most complicated case
var _ := `
func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
	return []privacy.PolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN of manual privacy rules
		// alll
		privacy.AllowIfViewerRule{policy.User.ID},
		// hellosdsd
		AllowIfUserHasNotesRule{},
		// sdsdsd
		// END of manual privacy rules
		privacy.AlwaysDenyRule{},
	}
}
`

// nothing
var _ := `
func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
	return []privacy.PolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN of manual privacy rules
		// END of manual privacy rules
		privacy.AlwaysDenyRule{},
	}
}
`

// one rule
var _ := `
func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
	return []privacy.PolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN of manual privacy rules
		AllowIfUserHasNotesRule{},
		// END of manual privacy rules
		privacy.AlwaysDenyRule{},
	}
}
`

// two rules
var _ := `
func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
	return []privacy.PolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN of manual privacy rules
		AllowIfUserHasNotesRule{},
		privacy.AllowIfViewerRule{policy.User.ID},
		// END of manual privacy rules
		privacy.AlwaysDenyRule{},
	}
}
`
// two rules with a comment in the middle 
var _ := `
func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
	return []privacy.PolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN of manual privacy rules
		AllowIfUserHasNotesRule{},
		// ss 
		privacy.AllowIfViewerRule{policy.User.ID},
		// END of manual privacy rules
		privacy.AlwaysDenyRule{},
	}
}
`

// comments on the side 
var _ := `
func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
	return []privacy.PolicyRule{
		privacy.AllowIfOmniscientRule{},
		// BEGIN of manual privacy rules
		AllowIfUserHasNotesRule{},
		// ss 
		privacy.AllowIfViewerRule{policy.User.ID}, // hi
		// END of manual privacy rules
		privacy.AlwaysDenyRule{},
	}
}
`

// AND more...
// add cases with multiple BEGIN & END statements
// and handle the case where people put BEGIN MANUAL and END MANUAL where
// it shouldn't be