package main

import (
	"fmt"
	"sort"
	"strconv"

	"github.com/99designs/gqlgen/api"

	"github.com/iancoleman/strcase"

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
	die(err)

	// We're handling the Resolver generation instead of using the stub graphqlgen produces.
	// We build on the default implementation they support and go from there.
	err = api.Generate(
		cfg,
		api.AddPlugin(newGraphQLResolverPlugin(schema.nodes)),
		api.AddPlugin(newGraphQLServerPlugin()),
	)
	die(err)
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

func (t *graphqlSchemaTemplate) getSortedTypes() []*graphQLSchemaInfo {
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

		// add id type manually for now
		// going to assume we don't want created at and updated at in graphql
		// TODO add these to fields with graphql: "_"
		// need to stop all this hardcoding going on
		// and then add things that indicate whether it should be exposed to graphql/db/etc
		schema.SchemaLines = append(
			schema.SchemaLines,
			fmt.Sprintf("%s: %s", "id", (&idType{}).GetGraphQLType()),
		)

		queries = append(
			queries,
			fmt.Sprintf("%s(id: ID!): %s", nodeData.NodeInstance, nodeData.Node),
		)

		for _, field := range nodeData.Fields {
			fieldName := field.TagMap["graphql"]
			if fieldName == "" {
				fieldName = strcase.ToLowerCamel(field.FieldName)
			} else {
				fieldName2, err := strconv.Unquote(fieldName)
				die(err)
				fieldName = fieldName2
			}
			// field that should not be exposed to graphql e.g. passwords etc
			if fieldName == "_" {
				continue
			}

			schema.SchemaLines = append(
				schema.SchemaLines,
				fmt.Sprintf("%s: %s", fieldName, getGraphQLTypeForField(field)),
			)
			// very simple, just get fields and create types. no nodes, edges, return ID fields etc
			// and then we go from there...
		}
		ret.addSchema(schema)
	}

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
