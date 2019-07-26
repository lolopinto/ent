package schema

import (
	"strconv"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
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
	Constants []ConstInfo
}

type NodeData struct {
	codegen.NodeInfo
	PackageName    string
	FieldInfo      *field.FieldInfo
	EdgeInfo       *edge.EdgeInfo
	TableName      string
	ConstantGroups []ConstGroupInfo
	ActionInfo     *action.ActionInfo
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
	return nodeData.FieldInfo.GetFieldByName(fieldName)
}

func (nodeData *NodeData) GetFieldEdgeByName(edgeName string) *edge.FieldEdge {
	return nodeData.EdgeInfo.GetFieldEdgeByName(edgeName)
}

func (nodeData *NodeData) GetForeignKeyEdgeByName(edgeName string) *edge.ForeignKeyEdge {
	return nodeData.EdgeInfo.GetForeignKeyEdgeByName(edgeName)
}

func (nodeData *NodeData) GetAssociationEdgeByName(edgeName string) *edge.AssociationEdge {
	return nodeData.EdgeInfo.GetAssociationEdgeByName(edgeName)
}

func (nodeData *NodeData) GetActionByGraphQLName(graphQLName string) action.Action {
	return nodeData.ActionInfo.GetByGraphQLName(graphQLName)
}
