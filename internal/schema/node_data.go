package schema

import (
	"fmt"
	"sort"
	"strconv"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/enum"
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
	EnumTable       bool
	DBRows          []map[string]interface{}
	tsEnums         []enum.Enum
}

func newNodeData(packageName string) *NodeData {
	nodeData := &NodeData{
		PackageName: packageName,
		NodeInfo:    nodeinfo.GetNodeInfo(packageName),
		EdgeInfo:    edge.NewEdgeInfo(packageName),
		ActionInfo:  action.NewActionInfo(),
	}
	nodeData.ConstantGroups = make(map[string]*ConstGroupInfo)
	return nodeData
}

func (nodeData *NodeData) addEnum(info *EnumInfo) {
	nodeData.tsEnums = append(nodeData.tsEnums, info.Enum)
}

func (nodeData *NodeData) GetTableName() string {
	return nodeData.TableName
}

func (nodeData *NodeData) GetQuotedTableName() string {
	return strconv.Quote(nodeData.TableName)
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

// HasJSONField returns a boolean indicating if this Node has any JSON fields
// If so, we disable StructScan because we don't implement driver.Value and calling row.StructScan()
// will fail since the datatype in the db doesn't map to what's in the struct
func (nodeData *NodeData) HasJSONField() bool {
	for _, field := range nodeData.FieldInfo.Fields {
		if field.GetCastToMethod() == "cast.UnmarshallJSON" {
			return true
		}
	}
	return false
}

func (nodeData *NodeData) HasPrivateField() bool {
	for _, field := range nodeData.FieldInfo.Fields {
		if field.Private() {
			return true
		}
	}
	return false
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

// return the list of unique nodes at the end of an association
// needed to import what's needed in generated code
type uniqueNodeInfo struct {
	Node        string
	PackageName string
}

// GetUniqueNodes returns node info that this Node has edges to
func (nodeData *NodeData) GetUniqueNodes() []uniqueNodeInfo {
	return nodeData.getUniqueNodes(false)
}

func (nodeData *NodeData) GetTSEnums() []enum.Enum {
	return nodeData.tsEnums
}

type ImportPath struct {
	PackagePath   string
	Import        string
	DefaultImport bool
}

// GetImportsForBaseFile returns list of imports needed in the base generated file
func (nodeData *NodeData) GetImportsForBaseFile() []ImportPath {
	var ret []ImportPath
	for _, nodeInfo := range nodeData.getUniqueNodes(false) {
		ret = append(ret, ImportPath{
			Import:        nodeInfo.Node,
			PackagePath:   getImportPathForEntModelFile(nodeInfo.PackageName),
			DefaultImport: true,
		})
	}

	for _, enum := range nodeData.tsEnums {
		if enum.Imported {
			ret = append(ret, ImportPath{
				Import:      enum.Name,
				PackagePath: getImportPathForEnumFile(&enum),
			})
		}
	}
	return ret
}

// GetImportPathsForDependencies returns imports needed in dependencies e.g. actions and builders
func (nodeData *NodeData) GetImportPathsForDependencies() []ImportPath {
	var ret []ImportPath
	for _, f := range nodeData.FieldInfo.Fields {
		entType := f.GetFieldType()
		enumType, ok := entType.(enttype.EnumeratedType)
		if !ok {
			continue
		}

		ret = append(ret, ImportPath{
			Import:      enumType.GetTSType(),
			PackagePath: getImportPathForBaseModelFile(nodeData.PackageName),
		})
	}

	// unique nodes referenced in builder
	uniqueNodes := nodeData.getUniqueNodes(true)
	for _, unique := range uniqueNodes {
		ret = append(ret, ImportPath{
			Import:        unique.Node,
			PackagePath:   fmt.Sprintf("src/ent/%s", unique.PackageName),
			DefaultImport: true,
		})
	}

	return ret
}

// copied from internal/tscode/step.go
func getImportPathForBaseModelFile(packageName string) string {
	return fmt.Sprintf("src/ent/generated/%s_base", packageName)
}

func getImportPathForEntModelFile(packageName string) string {
	return fmt.Sprintf("src/ent/%s", packageName)
}

func getImportPathForEnumFile(enum *enum.Enum) string {
	return fmt.Sprintf("src/ent/generated/%s", strcase.ToSnake(enum.Name))
}

// don't need this distinction at the moment but why not
func (nodeData *NodeData) getUniqueNodes(forceSelf bool) []uniqueNodeInfo {
	var ret []uniqueNodeInfo
	m := make(map[string]bool)
	processNode := func(nodeInfo nodeinfo.NodeInfo) {
		node := nodeInfo.Node
		if !m[node] {
			ret = append(ret, uniqueNodeInfo{
				Node:        node,
				PackageName: nodeInfo.PackageName,
			})
		}
		m[node] = true
	}

	if forceSelf {
		processNode(nodeData.NodeInfo)
	}

	for _, edge := range nodeData.EdgeInfo.Associations {
		processNode(edge.NodeInfo)
	}

	for _, edge := range nodeData.EdgeInfo.ForeignKeys {
		processNode(edge.NodeInfo)
	}

	// we get id fields from this...
	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		processNode(edge.NodeInfo)
	}
	return ret
}
