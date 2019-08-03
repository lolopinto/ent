package privacy

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

// AlwaysAllowRule is a reusable rule that comes with the ent framework that says an ent is always visible to the viewer
type AlwaysAllowRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns AllowResult
func (rule AlwaysAllowRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	resultChan <- ent.AllowPrivacyResult
}

// AlwaysDenyRule is a reusable rule that comes with the ent framework that says an ent is always invisible to the viewer
type AlwaysDenyRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns DenyResult
func (rule AlwaysDenyRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	resultChan <- ent.DenyPrivacyResult
}

// AllowIfOmniscientRule is a reusable rule that comes with the ent framework that says an ent is visible to the viewer if the
// viewer is omniscient (or has admin privileges)
type AllowIfOmniscientRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns AllowResult if viewer is omniscient.
// Otherwise, returns SkipResult
func (rule AllowIfOmniscientRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	if viewer.IsOmniscient() {
		resultChan <- ent.AllowPrivacyResult
	}
	resultChan <- ent.SkipPrivacyResult
}

// DenyIfLoggedOutRule is a reusable rule that comes with the ent framework that says an ent is not visible to
// any logged out users
type DenyIfLoggedOutRule struct{}

// GenEval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule DenyIfLoggedOutRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	if viewer.HasIdentity() {
		resultChan <- ent.SkipPrivacyResult
	}
	resultChan <- ent.DenyPrivacyResult
}

// AllowIfViewerIsOwnerRule is a reusable rule that says the underlying ent is only visible
// if the viewer ID is equal to the passed OwnerID
type AllowIfViewerIsOwnerRule struct {
	OwnerID string
}

// GenEval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule AllowIfViewerIsOwnerRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	if viewer.GetViewerID() == rule.OwnerID {
		resultChan <- ent.AllowPrivacyResult
	}
	resultChan <- ent.SkipPrivacyResult
}

// AllowIfViewerRule is a reusable rule that says the underlying ent is only visible
// if the viewer ID is equal to the passed OwnerID
type AllowIfViewerRule struct {
	EntID string
}

// GenEval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule AllowIfViewerRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	// TODO. need to be able to cast to Entity here and not take a parameter here is best...
	// so need to break up privacy constants vs reusable rules
	if viewer.GetViewerID() == rule.EntID {
		resultChan <- ent.AllowPrivacyResult
	}
	resultChan <- ent.SkipPrivacyResult
}

type AllowIfClosureRule struct {
	// TODO this should be Entity when this is typed to Entity correctly
	Func func(viewer viewer.ViewerContext, ent interface{}) bool
}

func (rule AllowIfClosureRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	if rule.Func(viewer, entity) {
		resultChan <- ent.AllowPrivacyResult
	}
	resultChan <- ent.SkipPrivacyResult
}

type AllowIfEdgeExistsRule struct {
	Func func(viewer viewer.ViewerContext, ent interface{}) (*ent.Edge, error)

	// ID1 string
	// ID2 string
	// EdgeType EdgeType
}

func (rule AllowIfEdgeExistsRule) GenEval(viewer viewer.ViewerContext, entity interface{}, resultChan chan<- ent.PrivacyResult) {
	edge, err := rule.Func(viewer, entity)
	if err != nil {
		resultChan <- ent.SkipPrivacyResult
	} else if edge == nil || edge.ID1 == "" {
		resultChan <- ent.SkipPrivacyResult
	} else {
		resultChan <- ent.AllowPrivacyResult
	}
}
