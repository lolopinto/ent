package main

import (
	"fmt"
	"sort"
	"strings"
	"text/template"

	"github.com/iancoleman/strcase"

	"github.com/davecgh/go-spew/spew"

	"github.com/lolopinto/ent/internal/edge"

	"github.com/lolopinto/ent/internal/field"

	"github.com/99designs/gqlgen/api"
	"github.com/lolopinto/ent/internal/util"

	"github.com/99designs/gqlgen/codegen/config"
)

type graphQLSchema struct {
	nodes       codegenMapInfo
	Types       map[string]*graphQLSchemaInfo
	sortedTypes []*graphQLSchemaInfo
}

func newGraphQLSchema(nodes codegenMapInfo) *graphQLSchema {
	types := make(map[string]*graphQLSchemaInfo)

	return &graphQLSchema{
		nodes: nodes,
		Types: types,
	}
}

func (schema *graphQLSchema) generateSchema() {
	schema.generateGraphQLSchemaData()

	schema.writeGraphQLSchema()

	schema.writeGQLGenYamlFile()

	schema.generateGraphQLCode()
}

func (schema *graphQLSchema) addSchemaInfo(info *graphQLSchemaInfo) {
	schema.Types[info.TypeName] = info
	schema.sortedTypes = append(schema.sortedTypes, info)
}

func (schema *graphQLSchema) buildGraphQLSchemaInfo(nodeData *nodeTemplate) *graphQLSchemaInfo {
	// Contact, User etc...
	schemaInfo := newGraphQLSchemaInfo("type", nodeData.Node)

	fieldInfo := nodeData.FieldInfo
	// for any edge fields that reference an existing ID field, invalidate the id field so that it's not exposed to GraphQL
	// TODO allow client to override this :(
	// TODO probably cleaner to be passed into field generation so that each part is siloed so an orchestrator handles this
	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		if f != nil {
			fieldInfo.InvalidateFieldForGraphQL(f)
		}
		schemaInfo.addFieldEdge(&graphqlFieldEdge{FieldEdge: edge})
	}

	for _, edge := range nodeData.EdgeInfo.Associations {
		schemaInfo.addPluralEdge(&graphqlPluralEdge{PluralEdge: edge})
	}

	for _, edge := range nodeData.EdgeInfo.ForeignKeys {
		schemaInfo.addPluralEdge(&graphqlPluralEdge{PluralEdge: edge})
	}

	// very simple, just get fields and create types. no nodes, edges, return ID fields etc
	// and then we go from there...

	for _, f := range nodeData.FieldInfo.Fields {
		expose, _ := f.ExposeToGraphQL()
		if !expose {
			continue
		}
		schemaInfo.addField(&graphQLField{Field: f})
	}

	return schemaInfo
}

func (schema *graphQLSchema) generateGraphQLSchemaData() {
	// top level quries that will show up e.g. user(id: ), account(id: ) etc
	// add everything as top level query for now
	var queryFields []*graphQLNonEntField
	for _, info := range schema.nodes {
		nodeData := info.nodeData

		queryFields = append(queryFields, &graphQLNonEntField{
			fieldName: nodeData.NodeInstance,
			fieldType: nodeData.Node,
			args: []*graphQLArg{
				&graphQLArg{
					fieldName: "id",
					fieldType: "ID!",
				},
			},
		})

		schemaInfo := schema.buildGraphQLSchemaInfo(nodeData)
		schema.addSchemaInfo(schemaInfo)
	}

	// add everything as top level query for now
	schema.addSchemaInfo(schema.getQuerySchemaType(queryFields))
}

func (schema *graphQLSchema) getQuerySchemaType(queryFields []*graphQLNonEntField) *graphQLSchemaInfo {
	return &graphQLSchemaInfo{
		Type:         "type",
		TypeName:     "Query",
		nonEntFields: queryFields,
	}
}

func getSortedTypes(t *graphqlSchemaTemplate) []*graphqlSchemaTypeInfo {
	// sort graphql types by type name so that we are not always changing the order of the generated schema
	sort.Slice(t.Types, func(i, j int) bool {
		return t.Types[i].TypeName < t.Types[j].TypeName
	})
	return t.Types
}

func (schema *graphQLSchema) writeGraphQLSchema() {
	writeFile(
		&templatedBasedFileWriter{
			data:              schema.getSchemaForTemplate(),
			pathToTemplate:    "templates/graphql/graphql_schema.tmpl",
			templateName:      "graphql_schema.tmpl",
			pathToFile:        "graphql/schema.graphql",
			createDirIfNeeded: true,
			funcMap: template.FuncMap{
				"sortedTypes": getSortedTypes,
			},
		},
	)
}

func (schema *graphQLSchema) writeGQLGenYamlFile() {
	// TODO use 	"github.com/99designs/gqlgen/codegen/config
	c := newGraphQLYamlConfig()

	c.addSchema()
	c.addModelsConfig(schema)
	c.addExecConfig()
	c.addModelConfig()
	///c.addResolverConfig() // don't need this since we're handling this ourselves

	writeFile(
		&yamlFileWriter{
			data:              c.m,
			pathToFile:        "graphql/gqlgen.yml",
			createDirIfNeeded: true,
		},
	)
}

func (schema *graphQLSchema) generateGraphQLCode() {
	cfg, err := config.LoadConfig("graphql/gqlgen.yml")
	// TODO
	util.Die(err)

	// We're handling the Resolver generation instead of using the stub graphqlgen produces.
	// We build on the default implementation they support and go from there.
	err = api.Generate(
		cfg,
		api.AddPlugin(newGraphQLResolverPlugin(schema.nodes)),
		api.AddPlugin(newGraphQLServerPlugin()),
	)
	util.Die(err)
}

// get the schema that will be passed to the template for rendering in a schema file
func (schema *graphQLSchema) getSchemaForTemplate() *graphqlSchemaTemplate {
	ret := &graphqlSchemaTemplate{}

	for _, typ := range schema.Types {

		var lines []string
		for _, f := range typ.fields {
			lines = append(lines, f.GetSchemaLine())
		}
		for _, f := range typ.nonEntFields {
			lines = append(lines, f.GetSchemaLine())
		}
		for _, f := range typ.fieldEdges {
			lines = append(lines, f.GetSchemaLine())
		}
		for _, e := range typ.pluralEdges {
			lines = append(lines, e.GetSchemaLine())
		}

		// sort lines. TDOO best presentation?
		sort.Slice(lines, func(i, j int) bool {
			return lines[i] < lines[j]
		})

		ret.Types = append(ret.Types, &graphqlSchemaTypeInfo{
			Type:        typ.Type,
			TypeName:    typ.TypeName,
			SchemaLines: lines,
		})
	}
	return ret
}

type graphqlLineItem interface {
	GetSchemaLine() string
}

// TODO build more on this later
// graphQLArg represents arguments to a graphql field/mutation etc
type graphQLArg struct {
	fieldName string
	fieldType string
}

func getArgsStr(args []*graphQLArg) string {
	var parts []string
	for _, arg := range args {
		parts = append(parts, fmt.Sprintf("%s: %s", arg.fieldName, arg.fieldType))
	}

	return strings.Join(parts, ", ")
}

// todo build more on this later
// graphQLNonEntField represents a single graphql field not gotten from the entconfig
// of which we know the graphql fieldName and fieldType
type graphQLNonEntField struct {
	fieldName string
	fieldType string
	args      []*graphQLArg
}

func (f *graphQLNonEntField) GetSchemaLine() string {
	if len(f.args) > 0 {
		return fmt.Sprintf(
			"%s(%s): %s",
			f.fieldName,
			getArgsStr(f.args),
			f.fieldType,
		)
	}

	return fmt.Sprintf("%s: %s", f.fieldName, f.fieldType)
}

type graphqlEdge interface {
	graphqlLineItem
	GetEdgeName() string
}

type graphQLField struct {
	*field.Field
}

func (f *graphQLField) GetSchemaLine() string {
	// TODO break expose and fieldName again
	_, fieldName := f.ExposeToGraphQL()

	return fmt.Sprintf("%s: %s", fieldName, f.GetGraphQLTypeForField())
}

type graphqlFieldEdge struct {
	*edge.FieldEdge
}

func (e *graphqlFieldEdge) GetSchemaLine() string {
	// TODO allow overrides of this
	edgeName := strcase.ToLowerCamel(e.EdgeName)
	nodeName := e.NodeInfo.Node

	// allow nullable
	return fmt.Sprintf("%s: %s", edgeName, nodeName)
}

type graphqlPluralEdge struct {
	edge.PluralEdge
}

func (e *graphqlPluralEdge) GetSchemaLine() string {
	// TODO allow overrides of this
	edgeName := strcase.ToLowerCamel(e.GetEdgeName())
	nodeName := e.GetNodeInfo().Node

	// ent always returns a slice and filters out empty objects so signature here is as-is
	// It's confusing tho...
	return fmt.Sprintf("%s: [%s!]!", edgeName, nodeName)
}

type graphQLSchemaInfo struct {
	Type          string
	TypeName      string
	fields        []*graphQLField
	fieldEdges    []*graphqlFieldEdge
	fieldMap      map[string]*graphQLField
	fieldEdgeMap  map[string]*graphqlFieldEdge
	pluralEdgeMap map[string]*graphqlPluralEdge
	pluralEdges   []*graphqlPluralEdge
	nonEntFields  []*graphQLNonEntField
}

func newGraphQLSchemaInfo(typ, typeName string) *graphQLSchemaInfo {
	fieldMap := make(map[string]*graphQLField)
	fieldEdgeMap := make(map[string]*graphqlFieldEdge)
	pluralEdgeMap := make(map[string]*graphqlPluralEdge)
	return &graphQLSchemaInfo{
		Type:          typ,
		TypeName:      typeName,
		fieldMap:      fieldMap,
		fieldEdgeMap:  fieldEdgeMap,
		pluralEdgeMap: pluralEdgeMap,
	}
}

func (s *graphQLSchemaInfo) addField(f *graphQLField) {
	s.fields = append(s.fields, f)
	s.fieldMap[f.FieldName] = f
}

func (s *graphQLSchemaInfo) addFieldEdge(e *graphqlFieldEdge) {
	s.fieldEdges = append(s.fieldEdges, e)
	spew.Dump(e.EdgeName)
	s.fieldEdgeMap[e.EdgeName] = e
}

func (s *graphQLSchemaInfo) addPluralEdge(e *graphqlPluralEdge) {
	s.pluralEdges = append(s.pluralEdges, e)
	s.pluralEdgeMap[e.GetEdgeName()] = e
}

func (s *graphQLSchemaInfo) getFieldByName(fieldName string) *graphQLField {
	return s.fieldMap[fieldName]
}

func (s *graphQLSchemaInfo) getFieldEdgeByName(edgeName string) *graphqlFieldEdge {
	return s.fieldEdgeMap[edgeName]
}

func (s *graphQLSchemaInfo) getPluralEdgeByName(edgeName string) *graphqlPluralEdge {
	return s.pluralEdgeMap[edgeName]
}

type graphQLYamlConfig struct {
	m map[interface{}]interface{}
}

func newGraphQLYamlConfig() *graphQLYamlConfig {
	m := make(map[interface{}]interface{})
	return &graphQLYamlConfig{
		m: m,
	}
}

func (c *graphQLYamlConfig) addEntry(key, value interface{}) {
	c.m[key] = value
}

func (c *graphQLYamlConfig) addSchema() {
	c.addEntry("schema", []string{"graphql/schema.graphql"})
}

func (c *graphQLYamlConfig) addModelsConfig(schema *graphQLSchema) {
	// this creates a nested models: User: path_to_model map in here
	models := make(map[string]interface{})
	for _, t := range schema.Types {
		if t.TypeName == "Query" {
			continue
		}
		model := make(map[string]string)

		model["model"] = fmt.Sprintf(
			// TODO get the correct path
			"github.com/lolopinto/jarvis/models.%s",
			t.TypeName,
		)
		models[t.TypeName] = model
	}

	c.addEntry("models", models)
}

func (c *graphQLYamlConfig) addExecConfig() {
	exec := make(map[string]string)
	exec["filename"] = "graphql/generated.go"
	exec["package"] = "graphql"

	c.addEntry("exec", exec)
}

func (c *graphQLYamlConfig) addModelConfig() {
	model := make(map[string]string)
	model["filename"] = "graphql/models_gen.go"
	model["package"] = "graphql"

	c.addEntry("model", model)
}

func (c *graphQLYamlConfig) addResolverConfig() {
	resolver := make(map[string]string)
	resolver["filename"] = "graphql/resolver.go"
	resolver["type"] = "Resolver"
	resolver["package"] = "graphql"

	c.addEntry("resolver", resolver)
}

// wrapper object to represent the list of schema types that will be passed to a schema template file
type graphqlSchemaTemplate struct {
	Types []*graphqlSchemaTypeInfo
}

// represents information needed by the schema template file to generate the schema for each type
type graphqlSchemaTypeInfo struct {
	Type        string
	TypeName    string
	SchemaLines []string // list of lines that will be generated for each graphql type e.g. "id: ID!", "user(id: ID!): User" etc
}
