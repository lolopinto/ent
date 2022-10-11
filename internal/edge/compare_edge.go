package edge

import (
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/tsimport"
)

// CompareAssociationEdge compares 2 actions to see what changes
// intentionally skips EdgeActions since actions are high level objects of their own
// which will do their own comparison
func CompareAssociationEdge(existingEdge, edge *AssociationEdge) []change.Change {
	var ret []change.Change
	if !AssocEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change:      change.ModifyEdge,
			Name:        existingEdge.EdgeName,
			GraphQLName: existingEdge.GetGraphQLConnectionName(),
			ExtraInfo:   existingEdge.TsEdgeQueryName(),
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

func CompareAssocEdgesMap(m1, m2 map[string]*AssociationEdge) []change.Change {
	var ret []change.Change
	for k, edge1 := range m1 {
		edge2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.RemoveEdge,
				Name:        k,
				GraphQLName: edge1.GetGraphQLConnectionName(),
				ExtraInfo:   edge1.TsEdgeQueryName(),
			})
		} else {
			if !AssocEdgeEqual(edge1, edge2) {
				ret = append(ret, change.Change{
					Change:      change.ModifyEdge,
					Name:        k,
					GraphQLName: edge1.GetGraphQLConnectionName(),
					ExtraInfo:   edge1.TsEdgeQueryName(),
				})
			}
		}
	}

	for k, edge2 := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.AddEdge,
				Name:        k,
				GraphQLName: edge2.GetGraphQLConnectionName(),
				ExtraInfo:   edge2.TsEdgeQueryName(),
			})
		}
	}
	return ret
}

func compareAssocEdgeGroupMap(m1, m2 map[string]*AssociationEdgeGroup) []change.Change {
	var ret []change.Change
	for k, group1 := range m1 {
		group2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveEdgeGroup,
				Name:   k,
			})
		} else {
			if !AssocEdgeGroupEqual(group1, group2) {
				ret = append(ret, change.Change{
					Change: change.ModifyEdgeGroup,
					Name:   k,
				})
			}
		}
	}

	for k := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change: change.AddEdgeGroup,
				Name:   k,
			})
		}
	}
	return ret
}

func compareFieldEdgeMap(m1, m2 map[string]*FieldEdge) []change.Change {
	var ret []change.Change
	for k, edge1 := range m1 {
		edge2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveEdge,
				Name:   k,
			})
		} else {
			if !fieldEdgeEqual(edge1, edge2) {
				ret = append(ret, change.Change{
					Change:      change.ModifyFieldEdge,
					Name:        k,
					GraphQLName: edge1.GraphQLEdgeName(),
				})
			}
		}
	}

	for k, edge2 := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.AddFieldEdge,
				Name:        k,
				GraphQLName: edge2.GraphQLEdgeName(),
			})
		}
	}
	return ret
}

func compareIndexedConnectionEdgeMap(m1, m2 map[string]IndexedConnectionEdge) []change.Change {
	var ret []change.Change
	for k, edge1 := range m1 {
		edge2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.RemoveEdge,
				Name:        k,
				GraphQLName: edge1.GetGraphQLConnectionName(),
				ExtraInfo:   edge1.TsEdgeQueryName(),
			})
		} else {
			if !compareIndexedConnectionEdge(edge1, edge2) {
				ret = append(ret, change.Change{
					Change:      change.ModifyEdge,
					Name:        k,
					GraphQLName: edge1.GetGraphQLConnectionName(),
					ExtraInfo:   edge1.TsEdgeQueryName(),
				})
			}
		}
	}

	for k, edge2 := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.AddEdge,
				Name:        k,
				GraphQLName: edge2.GetGraphQLConnectionName(),
				ExtraInfo:   edge2.TsEdgeQueryName(),
			})
		}
	}
	return ret
}

func commonEdgeInfoEqual(existing, common commonEdgeInfo) bool {
	return existing.EdgeName == common.EdgeName &&
		existing._HideFromGraphQL == common._HideFromGraphQL &&
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
			Change:      change.ModifyEdge,
			Name:        existingEdge.EdgeName,
			GraphQLName: existingEdge.GetGraphQLConnectionName(),
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
		existingEdge.quotedDbColName == edge.quotedDbColName &&
		existingEdge.unique == edge.unique

}

func CompareIndexedEdge(existingEdge, edge *IndexedEdge) []change.Change {
	var ret []change.Change
	if !indexedEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change:      change.ModifyEdge,
			Name:        edge.EdgeName,
			GraphQLName: edge.GetGraphQLConnectionName(),
			ExtraInfo:   edge.TsEdgeQueryName(),
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
			Change:      change.ModifyFieldEdge,
			Name:        edge.EdgeName,
			GraphQLName: edge.GraphQLEdgeName(),
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
		g1.ViewerBased == g2.ViewerBased &&
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
	return true
}

func compareEdge(e1, e2 Edge) bool {
	return e1.GetEdgeName() == e2.GetEdgeName() &&
		nodeinfo.NodeInfoEqual(e1.GetNodeInfo(), e2.GetNodeInfo()) &&
		e1.GetEntConfig().ConfigName == e2.GetEntConfig().ConfigName &&
		e1.GetEntConfig().PackageName == e2.GetEntConfig().PackageName &&
		e1.GraphQLEdgeName() == e2.GraphQLEdgeName() &&
		e1.CamelCaseEdgeName() == e2.CamelCaseEdgeName() &&
		e1.HideFromGraphQL() == e2.HideFromGraphQL() &&
		e1.PolymorphicEdge() == e2.PolymorphicEdge() &&
		tsimport.ImportPathsEqual(e1.GetTSGraphQLTypeImports(), e2.GetTSGraphQLTypeImports())
}

func compareConnectionEdge(e1, e2 ConnectionEdge) bool {
	return compareEdge(e1, e2) &&
		e1.GetSourceNodeName() == e2.GetSourceNodeName() &&
		e1.GetGraphQLEdgePrefix() == e2.GetGraphQLEdgePrefix() &&
		e1.GetGraphQLConnectionName() == e2.GetGraphQLConnectionName() &&
		e1.TsEdgeQueryEdgeName() == e2.TsEdgeQueryEdgeName() &&
		e1.TsEdgeQueryName() == e2.TsEdgeQueryName() &&
		e1.UniqueEdge() == e2.UniqueEdge()
}

func compareIndexedConnectionEdge(e1, e2 IndexedConnectionEdge) bool {
	return compareConnectionEdge(e1, e2) &&
		e1.SourceIsPolymorphic() == e2.SourceIsPolymorphic() &&
		e1.QuotedDBColName() == e2.QuotedDBColName()
}

// Compares edges, assoc edge groups, field edge, connection edge
func CompareEdgeInfo(e1, e2 *EdgeInfo) []change.Change {
	if e1 == nil {
		e1 = &EdgeInfo{}
	}
	if e2 == nil {
		e2 = &EdgeInfo{}
	}
	var ret []change.Change

	ret = append(ret, CompareAssocEdgesMap(e1.assocMap, e2.assocMap)...)

	ret = append(ret, compareAssocEdgeGroupMap(e1.assocGroupsMap, e2.assocGroupsMap)...)

	ret = append(ret, compareFieldEdgeMap(e1.fieldEdgeMap, e2.fieldEdgeMap)...)

	// Note: see comment in EdgeInfo about comparing this and not compareConnectionEdgeMap
	ret = append(ret, compareIndexedConnectionEdgeMap(e1.indexedEdgeQueriesMap, e2.indexedEdgeQueriesMap)...)

	return ret
}
