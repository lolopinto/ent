package privacy

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

// AlwaysAllowRule is a reusable rule that comes with the ent framework that says an ent is always visible to the viewer
type AlwaysAllowRule struct{}

// Eval is the method called to evaluate the visibility of the ent and always returns AllowResult
func (rule AlwaysAllowRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	return ent.Allow()
}

// AlwaysDenyRule is a reusable rule that comes with the ent framework that says an ent is always invisible to the viewer
type AlwaysDenyRule struct{}

// Eval is the method called to evaluate the visibility of the ent and always returns DenyResult
func (rule AlwaysDenyRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	return ent.Deny()
}

// AllowIfOmniscientRule is a reusable rule that comes with the ent framework that says an ent is visible to the viewer if the
// viewer is omniscient (or has admin privileges)
type AllowIfOmniscientRule struct{}

// Eval is the method called to evaluate the visibility of the ent and always returns AllowResult if viewer is omniscient.
// Otherwise, returns SkipResult
func (rule AllowIfOmniscientRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	if viewer.IsOmniscient(v) {
		return ent.Allow()
	}
	return ent.Skip()
}

// DenyIfLoggedOutRule is a reusable rule that comes with the ent framework that says an ent is not visible to
// any logged out users
type DenyIfLoggedOutRule struct{}

// Eval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule DenyIfLoggedOutRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	if viewer.HasIdentity(v) {
		return ent.Skip()
	}
	return ent.Deny()
}

// AllowIfViewerIsOwnerRule is a reusable rule that says the underlying ent is only visible
// if the viewer ID is equal to the passed OwnerID
type AllowIfViewerIsOwnerRule struct {
	OwnerID string
}

// Eval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule AllowIfViewerIsOwnerRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	if v.GetViewerID() == rule.OwnerID {
		return ent.Allow()
	}
	return ent.Skip()
}

// AllowIfViewerRule is a reusable rule that says the underlying ent is only visible
// if the viewer ID is equal to the passed EntID
type AllowIfViewerRule struct {
	EntID string
}

// Eval is the method called to evaluate the visibility of the ent and always returns DenyResult if viewer is logged out.
// Otherwise, returns SkipResult
func (rule AllowIfViewerRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	// TODO. need to be able to cast to Entity here and not take a parameter here is best...
	// so need to break up privacy constants vs reusable rules
	if v.GetViewerID() == rule.EntID {
		return ent.Allow()
	}
	return ent.Skip()
}

type AllowIfClosureRule struct {
	Func func(v viewer.ViewerContext, ent ent.Entity) bool
}

func (rule AllowIfClosureRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	if rule.Func(v, entity) {
		return ent.Allow()
	}
	return ent.Skip()
}

type AllowIfValidMutationBuilderRule struct {
	Builder ent.MutationBuilder
}

func (rule AllowIfValidMutationBuilderRule) Eval(v viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	if rule.Builder != nil {
		return ent.Allow()
	}
	return ent.Skip()
}
