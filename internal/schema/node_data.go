package schema

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
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
	objWithConsts
	PackageName     string
	FieldInfo       *field.FieldInfo
	EdgeInfo        *edge.EdgeInfo
	TableName       string
	ActionInfo      *action.ActionInfo
	HideFromGraphQL bool
	EnumTable       bool
	DBRows          []map[string]interface{}
	tsEnums         []*enum.Enum
	// fine to just reuse input constraints for now
	Constraints []*input.Constraint
	// same as above. fine to just reuse
	Indices []*input.Index
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

func (nodeData *NodeData) GetNodeInstance() string {
	return nodeData.NodeInstance
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

func (nodeData *NodeData) GetDestinationEdgeByName(edgeName string) edge.ConnectionEdge {
	if nodeData.EdgeInfo == nil {
		return nil
	}
	return nodeData.EdgeInfo.GetDestinationEdgeByName(edgeName)
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

func (nodeData *NodeData) HasAssociationEdges() bool {
	return nodeData.EdgeInfo.HasAssociationEdges()
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

func (nodeData *NodeData) GetTSEnums() []*enum.Enum {
	return nodeData.tsEnums
}

type ImportPath struct {
	PackagePath   string
	Import        string
	DefaultImport bool
}

// GetImportsForBaseFile returns list of imports needed in the base generated file
func (nodeData *NodeData) GetImportsForBaseFile() ([]ImportPath, error) {
	ret := []ImportPath{
		{
			Import:        "schema",
			DefaultImport: true,
			PackagePath:   fmt.Sprintf("src/schema/%s", nodeData.PackageName),
		},
	}
	for _, nodeInfo := range nodeData.getUniqueNodes(false) {
		ret = append(ret, ImportPath{
			Import:      nodeInfo.Node,
			PackagePath: codepath.GetInternalImportPath(),
		})
	}

	for _, enum := range nodeData.tsEnums {
		if enum.Imported {
			ret = append(ret, ImportPath{
				Import:      enum.Name,
				PackagePath: codepath.GetInternalImportPath(),
			})
		}
	}

	for _, edge := range nodeData.EdgeInfo.GetConnectionEdges() {
		ret = append(ret, ImportPath{
			Import:      edge.TsEdgeQueryName(),
			PackagePath: codepath.GetInternalImportPath(),
		})
	}

	for _, f := range nodeData.FieldInfo.Fields {
		if f.Index() && f.EvolvedIDField() {
			imp, err := nodeData.GetFieldQueryName(f)
			if err != nil {
				return nil, err
			}
			ret = append(ret, ImportPath{
				Import:      imp,
				PackagePath: codepath.GetInternalImportPath(),
			})
		}

		t := f.GetFieldType()
		if enttype.IsConvertDataType(t) {
			t2 := t.(enttype.ConvertDataType)
			c := t2.Convert()
			if string(c.ImportType) != "" {
				ret = append(ret, ImportPath{
					Import: c.Type,
					// TODO currently hardcoded
					// TODO need to kill this ImportType nonsense
					// getGQLFileImports checks the different values
					PackagePath: codepath.Package,
				})
			}
		}
		if enttype.IsImportDepsType(t) {
			t2 := t.(enttype.ImportDepsType)
			imp := t2.GetImportDepsType()
			if imp != nil {
				// TODO ignoring relative. do we need it?
				ret = append(ret, ImportPath{
					PackagePath: imp.Path,
					Import:      imp.Type,
				})
			}
		}
	}
	return ret, nil
}

// GetImportPathsForDependencies returns imports needed in dependencies e.g. actions and builders
func (nodeData *NodeData) GetImportPathsForDependencies() []ImportPath {
	var ret []ImportPath

	for _, enum := range nodeData.GetTSEnums() {
		ret = append(ret, ImportPath{
			Import:      enum.Name,
			PackagePath: codepath.GetExternalImportPath(),
		})
	}

	// unique nodes referenced in builder
	uniqueNodes := nodeData.getUniqueNodes(true)
	for _, unique := range uniqueNodes {
		ret = append(ret, ImportPath{
			Import:      unique.Node,
			PackagePath: codepath.GetExternalImportPath(),
		})
	}

	for _, f := range nodeData.FieldInfo.Fields {
		t := f.GetFieldType()
		if enttype.IsImportDepsType(t) {
			t2 := t.(enttype.ImportDepsType)
			imp := t2.GetImportDepsType()
			if imp != nil {
				ret = append(ret, ImportPath{
					PackagePath: imp.Path,
					Import:      imp.Type,
				})
			}
		}
	}

	return ret
}

func (nodeData *NodeData) GetImportsForQueryBaseFile(s *Schema) ([]ImportPath, error) {
	var ret []ImportPath

	for _, unique := range nodeData.getUniqueNodes(true) {
		ret = append(ret, ImportPath{
			Import:      unique.Node,
			PackagePath: codepath.GetInternalImportPath(),
		})
	}

	// for each edge, find the node, and then find the downstream edges for those
	for _, edge := range nodeData.EdgeInfo.Associations {
		if edge.PolymorphicEdge() {
			ret = append(ret, ImportPath{
				Import:      "Ent",
				PackagePath: codepath.Package,
			})
			continue
		}

		node, err := s.GetNodeDataForNode(edge.NodeInfo.Node)
		if err != nil {
			return nil, err
		}
		// need a flag of if imported or something
		for _, edge2 := range node.EdgeInfo.Associations {
			ret = append(ret, ImportPath{
				Import:      edge2.TsEdgeQueryName(),
				PackagePath: codepath.GetInternalImportPath(),
			})
		}
	}

	for _, edge := range nodeData.EdgeInfo.GetEdgesForIndexLoader() {
		ret = append(ret, ImportPath{
			Import:      fmt.Sprintf("%sLoader", edge.GetNodeInfo().NodeInstance),
			PackagePath: codepath.GetInternalImportPath(),
		})
	}

	return ret, nil
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
		if edge.PolymorphicEdge() {
			continue
		}
		processNode(edge.NodeInfo)
	}

	for _, edge := range nodeData.EdgeInfo.DestinationEdges {
		processNode(edge.GetNodeInfo())
	}

	// we get id fields from this...
	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		processNode(edge.NodeInfo)
	}
	return ret
}

type loader struct {
	Name string
	Pkey string
}

func (nodeData *NodeData) GetNodeLoaders() []*loader {
	ret := []*loader{
		{
			Name: fmt.Sprintf("%sLoader", nodeData.NodeInstance),
			Pkey: strconv.Quote("id"),
		},
	}

	for _, field := range nodeData.FieldInfo.Fields {
		if field.Unique() {
			ret = append(ret, &loader{
				Name: nodeData.GetFieldLoaderName(field),
				Pkey: field.GetQuotedDBColName(),
			})
		}
	}
	return ret
}

func (nodeData *NodeData) GetFieldLoaderName(field *field.Field) string {
	return fmt.Sprintf("%s%sLoader", nodeData.NodeInstance, field.CamelCaseName())
}

func (nodeData *NodeData) GetFieldQueryName(field *field.Field) (string, error) {
	if !field.Index() {
		return "", fmt.Errorf("cannot call GetFieldQueryName on field %s since it's not an indexed field", field.FieldName)
	}

	fieldName := strcase.ToCamel(strings.TrimSuffix(field.FieldName, "ID"))
	return fmt.Sprintf("%sTo%sQuery", fieldName, strcase.ToCamel(inflection.Plural(nodeData.Node))), nil
}
