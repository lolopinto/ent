package privacy

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

// AllowIfViewerInboundEdgeExistsRule is a privacy rule that passes if an edge exists between the viewer
// and the ent
type AllowIfViewerInboundEdgeExistsRule struct {
	Policy   ent.PrivacyPolicy
	EdgeType ent.EdgeType
}

// Eval evaluates the AllowIfViewerInboundEdgeExistsRule privacy rule
func (rule AllowIfViewerInboundEdgeExistsRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	ent := rule.Policy.Ent()
	return allowIfEdgeRule(ent.GetViewer().GetViewerID(), ent.GetID(), rule.EdgeType)
}

// AllowIfViewerOutboundEdgeExistsRule is a privacy rule that passes if an edge exists between the viewer
// and the ent
type AllowIfViewerOutboundEdgeExistsRule struct {
	Policy   ent.PrivacyPolicy
	EdgeType ent.EdgeType
}

// Eval evaluates the AllowIfViewerOutboundEdgeExistsRule privacy rule
func (rule AllowIfViewerOutboundEdgeExistsRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	ent := rule.Policy.Ent()
	return allowIfEdgeRule(ent.GetID(), ent.GetViewer().GetViewerID(), rule.EdgeType)
}

// AllowIfEdgeExistsRule is a privacy rule that passes if an edge exists between the given IDs
type AllowIfEdgeExistsRule struct {
	ID1      string
	ID2      string
	EdgeType ent.EdgeType
}

// Eval evaluates the AllowIfEdgeExistsRule privacy rule
func (rule AllowIfEdgeExistsRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	return allowIfEdgeRule(rule.ID1, rule.ID2, rule.EdgeType)
}

// DenyIfViewerInboundEdgeExistsRule is a privacy rule that passes if an edge exists between the viewer
// and the ent
type DenyIfViewerInboundEdgeExistsRule struct {
	Policy   ent.PrivacyPolicy
	EdgeType ent.EdgeType
}

// Eval evaluates the DenyIfViewerInboundEdgeExistsRule privacy rule
func (rule DenyIfViewerInboundEdgeExistsRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	ent := rule.Policy.Ent()
	return denyIfEdgeRule(ent.GetViewer().GetViewerID(), ent.GetID(), rule.EdgeType)
}

// DenyIfViewerOutboundEdgeExistsRule is a privacy rule that passes if an edge exists between the viewer
// and the ent
type DenyIfViewerOutboundEdgeExistsRule struct {
	Policy   ent.PrivacyPolicy
	EdgeType ent.EdgeType
}

// Eval evaluates the DenyIfViewerOutboundEdgeExistsRule privacy rule
func (rule DenyIfViewerOutboundEdgeExistsRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	ent := rule.Policy.Ent()
	return denyIfEdgeRule(ent.GetID(), ent.GetViewer().GetViewerID(), rule.EdgeType)
}

// DenyIfEdgeExistsRule is a privacy rule that passes if an edge exists between the given IDs
type DenyIfEdgeExistsRule struct {
	ID1      string
	ID2      string
	EdgeType ent.EdgeType
}

// Eval evaluates the AllowIfEdgeExistsRule privacy rule
func (rule DenyIfEdgeExistsRule) Eval(viewer viewer.ViewerContext, entity ent.Entity) ent.PrivacyResult {
	return denyIfEdgeRule(rule.ID1, rule.ID2, rule.EdgeType)
}

func allowIfEdgeRule(id1, id2 string, edgeType ent.EdgeType) ent.PrivacyResult {
	return evalEdgeRule(id1, id2, edgeType, ent.Allow())
}

func denyIfEdgeRule(id1, id2 string, edgeType ent.EdgeType) ent.PrivacyResult {
	return evalEdgeRule(id1, id2, edgeType, ent.Deny())
}

func evalEdgeRule(id1, id2 string, edgeType ent.EdgeType, validEdgeResult ent.PrivacyResult) ent.PrivacyResult {
	edge, err := ent.LoadEdgeByType(id1, edgeType, id2)
	if err != nil {
		return ent.Skip()
	} else if edge == nil || edge.ID1 == "" {
		return ent.Skip()
	} else {
		return validEdgeResult
	}
}
