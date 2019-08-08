package main

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"text/template"

	"github.com/iancoleman/strcase"

	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/util"

	"github.com/99designs/gqlgen/api"
	"github.com/99designs/gqlgen/codegen/config"
)

// TODO break this into its own package
type graphqlPlugin struct {
}

func (p *graphqlPlugin) pluginName() string {
	return "graphql_plugin"
}

func (p *graphqlPlugin) processData(data *codegenData) error {
	// eventually make this configurable
	graphql := newGraphQLSchema(data)
	graphql.generateSchema()

	// right now it all panics but we have to change that lol
	return nil
}

var _ codegenPlugin = &graphqlPlugin{}

type graphQLSchema struct {
	config         *codegenData
	Types          map[string]*graphQLSchemaInfo
	sortedTypes    []*graphQLSchemaInfo
	queryFields    []*graphQLNonEntField
	mutationFields []*graphQLNonEntField
}

func newGraphQLSchema(data *codegenData) *graphQLSchema {
	types := make(map[string]*graphQLSchemaInfo)

	return &graphQLSchema{
		config: data,
		Types:  types,
		//		Mutations:
	}
}

func (schema *graphQLSchema) generateSchema() {
	schema.generateGraphQLSchemaData()

	//	schema.writeGraphQLSchema()

	//	schema.writeGQLGenYamlFile()

	schema.generateGraphQLCode()
}

func (schema *graphQLSchema) addQueryField(f *graphQLNonEntField) {
	schema.queryFields = append(schema.queryFields, f)
}

func (schema *graphQLSchema) addMutationField(f *graphQLNonEntField) {
	schema.mutationFields = append(schema.mutationFields, f)
}

func (schema *graphQLSchema) addSchemaInfo(info *graphQLSchemaInfo) {
	schema.Types[info.TypeName] = info
	schema.sortedTypes = append(schema.sortedTypes, info)
}

func (schema *graphQLSchema) addGraphQLInfoForType(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) {
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
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		schemaInfo.addPluralEdge(&graphqlPluralEdge{PluralEdge: edge})
	}

	for _, edge := range nodeData.EdgeInfo.ForeignKeys {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		schemaInfo.addPluralEdge(&graphqlPluralEdge{PluralEdge: edge})
	}

	for _, edgeGroup := range nodeData.EdgeInfo.AssocGroups {
		schemaInfo.addNonEntField(&graphQLNonEntField{
			fieldName: edgeGroup.GetStatusFieldName(),
			fieldType: edgeGroup.ConstType,
		})
	}

	// very simple, just get fields and create types. no nodes, edges, return ID fields etc
	// and then we go from there...

	for _, f := range nodeData.FieldInfo.Fields {
		if !f.ExposeToGraphQL() {
			continue
		}
		schemaInfo.addField(&graphQLField{Field: f})
	}

	// add any enums
	for _, cg := range nodeData.ConstantGroups {
		if !cg.CreateNewType() {
			continue
		}

		schema.addSchemaInfo(schema.processConstantForEnum(cg))
	}

	// top level quries that will show up e.g. user(id: ), account(id: ) etc
	// add everything as top level query for now
	schema.addQueryField(&graphQLNonEntField{
		fieldName: nodeData.NodeInstance,
		fieldType: nodeData.Node,
		args: []*graphQLArg{
			&graphQLArg{
				fieldName: "id",
				fieldType: "ID!",
			},
		},
	})

	// add the type as a top level GraphQL object
	schema.addSchemaInfo(schemaInfo)
}

func (s *graphQLSchema) generateGraphQLSchemaData() {
	nodeMap := s.config.schema.Nodes
	for _, info := range nodeMap {
		nodeData := info.NodeData

		if nodeData.HideFromGraphQL {
			continue
		}

		// add the GraphQL type e.g. User, Contact etc
		s.addGraphQLInfoForType(nodeMap, nodeData)

		s.processActions(nodeData.ActionInfo)
	}

	s.addSchemaInfo(s.getQuerySchemaType())
	mutationsType := s.getMutationSchemaType()
	if mutationsType != nil {
		s.addSchemaInfo(mutationsType)
	}
}

func (s *graphQLSchema) processActions(actionInfo *action.ActionInfo) {
	if actionInfo == nil {
		return
	}
	for _, action := range actionInfo.Actions {
		if !action.ExposedToGraphQL() {
			continue
		}
		//		spew.Dump(action)

		s.processAction(action)
	}
}

func (s *graphQLSchema) processAction(action action.Action) {
	actionName := action.GetGraphQLName()

	// TODO support shared input types
	inputTypeName := strcase.ToCamel(actionName + "Input")
	inputSchemaInfo := newGraphQLSchemaInfo("input", inputTypeName)

	// add id field for editXXX and deleteXXX mutations
	if action.MutatingExistingObject() {
		inputSchemaInfo.addNonEntField(
			&graphQLNonEntField{
				fieldName: fmt.Sprintf("%sId", action.GetNodeInfo().NodeInstance),
				fieldType: "ID!",
			},
		)
	}
	// get all the fields in the action and add it to the input
	// userCreate mutation -> UserCreateInput
	for _, f := range action.GetFields() {
		inputSchemaInfo.addField(&graphQLField{Field: f})
	}

	// add each edge that's part of this mutation as an id
	for _, edge := range action.GetEdges() {
		inputSchemaInfo.addNonEntField(&graphQLNonEntField{
			fieldName: fmt.Sprintf("%sId", edge.NodeInfo.NodeInstance),
			fieldType: "ID!",
		})
	}

	for _, f := range action.GetNonEntFields() {
		inputSchemaInfo.addNonEntField(&graphQLNonEntField{
			fieldName: f.GetGraphQLName(),
			fieldType: f.FieldType.GetGraphQLType(),
		})
	}

	// TODO add field if it makes sense... e.g. EditXXX and deleteXXX mutations
	s.addSchemaInfo(inputSchemaInfo)

	responseTypeName := strcase.ToCamel(actionName + "Response")
	responseTypeSchemaInfo := newGraphQLSchemaInfo("type", responseTypeName)

	nodeInfo := action.GetNodeInfo()

	// TODO add viewer to response once we introduce that type

	// TODO generic action Returns Object? method
	if action.GetOperation() != ent.DeleteAction {
		responseTypeSchemaInfo.addNonEntField(
			&graphQLNonEntField{
				fieldName: nodeInfo.NodeInstance,
				fieldType: nodeInfo.Node,
			},
		)
	} else { // TODO delete mutation?
		// delete
		responseTypeSchemaInfo.addNonEntField(
			&graphQLNonEntField{
				// add a deletedPlaceId, deletedContactId node to response
				fieldName: fmt.Sprintf("deleted%sId", nodeInfo.Node),
				fieldType: "ID",
			})
	}

	s.addSchemaInfo(responseTypeSchemaInfo)

	// add mutation as a top level mutation field
	s.addMutationField(&graphQLNonEntField{
		fieldName: actionName,
		fieldType: responseTypeName, // TODO should this be required?
		args: []*graphQLArg{
			&graphQLArg{
				fieldName: "input",
				fieldType: fmt.Sprintf("%s!", inputTypeName),
			},
		},
	})
}

func (s *graphQLSchema) processConstantForEnum(cg *schema.ConstGroupInfo) *graphQLSchemaInfo {
	enumSchemaInfo := newGraphQLSchemaInfo("enum", cg.ConstType)

	for _, constant := range cg.Constants {
		unquoted, err := strconv.Unquote(constant.ConstValue)

		util.Die(err)
		// TODO deal with this
		enumSchemaInfo.addNonEntField(&graphQLNonEntField{
			fieldName: strcase.ToScreamingSnake(unquoted),
		})
	}
	return enumSchemaInfo
}

func (s *graphQLSchema) getQuerySchemaType() *graphQLSchemaInfo {
	// add everything as top level query for now

	return &graphQLSchemaInfo{
		Type:         "type",
		TypeName:     "Query",
		nonEntFields: s.queryFields,
	}
}

func (s *graphQLSchema) getMutationSchemaType() *graphQLSchemaInfo {
	if len(s.mutationFields) == 0 {
		return nil
	}
	return &graphQLSchemaInfo{
		Type:         "type",
		TypeName:     "Mutation",
		nonEntFields: s.mutationFields,
	}
}

func getSortedTypes(t *graphqlSchemaTemplate) []*graphqlSchemaTypeInfo {
	// sort graphql types by type name so that we are not always changing the order of the generated schema
	sort.Slice(t.Types, func(i, j int) bool {
		return t.Types[i].TypeName < t.Types[j].TypeName
	})
	return t.Types
}

func (s *graphQLSchema) writeGraphQLSchema() {
	writeFile(
		&templatedBasedFileWriter{
			data:              s.getSchemaForTemplate(),
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

func (s *graphQLSchema) writeGQLGenYamlFile() {
	// TODO use 	"github.com/99designs/gqlgen/codegen/config
	c := newGraphQLYamlConfig()

	c.addSchema()
	c.addModelsConfig(s)
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

func (s *graphQLSchema) generateGraphQLCode() {
	cfg, err := config.LoadConfig("graphql/gqlgen.yml")
	// TODO
	util.Die(err)

	// We're handling the Resolver generation instead of using the stub graphqlgen produces.
	// We build on the default implementation they support and go from there.
	err = api.Generate(
		cfg,
		api.AddPlugin(newGraphQLResolverPlugin(s.config)),
		api.AddPlugin(newGraphQLServerPlugin(s.config)),
	)
	util.Die(err)
}

// get the schema that will be passed to the template for rendering in a schema file
func (s *graphQLSchema) getSchemaForTemplate() *graphqlSchemaTemplate {
	ret := &graphqlSchemaTemplate{}

	for _, typ := range s.Types {

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

	// TODO go through and figure out what scalars are needed and build them
	// up instead of this manual addition
	ret.Scalars = []string{"Time"}
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

	// enum declarations just have a name so doing that
	if f.fieldType == "" {
		return f.fieldName
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
	fieldName := f.GetGraphQLName()

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

func (s *graphQLSchemaInfo) addNonEntField(f *graphQLNonEntField) {
	s.nonEntFields = append(s.nonEntFields, f)
}

func (s *graphQLSchemaInfo) addFieldEdge(e *graphqlFieldEdge) {
	s.fieldEdges = append(s.fieldEdges, e)
	//	spew.Dump(e.EdgeName)
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

func (c *graphQLYamlConfig) addModelsConfig(s *graphQLSchema) {
	// this creates a nested models: User: path_to_model map in here
	models := make(map[string]interface{})

	pathToModels, err := strconv.Unquote(s.config.codePath.PathToModels)
	util.Die(err)
	for _, info := range s.config.schema.Nodes {
		nodeData := info.NodeData

		if nodeData.HideFromGraphQL {
			continue
		}

		model := make(map[string]string)

		model["model"] = fmt.Sprintf(
			// e.g. github.com/lolopinto/jarvis/models.User
			"%s.%s",
			pathToModels,
			nodeData.Node,
		)
		models[nodeData.Node] = model
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
	Types   []*graphqlSchemaTypeInfo
	Scalars []string
}

// represents information needed by the schema template file to generate the schema for each type
type graphqlSchemaTypeInfo struct {
	Type        string
	TypeName    string
	SchemaLines []string // list of lines that will be generated for each graphql type e.g. "id: ID!", "user(id: ID!): User" etc
}
