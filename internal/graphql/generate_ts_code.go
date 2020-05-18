package graphql

import (
	"fmt"
	"strings"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type TSStep struct {
}

func (p *TSStep) Name() string {
	return "graphql"
}

func (p *TSStep) ProcessData(data *codegen.Data) error {
	var wg sync.WaitGroup
	wg.Add(len(data.Schema.Nodes))
	var serr syncerr.Error

	nodeMap := data.Schema.Nodes
	for key := range data.Schema.Nodes {
		go func(key string) {
			defer wg.Done()

			info := data.Schema.Nodes[key]
			nodeData := info.NodeData

			// nothing to do here
			if nodeData.HideFromGraphQL {
				return
			}

			if err := writeTypeFile(nodeMap, nodeData); err != nil {
				serr.Append(err)
				return
			}
		}(key)
	}
	wg.Wait()

	if err := serr.Err(); err != nil {
		return err
	}
	return writeQueryFile(data)
}

var _ codegen.Step = &TSStep{}

func getFilePathForObjectFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", nodeData.PackageName)
}

func getQueryFilePath() string {
	return fmt.Sprintf("src/graphql/resolvers/generated/query_type.ts")
}

type gqlobjectData struct {
	NodeData    *schema.NodeData
	GQLNode     nodeType
	FieldConfig fieldConfig
}

// write graphql file
func writeTypeFile(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlobjectData{
			NodeData: nodeData,
			// TODO this becomes nodes once we move to mutation and all the types involved
			GQLNode:     buildNodeForObject(nodeMap, nodeData),
			FieldConfig: buildFieldConfig(nodeData),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/object.tmpl"),
		TemplateName:      "object.tmpl",
		PathToFile:        getFilePathForObjectFile(nodeData),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

type fieldConfig struct {
	Exported         bool
	Name             string
	Arg              string
	Type             string
	Args             []fieldConfigArg
	FunctionContents string
}

type fieldConfigArg struct {
	Name        string
	Description string
	Imports     []string
}

func (f fieldConfigArg) FieldType() string {
	return typeFromImports(f.Imports)
}

func buildFieldConfig(nodeData *schema.NodeData) fieldConfig {
	return fieldConfig{
		Exported: true,
		Name:     fmt.Sprintf("%sQuery", nodeData.Node),
		Arg:      fmt.Sprintf("%sQueryArgs", nodeData.Node),
		Type:     fmt.Sprintf("%sType", nodeData.Node),
		Args: []fieldConfigArg{
			{
				Name:        "id",
				Description: "id",
				Imports:     []string{"GraphQLID"},
			},
		},
		FunctionContents: fmt.Sprintf("return %s.load(context.viewer, args.id);", nodeData.Node),
	}
}

func buildNodeForObject(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) nodeType {
	result := nodeType{
		Type:     fmt.Sprintf("%sType", nodeData.Node),
		Node:     nodeData.Node,
		GQLType:  "GraphQLObjectType",
		Exported: true,
	}

	for _, node := range nodeData.GetUniqueNodes() {
		// no need to import yourself
		if node.Node == nodeData.Node {
			continue
		}
		result.Imports = append(result.Imports, queryGQLDatum{
			ImportPath:  fmt.Sprintf("./%s_type", node.PackageName),
			GraphQLType: fmt.Sprintf("%sType", node.Node),
		})
	}
	result.DefaultImports = append(result.DefaultImports, queryGQLDatum{
		ImportPath:  fmt.Sprintf("src/ent/%s", nodeData.PackageName),
		GraphQLType: nodeData.Node,
	})

	result.Interfaces = append(result.Interfaces, interfaceType{
		Name: fmt.Sprintf("%sQueryArgs", nodeData.Node),
		Fields: []interfaceField{
			{
				Name:      "id",
				Type:      "ID",
				UseImport: true,
			},
		},
	})

	instance := nodeData.NodeInstance

	fieldInfo := nodeData.FieldInfo
	var fields []fieldType
	for _, field := range fieldInfo.GraphQLFields() {
		gqlField := fieldType{
			Name:               field.GetGraphQLName(),
			HasResolveFunction: field.GetGraphQLName() != field.TsFieldName(),
			FieldImports:       field.GetTSGraphQLTypeForFieldImports(),
		}
		if gqlField.HasResolveFunction {
			gqlField.FunctionContents = fmt.Sprintf("return %s.%s;", instance, field.TsFieldName())
		}
		fields = append(fields, gqlField)
	}

	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		// TODO this shouldn't be here but be somewhere else...
		if f != nil {
			fieldInfo.InvalidateFieldForGraphQL(f)
		}
		addSingularEdge(edge, &fields, instance)
	}

	for _, edge := range nodeData.EdgeInfo.Associations {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		if edge.Unique {
			addSingularEdge(edge, &fields, instance)
		} else {
			addPluralEdge(edge, &fields, instance)
		}
	}

	for _, edge := range nodeData.EdgeInfo.ForeignKeys {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		addPluralEdge(edge, &fields, instance)
	}
	result.Fields = fields
	return result
}

func addSingularEdge(edge edge.Edge, fields *[]fieldType, instance string) {
	gqlField := fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       edge.GetTSGraphQLTypeImports(),
		FunctionContents:   fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName()),
	}
	*fields = append(*fields, gqlField)
}

func addPluralEdge(edge edge.Edge, fields *[]fieldType, instance string) {
	gqlField := fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       edge.GetTSGraphQLTypeImports(),
		FunctionContents:   fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName()),
	}
	*fields = append(*fields, gqlField)
}

type nodeType struct {
	Type     string
	Node     string
	Fields   []fieldType
	Exported bool
	GQLType  string // for now only GraphQLObjectType

	// TODO will soon need to allow calling import multiple times for the same path
	DefaultImports []queryGQLDatum
	Imports        []queryGQLDatum
	Interfaces     []interfaceType
}

type fieldType struct {
	Name               string
	HasResolveFunction bool
	FieldImports       []string

	// no args for now. come back.
	FunctionContents string // TODO
	// TODO more types we need to support
}

type interfaceType struct {
	Exported bool
	Name     string
	Fields   []interfaceField
}

type interfaceField struct {
	Name      string
	Type      string
	UseImport bool
}

func typeFromImports(imports []string) string {
	var sb strings.Builder
	var endSb strings.Builder
	for idx, imp := range imports {
		// only need to write () if we have more than one
		if idx != 0 {
			sb.WriteString("(")
			endSb.WriteString(")")
		}
		sb.WriteString(imp)
	}
	sb.WriteString(endSb.String())
	return sb.String()
}

func (f *fieldType) FieldType() string {
	return typeFromImports(f.FieldImports)
}

// TODO rename this...
type queryGQLDatum struct {
	ImportPath  string
	GraphQLName string
	GraphQLType string
}

type gqlQueryData struct {
	Queries []queryGQLDatum
}

func getQueryData(data *codegen.Data) []queryGQLDatum {
	var results []queryGQLDatum
	for key := range data.Schema.Nodes {

		nodeData := data.Schema.Nodes[key].NodeData
		if nodeData.HideFromGraphQL {
			continue
		}
		results = append(results, queryGQLDatum{
			ImportPath:  fmt.Sprintf("./%s_type", nodeData.PackageName),
			GraphQLType: fmt.Sprintf("%sQuery", nodeData.Node),
			GraphQLName: strcase.ToLowerCamel(nodeData.Node),
		})

	}
	return results
}

func writeQueryFile(data *codegen.Data) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlQueryData{
			Queries: getQueryData(data),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/query.tmpl"),
		TemplateName:      "query.tmpl",
		PathToFile:        getQueryFilePath(),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}
