package edge

import (
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
)

// TODO we need a test that shows not equal....
func CompareAssociationEdge(existingEdge, edge *AssociationEdge) []change.Change {
	var ret []change.Change
	if !assocEdgeEqual(existingEdge, edge) {
		ret = append(ret, change.Change{
			Change: change.ModifyEdge,
		})
	}
	return ret
}

func assocEdgeEqual(existingEdge, edge *AssociationEdge) bool {
	return commonEdgeInfoEqual(existingEdge.CommonEdgeInfo, edge.CommonEdgeInfo) &&
		existingEdge.EdgeConst == edge.EdgeConst &&
		existingEdge.TsEdgeConst == edge.TsEdgeConst &&
		existingEdge.Symmetric == edge.Symmetric &&
		existingEdge.Unique == edge.Unique &&
		//		inverseAssocEdgeEqual(existingEdge.InverseEdge, edge.InverseEdge) &&
		existingEdge.IsInverseEdge == edge.IsInverseEdge &&
		existingEdge.TableName == edge.TableName &&
		// EdgeActions intentionally skipped since we don't need it in file generation
		// actions will be used in actions later...
		existingEdge.GivenEdgeConstName == edge.GivenEdgeConstName &&
		existingEdge.PatternEdgeConst == edge.PatternEdgeConst &&
		existingEdge.OverridenQueryName == edge.OverridenQueryName &&
		existingEdge.OverridenEdgeName == edge.OverridenEdgeName &&
		existingEdge.OverridenGraphQLName == edge.OverridenGraphQLName &&
		existingEdge.PatternName == edge.PatternName
}

func commonEdgeInfoEqual(existing, common CommonEdgeInfo) bool {
	return existing.EdgeName == common.EdgeName &&
		existing.HideFromGraphQLField == common.HideFromGraphQLField &&
		existing.PackageNameField == common.PackageNameField &&
		// assuming if this is correct, everything else is
		existing.NodeInfo.Node == common.NodeInfo.Node &&
		existing.entConfig.ConfigName == common.entConfig.ConfigName &&
		existing.entConfig.PackageName == common.entConfig.PackageName
}

func inverseAssocEdgeEqual(existing, inverseEdge *InverseAssocEdge) bool {
	ret := change.CompareEqual(existing, inverseEdge)
	if ret != nil {
		return *ret
	}

	return commonEdgeInfoEqual(existing.CommonEdgeInfo, inverseEdge.CommonEdgeInfo) &&
		existing.EdgeConst == inverseEdge.EdgeConst
}

// TODO we need a test that shows not equal....
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
	return commonEdgeInfoEqual(existingEdge.CommonEdgeInfo, edge.CommonEdgeInfo) &&
		existingEdge.QuotedDbColNameField == edge.QuotedDbColNameField &&
		existingEdge.UniqueField == edge.UniqueField

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
		existingEdge.TsEdgeName == edge.TsEdgeName &&
		existingEdge.ForeignNode == edge.ForeignNode &&
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
	return commonEdgeInfoEqual(existingEdge.CommonEdgeInfo, edge.CommonEdgeInfo) &&
		existingEdge.FieldName == edge.FieldName &&
		existingEdge.TSFieldName == edge.TSFieldName &&
		existingEdge.Nullable == edge.Nullable &&
		input.InverseFieldEdgeEqual(existingEdge.InverseEdge, edge.InverseEdge) &&
		base.PolymorphicOptionsEqual(existingEdge.Polymorphic, edge.Polymorphic)
}
