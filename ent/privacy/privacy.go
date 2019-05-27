package privacy

import (
	"github.com/lolopinto/jarvis/ent/viewer"
)

// Result is what's returned by privacy method to indicate what should be returned to the client
// of ent callers
type Result int

const (
	// AllowResult returns a value indicating that the ent should be visible to the viewer.
	// We use HTTP status code 200 for the lols
	AllowResult Result = 200

	// DenyResult returns a value indicating that the ent should should not be visible to the viewer.
	// We use HTTP status code 400 for the lols
	DenyResult Result = 400

	// SkipResult returns a value indicating that the ent should not be visible to the viewer.
	// We use HTTP status code 307 for the lols
	SkipResult Result = 307
)

// Allow is the method that should be returned by privacy rule methods indicating that the privacy rule is enough
// to make the ent visible to the viewer
func Allow() Result {
	return AllowResult
}

// Deny is the method that should be returned by privacy rule methods indicating that the privacy rule is enough
// to make the ent NOT visible to the viewer
func Deny() Result {
	return DenyResult
}

// Skip is the method that should be returned by privacy rule methods indicating that the privacy rule does not have
// enough info to make the ent visible to the viewer. It's punting to the next privacy rule
func Skip() Result {
	return SkipResult
}

// Policy defines the set of Privacy rules that need to be implemented by this ent
// to end up with a decision on if this ent is visible to the viewer
type Policy interface {
	Rules() []PolicyRule
}

// PolicySimple defines a single method to be evaluated to determine if an ent is visible
// to the viewer
// TBD on if we'll keep this long-term.
// TODO...
type PolicySimple interface {
	// GenEval is the method called to evaluate the visibility of the ent
	GenEval(viewer viewer.ViewerContext, ent interface{}, boolChan chan<- bool)
}

// PolicyRule is an independent PrivacyRule that evaluates an ent and determines if it's visible or not
type PolicyRule interface {
	// GenEval is the method called to evaluate the visibility of the ent
	GenEval(viewer viewer.ViewerContext, ent interface{}, resultChan chan<- Result)
}
