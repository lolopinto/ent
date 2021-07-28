package schema

import (
	"sort"

	"github.com/lolopinto/ent/internal/depgraph"
)

// NodeDataInfo stores information related to a particular Node
type NodeDataInfo struct {
	NodeData      *NodeData
	ShouldCodegen bool
	depgraph      *depgraph.Depgraph
}

func (info *NodeDataInfo) PostProcess() error {
	edgeInfo := info.NodeData.EdgeInfo
	// sort for consistent ordering
	sort.SliceStable(edgeInfo.DestinationEdges, func(i, j int) bool {
		return edgeInfo.DestinationEdges[i].GetEdgeName() < edgeInfo.DestinationEdges[j].GetEdgeName()
	})

	sort.SliceStable(edgeInfo.IndexedEdgeQueries, func(i, j int) bool {
		return edgeInfo.IndexedEdgeQueries[i].GetEdgeName() < edgeInfo.IndexedEdgeQueries[j].GetEdgeName()
	})

	sort.SliceStable(edgeInfo.Associations, func(i, j int) bool {
		return edgeInfo.Associations[i].EdgeName < edgeInfo.Associations[j].EdgeName
	})

	sort.SliceStable(edgeInfo.FieldEdges, func(i, j int) bool {
		return edgeInfo.FieldEdges[i].EdgeName < edgeInfo.FieldEdges[j].EdgeName
	})

	return nil
}
