package schema

import (
	"github.com/lolopinto/ent/internal/edge"
)

// NodeMapInfo holds all the information about the schema
// It's a mapping of "packageName" to NodeDataInfo objects
type NodeMapInfo map[string]*NodeDataInfo

func (m NodeMapInfo) getNodeDataFromGraphQLName(nodeName string) *NodeData {
	// just assume this for now. may not be correct in the long run
	configName := nodeName + "Config"

	nodeInfo, ok := m[configName]
	if !ok {
		return nil
	}
	return nodeInfo.NodeData
}

func (m NodeMapInfo) HideFromGraphQL(edge edge.Edge) bool {
	if edge.HideFromGraphQL() {
		return true
	}
	// polymorphic edge may not have NodeData so we shouldn't use that
	// just return false since edge itself not hidden
	if edge.PolymorphicEdge() {
		return false
	}
	node := edge.GetNodeInfo().Node
	nodeData := m.getNodeDataFromGraphQLName(node)
	if nodeData == nil {
		return true
	}
	return nodeData.HideFromGraphQL
}
