package ent

import (
	"github.com/lolopinto/ent/ent/viewer"
)

type privacyResult int

// PrivacyResult is what's returned by privacy methods to indicate what should be returned to the client
// of ent callers
type PrivacyResult interface {
	Result() privacyResult
}

const (
	// AllowPrivacyResult returns a value indicating that the ent should be visible to the viewer.
	// We use HTTP status code 200 for the lols
	AllowPrivacyResult privacyResult = 200

	// DenyPrivacyResult returns a value indicating that the ent should should not be visible to the viewer.
	// We use HTTP status code 401 for the lols
	DenyPrivacyResult privacyResult = 401

	// SkipPrivacyResult returns a value indicating that the ent should not be visible to the viewer.
	// We use HTTP status code 307 for the lols
	SkipPrivacyResult privacyResult = 307
)

type simplePrivacyResult struct {
	result privacyResult
}

func (s simplePrivacyResult) Result() privacyResult {
	return s.result
}

func newSimplePrivacyResult(result privacyResult) simplePrivacyResult {
	return simplePrivacyResult{result}
}

// Allow is the method that should be returned by privacy rule methods indicating that the privacy rule is enough
// to make the ent visible to the viewer
func Allow() PrivacyResult {
	return newSimplePrivacyResult(AllowPrivacyResult)
}

// Skip is the method that should be returned by privacy rule methods indicating that the privacy rule does not have
// enough info to make the ent visible to the viewer. It's punting to the next privacy rule
func Skip() PrivacyResult {
	return newSimplePrivacyResult(SkipPrivacyResult)
}

// Deny is the method that should be returned by privacy rule methods indicating that the privacy rule is enough
// to make the ent NOT visible to the viewer
func Deny() PrivacyResult {
	return newSimplePrivacyResult(DenyPrivacyResult)
}

// DenyWithReason is used to encode other errors as part of the privacy result
func DenyWithReason(err error) DenyWithReasonResult {
	return DenyWithReasonResult{
		err: err,
	}
}

// DenyWithReasonResult is the error returned by privacy
type DenyWithReasonResult struct {
	//	result privacyResult
	err error
}

// Result returns DenyPrivacyResult indicating that the privacy rule was enough to make the ent not visible to the viewer
func (r DenyWithReasonResult) Result() privacyResult {
	return DenyPrivacyResult
}

// Err returns the error that indicates the reason why the ent was denied
func (r DenyWithReasonResult) Err() error {
	return r.err
}

// Error exists to satisfy the error interface
func (r DenyWithReasonResult) Error() string {
	return r.err.Error()
}

// PrivacyPolicy defines the set of Privacy rules that need to be implemented by this ent
// to end up with a decision on if this ent is visible to the viewer
type PrivacyPolicy interface {
	Rules() []PrivacyPolicyRule
}

// PrivacyPolicyRule is an independent PrivacyRule that evaluates an ent and determines if it's visible or not
type PrivacyPolicyRule interface {
	// Eval is the method called to evaluate the visibility of the ent
	Eval(v viewer.ViewerContext, ent Entity) PrivacyResult
}
