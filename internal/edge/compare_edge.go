package edge

import (
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
)

// CompareAssociationEdge compares 2 actions to see what changes
// intentionally skips EdgeActions since actions are high level objects of their own
// which will do their own comparison
func CompareAssociationEdge(existingEdge, edge *AssociationEdge) []change.Change {
	var ret []change.Change
	if !AssocEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change: change.ModifyEdge,
		})
	}
	return ret
}

func AssocEdgeEqual(existingEdge, edge *AssociationEdge) bool {
	ret := change.CompareNilVals(existingEdge == nil, edge == nil)
	if ret != nil {
		return *ret
	}
	return commonEdgeInfoEqual(existingEdge.commonEdgeInfo, edge.commonEdgeInfo) &&
		existingEdge.EdgeConst == edge.EdgeConst &&
		existingEdge.TsEdgeConst == edge.TsEdgeConst &&
		existingEdge.Symmetric == edge.Symmetric &&
		existingEdge.Unique == edge.Unique &&
		inverseAssocEdgeEqual(existingEdge.InverseEdge, edge.InverseEdge) &&
		existingEdge.IsInverseEdge == edge.IsInverseEdge &&
		existingEdge.TableName == edge.TableName &&
		// EdgeActions intentionally skipped since we don't need it in file generation
		// actions will be used in actions later...
		existingEdge.givenEdgeConstName == edge.givenEdgeConstName &&
		existingEdge.patternEdgeConst == edge.patternEdgeConst &&
		existingEdge.overridenQueryName == edge.overridenQueryName &&
		existingEdge.overridenEdgeName == edge.overridenEdgeName &&
		existingEdge.overridenGraphQLName == edge.overridenGraphQLName &&
		existingEdge.PatternName == edge.PatternName
}

func AssocEdgesEqual(l1, l2 []*AssociationEdge) bool {
	if len(l1) != len(l2) {
		return false
	}
	for i := range l1 {
		if !AssocEdgeEqual(l1[i], l2[i]) {
			return false
		}
	}
	return true
}

func commonEdgeInfoEqual(existing, common commonEdgeInfo) bool {
	return existing.EdgeName == common.EdgeName &&
		existing.HideFromGraphQLField == common.HideFromGraphQLField &&
		nodeinfo.NodeInfoEqual(existing.NodeInfo, common.NodeInfo) &&
		entConfigEqual(existing.entConfig, common.entConfig)
}

func entConfigEqual(existing, entConfig *schemaparser.EntConfigInfo) bool {
	ret := change.CompareNilVals(existing == nil, entConfig == nil)
	if ret != nil {
		return *ret
	}

	return existing.ConfigName == entConfig.ConfigName &&
		existing.PackageName == entConfig.PackageName
}

func inverseAssocEdgeEqual(existing, inverseEdge *InverseAssocEdge) bool {
	ret := change.CompareNilVals(existing == nil, inverseEdge == nil)
	if ret != nil {
		return *ret
	}

	return commonEdgeInfoEqual(existing.commonEdgeInfo, inverseEdge.commonEdgeInfo) &&
		existing.EdgeConst == inverseEdge.EdgeConst
}

func CompareForeignKeyEdge(existingEdge, edge *ForeignKeyEdge) []change.Change {
	var ret []change.Change
	if !foreignKeyEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change: change.ModifyEdge,
		})
	}
	return ret
}

func foreignKeyEdgeEqual(existingEdge, edge *ForeignKeyEdge) bool {
	return existingEdge.SourceNodeName == edge.SourceNodeName &&
		destinationEdgeEqual(existingEdge.destinationEdge, edge.destinationEdge)
}

func destinationEdgeEqual(existingEdge, edge destinationEdge) bool {
	return commonEdgeInfoEqual(existingEdge.commonEdgeInfo, edge.commonEdgeInfo) &&
		existingEdge.quotedDbColNameField == edge.quotedDbColNameField &&
		existingEdge.unique == edge.unique

}

func CompareIndexedEdge(existingEdge, edge *IndexedEdge) []change.Change {
	var ret []change.Change
	if !indexedEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change: change.ModifyEdge,
		})
	}
	return ret
}

func indexedEdgeEqual(existingEdge, edge *IndexedEdge) bool {
	return existingEdge.SourceNodeName == edge.SourceNodeName &&
		existingEdge.tsEdgeName == edge.tsEdgeName &&
		existingEdge.foreignNode == edge.foreignNode &&
		destinationEdgeEqual(existingEdge.destinationEdge, edge.destinationEdge)
}

func CompareFieldEdge(existingEdge, edge *FieldEdge) []change.Change {
	var ret []change.Change
	if !fieldEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change: change.ModifyEdge,
		})
	}
	return ret
}

func fieldEdgeEqual(existingEdge, edge *FieldEdge) bool {
	return commonEdgeInfoEqual(existingEdge.commonEdgeInfo, edge.commonEdgeInfo) &&
		existingEdge.FieldName == edge.FieldName &&
		existingEdge.TSFieldName == edge.TSFieldName &&
		existingEdge.Nullable == edge.Nullable &&
		input.InverseFieldEdgeEqual(existingEdge.InverseEdge, edge.InverseEdge) &&
		base.PolymorphicOptionsEqual(existingEdge.Polymorphic, edge.Polymorphic)
}

// intentionally skips EdgeActions since actions are high level objects of their own
// which will do their own comparison
func AssocEdgeGroupEqual(g1, g2 *AssociationEdgeGroup) bool {
	ret := change.CompareNilVals(g1 == nil, g2 == nil)
	if ret != nil {
		return *ret
	}
	return g1.GroupName == g2.GroupName &&
		g1.GroupStatusName == g2.GroupStatusName &&
		g1.TSGroupStatusName == g2.TSGroupStatusName &&
		nodeinfo.NodeInfoEqual(g1.DestNodeInfo, g2.DestNodeInfo) &&
		g1.ConstType == g2.ConstType &&
		assocEdgesMapEqual(g1.Edges, g2.Edges) &&
		change.StringListEqual(g1.StatusEnums, g2.StatusEnums) &&
		g1.NullStateFn == g2.NullStateFn &&
		change.StringListEqual(g1.NullStates, g2.NullStates) &&
		actionEdgesEqual(g1.actionEdges, g2.actionEdges) &&
		AssocEdgesEqual(g1.statusEdges, g2.statusEdges) &&
		nodeinfo.NodeInfoEqual(g1.NodeInfo, g2.NodeInfo)
}

func actionEdgesEqual(m1, m2 map[string]bool) bool {
	if len(m1) != len(m2) {
		return false
	}
	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok || v != v2 {
			return false
		}
	}
	for k := range m2 {
		_, ok := m2[k]
		if !ok {
			return false
		}
	}
	return true
}

func assocEdgesMapEqual(m1, m2 map[string]*AssociationEdge) bool {
	if len(m1) != len(m2) {
		return false
	}
	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok || !AssocEdgeEqual(v, v2) {
			return false
		}
	}
	for k := range m2 {
		_, ok := m2[k]
		if !ok {
			return false
		}
	}
	return true
}
