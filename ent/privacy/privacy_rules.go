package privacy

import (
	"github.com/lolopinto/jarvis/ent/viewer"
)

// AlwaysAllowRule is a reusable rule that comes with the ent framework that says an ent is always visible to the viewer
type AlwaysAllowRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns AllowResult
func (rule AlwaysAllowRule) GenEval(viewer viewer.ViewerContext, ent interface{}, resultChan chan<- Result) {
	resultChan <- AllowResult
}

// AlwaysDenyRule is a reusable rule that comes with the ent framework that says an ent is always invisible to the viewer
type AlwaysDenyRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns DenyResult
func (rule AlwaysDenyRule) GenEval(viewer viewer.ViewerContext, ent interface{}, resultChan chan<- Result) {
	resultChan <- DenyResult
}

// AllowIfOmniscientRule is a reusable rule that comes with the ent framework that says an ent is visible to the viewer if the
// viewer is omniscient (or has admin privileges)
type AllowIfOmniscientRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns AllowResult if viewer is omniscient.
// Otherwise, returns SkipResult
func (rule AllowIfOmniscientRule) GenEval(viewer viewer.ViewerContext, ent interface{}, resultChan chan<- Result) {
	if viewer.IsOmniscient() {
		resultChan <- AllowResult
	}
	resultChan <- SkipResult
}

// DenyIfLoggedOutRule is a reusable rule that comes with the ent framework that says an ent is not visible to
// any logged out users
type DenyIfLoggedOutRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule DenyIfLoggedOutRule) GenEval(viewer viewer.ViewerContext, ent interface{}, resultChan chan<- Result) {
	if viewer.HasIdentity() {
		resultChan <- SkipResult
	}
	resultChan <- DenyResult
}
