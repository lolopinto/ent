package main

import (
	"fmt"
	"sort"
	"text/template"

	"github.com/99designs/gqlgen/api"
	"github.com/lolopinto/ent/internal/util"

	"github.com/99designs/gqlgen/codegen/config"
)

type graphQLSchema struct {
	nodes codegenMapInfo
}

func newGraphQLSchema(nodes codegenMapInfo) *graphQLSchema {
	return &graphQLSchema{
		nodes: nodes,
	}
}

func (schema *graphQLSchema) generateSchema() {
	data := schema.buildGraphQLSchemaData()

	schema.writeGraphQLSchema(data)

	schema.writeGQLGenYamlFile(data)

	schema.generateGraphQLCode()
}

func (schema *graphQLSchema) writeGraphQLSchema(data *graphqlSchemaTemplate) {
	writeFile(
		&templatedBasedFileWriter{
			data:              data,
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

func (schema *graphQLSchema) writeGQLGenYamlFile(data *graphqlSchemaTemplate) {
	// TODO use 	"github.com/99designs/gqlgen/codegen/config
	c := newGraphQLYamlConfig()

	c.addSchema()
	c.addModelsConfig(data)
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

type graphQLSchemaInfo struct {
	Type        string
	TypeName    string
	SchemaLines []string
}

type graphqlSchemaTemplate struct {
	Types       map[string]*graphQLSchemaInfo
	sortedTypes []*graphQLSchemaInfo
}

func initGraphqlSchemaTemplate() *graphqlSchemaTemplate {
	ret := &graphqlSchemaTemplate{}
	ret.Types = make(map[string]*graphQLSchemaInfo)
	return ret
}

func (t *graphqlSchemaTemplate) addSchema(s *graphQLSchemaInfo) {
	t.Types[s.TypeName] = s
	t.sortedTypes = append(t.sortedTypes, s)
}

func getSortedTypes(t *graphqlSchemaTemplate) []*graphQLSchemaInfo {
	// sort graphql types by type name so that we are not always changing the order of the generated schema
	sort.Slice(t.sortedTypes, func(i, j int) bool {
		return t.sortedTypes[i].TypeName < t.sortedTypes[j].TypeName
	})

	return t.sortedTypes
}

func (schema *graphQLSchema) buildGraphQLSchemaData() *graphqlSchemaTemplate {
	ret := initGraphqlSchemaTemplate()

	var queries []string
	for _, info := range schema.nodes {
		nodeData := info.nodeData

		schema := &graphQLSchemaInfo{
			Type:     "type",
			TypeName: nodeData.Node, // Contact, User etc...
		}

		queries = append(
			queries,
			fmt.Sprintf("%s(id: ID!): %s", nodeData.NodeInstance, nodeData.Node),
		)

		for _, f := range nodeData.FieldInfo.Fields {
			expose, fieldName := f.ExposeToGraphQL()
			if !expose {
				continue
			}

			schema.SchemaLines = append(
				schema.SchemaLines,
				fmt.Sprintf("%s: %s", fieldName, f.GetGraphQLTypeForField()),
			)
			// very simple, just get fields and create types. no nodes, edges, return ID fields etc
			// and then we go from there...
		}
		ret.addSchema(schema)
	}

	sort.Slice(queries, func(i, j int) bool {
		return queries[i] < queries[j]
	})
	// add everything as top level query for now
	ret.addSchema(getQuerySchemaType(&queries))

	return ret
}

func getQuerySchemaType(queries *[]string) *graphQLSchemaInfo {
	return &graphQLSchemaInfo{
		Type:        "type",
		TypeName:    "Query",
		SchemaLines: *queries,
	}
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

func (c *graphQLYamlConfig) addModelsConfig(data *graphqlSchemaTemplate) {
	// this creates a nested models: User: path_to_model map in here
	models := make(map[string]interface{})
	for _, t := range data.Types {
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
