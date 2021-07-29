package schema

import (
	"github.com/lolopinto/ent/internal/depgraph"
)

// NodeDataInfo stores information related to a particular Node
type NodeDataInfo struct {
	NodeData      *NodeData
	ShouldCodegen bool
	depgraph      *depgraph.Depgraph
}
