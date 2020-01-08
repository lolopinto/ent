package schema

import (
	"sort"
	"strconv"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/util"
)

type ConstInfo struct {
	ConstName  string
	ConstValue string
	Comment    string
}

type ConstGroupInfo struct {
	ConstType string
	Constants map[string]*ConstInfo
}

func (cg *ConstGroupInfo) GetSortedConstants() []*ConstInfo {
	var sorted []*ConstInfo

	for _, constant := range cg.Constants {
		sorted = append(sorted, constant)
	}

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].ConstName < sorted[j].ConstName
	})

	return sorted
}

func (cg *ConstGroupInfo) CreateNewType() bool {
	if cg.ConstType == "ent.NodeType" || cg.ConstType == "ent.EdgeType" {
		return false
	}
	return true
}

type NodeData struct {
	nodeinfo.NodeInfo
	PackageName     string
	FieldInfo       *field.FieldInfo
	EdgeInfo        *edge.EdgeInfo
	TableName       string
	ConstantGroups  map[string]*ConstGroupInfo
	ActionInfo      *action.ActionInfo
	HideFromGraphQL bool
}

func newNodeData(packageName string) *NodeData {
	nodeData := &NodeData{
		PackageName: packageName,
		NodeInfo:    nodeinfo.GetNodeInfo(packageName),
		EdgeInfo:    edge.NewEdgeInfo(),
		ActionInfo:  action.NewActionInfo(),
	}
	nodeData.ConstantGroups = make(map[string]*ConstGroupInfo)
	return nodeData
}

func (nodeData *NodeData) GetTableName() string {
	tableName, err := strconv.Unquote(nodeData.TableName)
	util.Die(err)

	return tableName
}

// probably not needed?
func (nodeData *NodeData) GetQuotedTableName() string {
	return nodeData.TableName
}

func (nodeData *NodeData) GetFieldByName(fieldName string) *field.Field {
	// all these extra checks needed from places (tests) which create objects on their own
	if nodeData.FieldInfo == nil {
		return nil
	}
	return nodeData.FieldInfo.GetFieldByName(fieldName)
}

func (nodeData *NodeData) GetFieldEdgeByName(edgeName string) *edge.FieldEdge {
	if nodeData.EdgeInfo == nil {
		return nil
	}
	return nodeData.EdgeInfo.GetFieldEdgeByName(edgeName)
}

func (nodeData *NodeData) GetForeignKeyEdgeByName(edgeName string) *edge.ForeignKeyEdge {
	if nodeData.EdgeInfo == nil {
		return nil
	}
	return nodeData.EdgeInfo.GetForeignKeyEdgeByName(edgeName)
}

func (nodeData *NodeData) GetAssociationEdgeByName(edgeName string) *edge.AssociationEdge {
	if nodeData.EdgeInfo == nil {
		return nil
	}
	return nodeData.EdgeInfo.GetAssociationEdgeByName(edgeName)
}

func (nodeData *NodeData) GetActionByGraphQLName(graphQLName string) action.Action {
	if nodeData.ActionInfo == nil {
		return nil
	}
	return nodeData.ActionInfo.GetByGraphQLName(graphQLName)
}

func (nodeData *NodeData) addConstInfo(constType string, constName string, constInfo *ConstInfo) {
	constGroup := nodeData.ConstantGroups[constType]
	if constGroup == nil {
		constGroup = &ConstGroupInfo{
			ConstType: constType,
		}
		nodeData.ConstantGroups[constType] = constGroup
	}
	if constGroup.Constants == nil {
		constGroup.Constants = make(map[string]*ConstInfo)
	}
	constGroup.Constants[constName] = constInfo
}

func (nodeData *NodeData) GetSortedConstantGroups() []*ConstGroupInfo {
	var sorted []*ConstGroupInfo

	for _, group := range nodeData.ConstantGroups {
		sorted = append(sorted, group)
	}

	// manual sorting to make sure ent.NodeType then ent.EdgeType then sorted by name
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[j].ConstType == "ent.NodeType" {
			return false
		}
		if sorted[i].ConstType == "ent.NodeType" {
			return true
		}
		if sorted[j].ConstType == "ent.EdgeType" {
			return false
		}
		if sorted[i].ConstType == "ent.EdgeType" {
			return true
		}
		return sorted[i].ConstType < sorted[j].ConstType
	})

	return sorted
}

func (nodeData *NodeData) HasAssocGroups() bool {
	length := len(nodeData.EdgeInfo.AssocGroups)
	if length > 1 {
		panic("TODO: fix EdgeGroupMuationBuilder to work for more than 1 assoc group")
	}
	return length > 0
}
