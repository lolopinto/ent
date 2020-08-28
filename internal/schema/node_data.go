package schema

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

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
	var ret []enum.Enum
	for _, f := range nodeData.FieldInfo.Fields {
		entType := f.GetFieldType()
		enumType, ok := entType.(enttype.EnumeratedType)
		if !ok {
			continue
		}
		values := enumType.GetEnumValues()
		vals := make([]enum.Data, len(values))
		for i, val := range values {
			vals[i] = enum.Data{
				Name: strcase.ToCamel(val),
				// value is actually what's put there for now
				// TODO we need to figure out if there's a standard here
				// or a way to have keys: values for the generated enums
				Value: strconv.Quote(val),
			}
		}
		ret = append(ret, enum.Enum{
			Name:   enumType.GetTSType(),
			Values: vals,
		})
	}
	return ret
}

func (nodeData *NodeData) GetGraphQLEnums() []enum.GQLEnum {
	var ret []enum.GQLEnum
	for _, f := range nodeData.FieldInfo.Fields {
		entType := f.GetFieldType()
		enumType, ok := entType.(enttype.EnumeratedType)
		if !ok {
			continue
		}
		values := enumType.GetEnumValues()
		vals := make([]enum.Data, len(values))
		for i, val := range values {
			vals[i] = enum.Data{
				Name: strings.ToUpper(val),
				// norm for graphql enums is all caps
				Value: strconv.Quote(strings.ToUpper(val)),
			}
		}
		ret = append(ret, enum.GQLEnum{
			Name:   enumType.GetGraphQLName(),
			Type:   enumType.GetGraphQLType(),
			Values: vals,
		})
	}
	return ret
}

type importPath struct {
	PackagePath   string
	Import        string
	DefaultImport bool
}

// get things that need to be programmatically imported
// for now
func (nodeData *NodeData) GetImportPaths() []importPath {
	var ret []importPath
	for _, f := range nodeData.FieldInfo.Fields {
		entType := f.GetFieldType()
		enumType, ok := entType.(enttype.EnumeratedType)
		if !ok {
			continue
		}

		ret = append(ret, importPath{
			Import:      enumType.GetTSType(),
			PackagePath: getImportPathForBaseModelFile(nodeData),
		})
	}

	// unique nodes referenced in builder
	uniqueNodes := nodeData.getUniqueNodes(true)
	for _, unique := range uniqueNodes {
		ret = append(ret, importPath{
			Import:        unique.Node,
			PackagePath:   fmt.Sprintf("src/ent/%s", unique.PackageName),
			DefaultImport: true,
		})
	}

	return ret
}

// copied to internal/schema/node_data.go
func getImportPathForBaseModelFile(nodeData *NodeData) string {
	return fmt.Sprintf("src/ent/generated/%s_base", nodeData.PackageName)
}

func (nodeData *NodeData) GetUniqueNodesForceSelf() []uniqueNodeInfo {
	return nodeData.getUniqueNodes(true)
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
