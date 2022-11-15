package schema

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
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
	Indices            []*input.Index
	PatternsWithMixins []string

	schemaPath string

	TransformsSelect bool
	TransformsDelete bool
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

func (nodeData *NodeData) addEnum(e *enum.Enum) {
	// this includes enums referenced in schema and enums referenced in patterns
	nodeData.tsEnums = append(nodeData.tsEnums, e)
}

func (nodeData *NodeData) GetNodeInstance() string {
	return nodeData.NodeInstance
}

func (nodeData *NodeData) GetTableName() string {
	return nodeData.TableName
}

func (nodeData *NodeData) GetGraphQLTypeName() string {
	return fmt.Sprintf("%sType", strcase.ToCamel(nodeData.Node))
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

func (nodeData *NodeData) HasPrivateField(cfg codegenapi.Config) bool {
	for _, field := range nodeData.FieldInfo.Fields {
		if field.Private(cfg) {
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

func (nodeData *NodeData) FieldsWithFieldPrivacy() bool {
	for _, f := range nodeData.FieldInfo.Fields {
		if f.HasFieldPrivacy() {
			return true
		}
	}
	return false
}

func (nodeData *NodeData) OnEntLoadFieldPrivacy(cfg codegenapi.Config) bool {
	if !nodeData.FieldsWithFieldPrivacy() {
		return false
	}
	return cfg.FieldPrivacyEvaluated() == codegenapi.AtEntLoad
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

// TODO kill this
// GetImportsForBaseFile returns list of imports needed in the base generated file
func (nodeData *NodeData) GetImportsForBaseFile(s *Schema, cfg codegenapi.Config) ([]*tsimport.ImportPath, error) {
	ret := []*tsimport.ImportPath{
		{
			Import:        "schema",
			DefaultImport: true,
			ImportPath:    nodeData.GetSchemaPath(),
		},
	}
	for _, nodeInfo := range nodeData.getUniqueNodes(false) {
		ret = append(ret, &tsimport.ImportPath{
			Import:     nodeInfo.Node,
			ImportPath: codepath.GetInternalImportPath(),
		})
	}

	for _, enum := range nodeData.tsEnums {
		ret = append(ret, &tsimport.ImportPath{
			Import:     enum.Name,
			ImportPath: codepath.GetTypesImportPath(),
		})
	}

	for _, edge := range nodeData.EdgeInfo.GetConnectionEdges() {
		ret = append(ret, &tsimport.ImportPath{
			Import:     edge.TsEdgeQueryName(),
			ImportPath: codepath.GetInternalImportPath(),
		})
	}

	for _, p := range nodeData.PatternsWithMixins {
		pattern := s.Patterns[p]
		if pattern == nil {
			return nil, fmt.Errorf("couldn't find pattern info with name %s", p)
		}
		ret = append(ret, &tsimport.ImportPath{
			Import:     pattern.GetMixinName(),
			ImportPath: codepath.GetInternalImportPath(),
		})
		ret = append(ret, &tsimport.ImportPath{
			Import:     pattern.GetMixinInterfaceName(),
			ImportPath: codepath.GetInternalImportPath(),
		})
	}

	for _, f := range nodeData.FieldInfo.Fields {
		if f.Index() && f.EvolvedIDField() {
			imp, err := nodeData.GetFieldQueryName(f)
			if err != nil {
				return nil, err
			}
			ret = append(ret, &tsimport.ImportPath{
				Import:     imp,
				ImportPath: codepath.GetInternalImportPath(),
			})
		}

		ret = append(ret, f.GetImportsForTypes(cfg, s)...)
	}
	return ret, nil
}

// TODO kill
// seems like it was mostly used for enums
func (nodeData *NodeData) ForeignImport(imp string) bool {
	// not the most performant but ok
	// most classes won't have that many enums
	// for _, enum := range nodeData.tsEnums {
	// 	if enum.Imported {
	// 		continue
	// 	}
	// 	if enum.Name == imp {
	// 		return false
	// 	}
	// }
	return true
}

// TODO kill this
// GetImportPathsForDependencies returns imports needed in dependencies e.g. actions and builders
func (nodeData *NodeData) GetImportPathsForDependencies(s *Schema) []*tsimport.ImportPath {
	var ret []*tsimport.ImportPath

	for _, enum := range nodeData.GetTSEnums() {
		ret = append(ret, &tsimport.ImportPath{
			Import:     enum.Name,
			ImportPath: codepath.GetTypesImportPath(),
		})
	}

	// unique nodes referenced in builder
	uniqueNodes := nodeData.getUniqueNodes(true)
	for _, unique := range uniqueNodes {
		ret = append(ret, &tsimport.ImportPath{
			Import:     unique.Node,
			ImportPath: codepath.GetExternalImportPath(),
		})
	}

	for _, f := range nodeData.FieldInfo.Fields {
		t := f.GetFieldType()
		if enttype.IsImportDepsType(t) {
			t2 := t.(enttype.ImportDepsType)
			imp := t2.GetImportDepsType()
			if imp != nil {
				ret = append(ret, imp)
			}
		}
	}

	for _, edge := range nodeData.EdgeInfo.Associations {
		if edge.PatternName == "" {
			continue
		}
		p := s.Patterns[edge.PatternName]
		if p == nil || !p.HasBuilder() {
			continue
		}
		ret = append(ret, &tsimport.ImportPath{
			Import:     p.GetBuilderName(),
			ImportPath: getImportPathForMixinBuilderFile(p),
		})
	}

	return ret
}

// edges that are in the builder directly
func (nodeData *NodeData) BuilderEdges(s *Schema) []*edge.AssociationEdge {
	var ret []*edge.AssociationEdge

	for _, edge := range nodeData.EdgeInfo.Associations {
		if edge.PatternName == "" {
			ret = append(ret, edge)
			continue
		}
		p := s.Patterns[edge.PatternName]
		if p == nil || !p.HasBuilder() {
			ret = append(ret, edge)
		}
	}

	return ret
}

func getImportPathForMixinBuilderFile(pattern *PatternInfo) string {
	name := strcase.ToSnake(pattern.Name)
	return fmt.Sprintf("src/ent/generated/mixins/%s/actions/%s_builder", name, name)
}

// TODO kill this
func (nodeData *NodeData) GetImportsForQueryBaseFile(s *Schema) ([]*tsimport.ImportPath, error) {
	var ret []*tsimport.ImportPath

	for _, unique := range nodeData.getUniqueNodes(true) {
		ret = append(ret, &tsimport.ImportPath{
			Import:     unique.Node,
			ImportPath: codepath.GetInternalImportPath(),
		})
	}

	// for each edge, find the node, and then find the downstream edges for those
	for _, edge := range nodeData.EdgeInfo.Associations {
		if edge.PolymorphicEdge() {
			ret = append(ret, &tsimport.ImportPath{
				Import:     "Ent",
				ImportPath: codepath.Package,
			})
			continue
		}

		node, err := s.GetNodeDataForNode(edge.NodeInfo.Node)
		if err != nil {
			return nil, err
		}
		// need a flag of if imported or something
		for _, edge2 := range node.EdgeInfo.Associations {
			ret = append(ret, &tsimport.ImportPath{
				Import:     edge2.TsEdgeQueryName(),
				ImportPath: codepath.GetInternalImportPath(),
			})
		}
	}

	for _, edge := range nodeData.EdgeInfo.GetEdgesForIndexLoader() {
		ret = append(ret, &tsimport.ImportPath{
			Import:     fmt.Sprintf("%sLoader", edge.GetNodeInfo().NodeInstance),
			ImportPath: codepath.GetInternalImportPath(),
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
	Name                 string
	Pkey                 string
	AddTransformedClause bool
}

func (nodeData *NodeData) GetSchemaPath() string {
	if nodeData.schemaPath != "" {
		return strings.TrimSuffix(nodeData.schemaPath, ".ts")
	}
	return fmt.Sprintf("src/schema/%s", nodeData.PackageName)
}

func (nodeData *NodeData) OverrideSchemaPath(schemaPath string) {
	nodeData.schemaPath = schemaPath
}

func (nodeData *NodeData) GetSchemaConst() string {
	return nodeData.Node + "Schema"
}

func (nodeData *NodeData) GetLoaderName() string {
	return fmt.Sprintf("%sLoader", nodeData.NodeInstance)
}

func (nodeData *NodeData) GetLoaderNoTransformName() string {
	return fmt.Sprintf("%sNoTransformLoader", nodeData.NodeInstance)
}

// GetNodeLoaders returns groups of loaders that can be primed
// e.g. if there's a transform, loaders which query with transformation
// can prime the other but those which don't query with transformations
// can't be
func (nodeData *NodeData) GetNodeLoaders() [][]*loader {
	var group1 []*loader
	var group2 []*loader

	group1 = []*loader{
		{
			Name: nodeData.GetLoaderName(),
			// TODO https://github.com/lolopinto/ent/issues/1064 this shouldn't be hardcoded as id...
			Pkey:                 strconv.Quote("id"),
			AddTransformedClause: nodeData.TransformsSelect,
		},
	}
	// if transforms select. generate different loader
	// that skips it e.g. no deleted_at clause for said loader
	if nodeData.TransformsSelect {
		group2 = []*loader{
			{
				Name: nodeData.GetLoaderNoTransformName(),
				// TODO https://github.com/lolopinto/ent/issues/1064 this shouldn't be hardcoded as id...
				Pkey: strconv.Quote("id"),
			},
		}
	}

	for _, field := range nodeData.FieldInfo.Fields {
		if field.Unique() {
			group1 = append(group1, &loader{
				Name:                 nodeData.GetFieldLoaderName(field),
				Pkey:                 field.GetQuotedDBColName(),
				AddTransformedClause: nodeData.TransformsSelect,
			})
			// if transforms select. generate different loader
			// that skips it e.g. no deleted_at clause for said loader
			if nodeData.TransformsSelect {
				group2 = append(group2, &loader{
					Name: nodeData.GetFieldLoaderNoTransformName(field),
					Pkey: field.GetQuotedDBColName(),
				})
			}
		}
	}
	ret := [][]*loader{group1}
	if nodeData.TransformsSelect {
		ret = append(ret, group2)
	}
	return ret
}

func (nodeData *NodeData) GetFieldLoaderName(field *field.Field) string {
	return fmt.Sprintf("%s%sLoader", nodeData.NodeInstance, field.CamelCaseName())
}

func (nodeData *NodeData) GetFieldLoaderNoTransformName(field *field.Field) string {
	return fmt.Sprintf("%s%sNoTransformLoader", nodeData.NodeInstance, field.CamelCaseName())
}

func (nodeData *NodeData) GetFieldQueryName(field *field.Field) (string, error) {
	if !field.Index() {
		return "", fmt.Errorf("cannot call GetFieldQueryName on field %s since it's not an indexed field", field.FieldName)
	}

	fieldName := strcase.ToCamel(strings.TrimSuffix(field.FieldName, "ID"))
	return fmt.Sprintf("%sTo%sQuery", fieldName, strcase.ToCamel(inflection.Plural(nodeData.Node))), nil
}

func (nodeData *NodeData) HasMixins() bool {
	return len(nodeData.PatternsWithMixins) > 0
}

type mixinInfo struct {
	Imports    []*tsimport.ImportPath
	Extends    string
	Implements string
}

func (nodeData *NodeData) GetMixinInfo(s *Schema) (*mixinInfo, error) {
	var imps []*tsimport.ImportPath

	var extends strings.Builder
	var impls []string
	for _, p := range nodeData.PatternsWithMixins {
		pattern := s.Patterns[p]
		if pattern == nil {
			return nil, fmt.Errorf("couldn't find pattern info with name %s", p)
		}
		imps = append(imps, &tsimport.ImportPath{
			ImportPath: codepath.GetInternalImportPath(),
			Import:     pattern.GetMixinInterfaceName(),
		})
		imps = append(imps, &tsimport.ImportPath{
			ImportPath: codepath.GetInternalImportPath(),
			Import:     pattern.GetMixinName(),
		})
		extends.WriteString(pattern.GetMixinName())
		extends.WriteString("(")
		impls = append(impls, pattern.GetMixinInterfaceName())
	}
	extends.WriteString("class {}")
	extends.WriteString(strings.Repeat(")", len(nodeData.PatternsWithMixins)))

	return &mixinInfo{
		Imports:    imps,
		Extends:    extends.String(),
		Implements: strings.Join(impls, ", "),
	}, nil
}

func (nodeData *NodeData) GetBuilderMixinInfo(s *Schema) (*mixinInfo, error) {
	var imps []*tsimport.ImportPath

	var extends strings.Builder
	ct := 0
	for _, p := range nodeData.PatternsWithMixins {
		pattern := s.Patterns[p]
		if pattern == nil {
			return nil, fmt.Errorf("couldn't find pattern info with name %s", p)
		}
		if !pattern.HasBuilder() {
			continue
		}
		ct++
		imps = append(imps, &tsimport.ImportPath{
			ImportPath: getImportPathForMixinBuilderFile(pattern),
			Import:     pattern.GetBuilderName(),
		})
		extends.WriteString(pattern.GetBuilderName())
		extends.WriteString("(")
	}
	// generated by code
	extends.WriteString("Base")
	extends.WriteString(strings.Repeat(")", ct))

	return &mixinInfo{
		Imports: imps,
		Extends: extends.String(),
	}, nil
}

func (nodeData *NodeData) GenerateGetIDInBuilder() bool {
	// TODO https://github.com/lolopinto/ent/issues/1064
	idField := nodeData.FieldInfo.GetFieldByName("ID")
	if idField == nil {
		idField = nodeData.FieldInfo.GetFieldByName("id")
	}
	if idField == nil {
		return false
	}
	return idField.HasDefaultValueOnCreate()
}
