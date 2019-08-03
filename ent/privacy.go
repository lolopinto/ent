package ent

import (
	"github.com/lolopinto/ent/ent/viewer"
)

// Result is what's returned by privacy method to indicate what should be returned to the client
// of ent callers
type PrivacyResult int

const (
	// AllowPrivacyResult returns a value indicating that the ent should be visible to the viewer.
	// We use HTTP status code 200 for the lols
	AllowPrivacyResult PrivacyResult = 200

	// DenyPrivacyResult returns a value indicating that the ent should should not be visible to the viewer.
	// We use HTTP status code 400 for the lols
	DenyPrivacyResult PrivacyResult = 400

	// SkipPrivacyResult returns a value indicating that the ent should not be visible to the viewer.
	// We use HTTP status code 307 for the lols
	SkipPrivacyResult PrivacyResult = 307
)

// Allow is the method that should be returned by privacy rule methods indicating that the privacy rule is enough
// to make the ent visible to the viewer
func Allow() PrivacyResult {
	return AllowPrivacyResult
}

// Deny is the method that should be returned by privacy rule methods indicating that the privacy rule is enough
// to make the ent NOT visible to the viewer
func Deny() PrivacyResult {
	return DenyPrivacyResult
}

// Skip is the method that should be returned by privacy rule methods indicating that the privacy rule does not have
// enough info to make the ent visible to the viewer. It's punting to the next privacy rule
func Skip() PrivacyResult {
	return SkipPrivacyResult
}

// Policy defines the set of Privacy rules that need to be implemented by this ent
// to end up with a decision on if this ent is visible to the viewer
type PrivacyPolicy interface {
	Rules() []PrivacyPolicyRule
}

// // PolicySimple defines a single method to be evaluated to determine if an ent is visible
// // to the viewer
// // TBD on if we'll keep this long-term.
// // TODO...
// type PrivacyPolicySimple interface {
// 	// GenEval is the method called to evaluate the visibility of the ent
// 	GenEval(viewer viewer.ViewerContext, ent interface{}, boolChan chan<- bool)
// }

// PolicyRule is an independent PrivacyRule that evaluates an ent and determines if it's visible or not
type PrivacyPolicyRule interface {
	// GenEval is the method called to evaluate the visibility of the ent
	GenEval(viewer viewer.ViewerContext, ent interface{}, resultChan chan<- PrivacyResult)
}
