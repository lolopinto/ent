package graphql

import (
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"text/template"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"

	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"

	"github.com/lolopinto/ent/internal/util"

	"github.com/99designs/gqlgen/api"
	"github.com/99designs/gqlgen/codegen/config"
)

type Step struct {
}

func (p *Step) Name() string {
	return "graphql"
}

type gqlStep string

// steps that need to be run in order to generate graphql schema
// dependencies are handed by storing values in graphQLSchema
// each step should assume it can run independently of the other (for test purposes)
var sortedGQLlSteps = []gqlStep{
	"schema",
	"custom_functions",
	"schema.graphql",
	"yml_file",
	"generate_code",
}

func (p *Step) ProcessData(processor *codegen.Processor) error {
	graphql := newGraphQLSchema(processor)
	graphql.generateSchema()

	// right now it all panics but we have to change that lol
	return nil
}

var _ codegen.Step = &Step{}

var defaultGraphQLFolder = "graphql"

type graphQLSchema struct {
	config                *codegen.Processor
	Types                 map[string]*graphQLSchemaInfo
	sortedTypes           []*graphQLSchemaInfo
	pathsToGraphQLObjects map[string]string
	queryCustomImpls      map[string]*customFunction
	mutationCustomImpls   map[string]*customFunction

	customEntResult schemaparser.ParseCustomGQLResult
	topLevelResult  schemaparser.ParseCustomGQLResult
	gqlConfig       *config.Config

	customEntParser     schemaparser.Parser
	customEntCodeParser schemaparser.CustomCodeParser

	topLevelParser     schemaparser.Parser
	topLevelCodeParser schemaparser.CustomCodeParser

	graphqlFolder   string
	disableServerGO bool
}

func newGraphQLSchema(processor *codegen.Processor) *graphQLSchema {
	types := make(map[string]*graphQLSchemaInfo)
	// TODO this is initially going to be just the ents but will eventually be used for
	// config.TypeMapEntry in buildYmlConfig as it gets more complicated and we add other objects
	pathsToGraphQLObjects := make(map[string]string)
	queryCustomImpls := make(map[string]*customFunction)
	mutationCustomImpls := make(map[string]*customFunction)

	schema := &graphQLSchema{
		config:                processor,
		Types:                 types,
		pathsToGraphQLObjects: pathsToGraphQLObjects,
		mutationCustomImpls:   mutationCustomImpls,
		queryCustomImpls:      queryCustomImpls,

		// parsing custom ent code
		customEntParser: &schemaparser.ConfigSchemaParser{
			AbsRootPath: processor.Config.GetAbsPathToModels(),
		},

		// parsing top level functions
		topLevelParser: &schemaparser.ConfigSchemaParser{
			AbsRootPath: processor.Config.GetAbsPathToGraphQL() + "...",
			// for default generated files, don't parse them and treat them as basically empty files
			// errors in there shouldn't affect this process since if everything succeeds now, we are fine
			FilesToIgnore: defaultGraphQLFiles,
		},
		topLevelCodeParser: &customTopLevelParser{},
	}

	schema.customEntCodeParser = newCustomEntParser(schema)
	return schema
}

func (schema *graphQLSchema) getPath(filename string) string {
	if schema.graphqlFolder == "" {
		schema.graphqlFolder = defaultGraphQLFolder
	}
	return filepath.Join(schema.graphqlFolder, filename)
}

func (schema *graphQLSchema) getFuncMap(steps []gqlStep) ([]func() error, error) {
	m := map[gqlStep]func() error{
		"schema": func() error {
			schema.generateGraphQLSchemaData()
			return nil
		},
		"custom_functions": schema.parseCustomFunctions,
		"schema.graphql":   schema.writeGraphQLSchema,
		"yml_file": func() error {
			return schema.writeGQLGenYamlFile(schema.config.Config)
		},
		"generate_code": schema.generateGraphQLCode,
	}

	fns := make([]func() error, len(steps))

	for idx, step := range steps {
		fn, ok := m[step]
		if !ok {
			return nil, errors.New("invalid step passed")
		}
		fns[idx] = fn
	}
	return fns, nil
}

func (schema *graphQLSchema) overrideCustomEntSchemaParser(
	parser schemaparser.Parser,
	codeParser schemaparser.CustomCodeParser,
) {
	schema.customEntParser = parser
	schema.customEntCodeParser = codeParser
}

func (schema *graphQLSchema) overrideTopLevelEntSchemaParser(
	parser schemaparser.Parser,
	codeParser schemaparser.CustomCodeParser,
) {
	schema.topLevelParser = parser
	schema.topLevelCodeParser = codeParser
}

func (schema *graphQLSchema) parseCustomFunctions() error {
	// custom ent parser
	customEntChan := schemaparser.ParseCustomGraphQLDefinitions(
		schema.customEntParser,
		schema.customEntCodeParser,
	)
	// top level parser
	topLevelChan := schemaparser.ParseCustomGraphQLDefinitions(
		schema.topLevelParser,
		schema.topLevelCodeParser,
	)
	schema.customEntResult, schema.topLevelResult = <-customEntChan, <-topLevelChan

	err := util.CoalesceErr(schema.customEntResult.Error, schema.topLevelResult.Error)
	if err != nil {
		return err
	}
	err = schema.handleCustomEntDefinitions(schema.customEntResult)
	if err != nil {
		return err
	}
	return schema.handleCustomTopLevelDefinitions(schema.topLevelResult)
}

func (schema *graphQLSchema) generateSchema() {
	schema.runSpecificSteps(sortedGQLlSteps)
}

func (schema *graphQLSchema) runSpecificSteps(steps []gqlStep) {
	fns, err := schema.getFuncMap(steps)

	// TOOD make sure they are run in the correct order
	if err != nil {
		util.GoSchemaKill(err)
	}
	for _, fn := range fns {
		if err := fn(); err != nil {
			util.GoSchemaKill(err)
		}
	}
}

func (schema *graphQLSchema) handleCustomFunctions(
	funcMap schemaparser.FunctionMap,
) error {
	for key, functions := range funcMap {
		schemaInfo, ok := schema.Types[key]
		if !ok {
			return fmt.Errorf("invalid schema info %s retrieved", key)
		}

		for _, fn := range functions {
			customFn := &customFunction{Function: fn}

			field := &graphQLNonEntField{
				fieldName: fn.GraphQLName,
				fieldType: schema.getSchemaType(fn, key, customFn),
			}

			schema.processArgsOfFunction(fn, field, customFn)
			schemaInfo.addNonEntField(field)

			if key == "Query" {
				schema.queryCustomImpls[fn.GraphQLName] = customFn
			} else if key == "Mutation" {
				schema.mutationCustomImpls[fn.GraphQLName] = customFn
			}
		}
	}
	return nil
}

func (schema *graphQLSchema) handleCustomEntDefinitions(
	customResult schemaparser.ParseCustomGQLResult,
) error {

	return schema.handleCustomFunctions(
		customResult.Functions,
	)
}

func (schema *graphQLSchema) handleCustomTopLevelDefinitions(
	topLevelResult schemaparser.ParseCustomGQLResult,
) error {

	// get all the new parsed types and add it to the schema
	for _, obj := range topLevelResult.Objects {
		schema.addPathToObj(obj.PackagePath, obj.GraphQLName)

		schemaInfo := newGraphQLSchemaInfo("type", obj.GraphQLName)

		for _, f := range obj.Fields {
			schemaInfo.addNonEntField(&graphQLNonEntField{
				fieldName: f.Name,
				fieldType: f.Type.GetGraphQLType(),
			})
		}

		schema.addSchemaInfo(schemaInfo)
	}

	return schema.handleCustomFunctions(
		topLevelResult.Functions,
	)
}

func (schema *graphQLSchema) getSchemaType(
	fn *schemaparser.Function,
	key string,
	customFn *customFunction,
) string {

	results := fn.Results
	if key != "Mutation" {
		// returns 1 item which isn't an error, return that type
		// mutations should always be in Response objects so don't do for those
		if len(results) == 1 && !enttype.IsErrorType(results[0].Type) {
			return results[0].Type.GetGraphQLType()
		}
		// if 2 items and 2nd is error, return just the first item as expected type
		// no need for result type
		if len(results) == 2 && enttype.IsErrorType(results[1].Type) {
			// only returns directly if  results[0] is pointer/null type
			// if not pointer type, we still don't have complex type and should return the
			// object directly but need to differentiate these 2

			if enttype.IsNullType(results[0].Type) {
				customFn.ReturnsDirectly = true
			} else {
				customFn.ReturnsError = true
			}
			return results[0].Type.GetGraphQLType()
		}
	}
	customFn.ReturnsComplexType = true

	var typeName string
	if key == "Query" {
		typeName = fn.GraphQLName + "Result"
	} else if key == "Mutation" {
		typeName = fn.GraphQLName + "Response"
	}
	newSchemaInfo := newGraphQLSchemaInfo("type", strcase.ToCamel(typeName))

	for idx, result := range results {
		// if the last item is an error type don't add to graphql
		if idx == len(fn.Results)-1 && enttype.IsErrorType(result.Type) {
			customFn.ReturnsError = true
			continue
		}

		// add each item as a result type...
		newSchemaInfo.addNonEntField(&graphQLNonEntField{
			fieldName: result.Name,
			fieldType: result.Type.GetGraphQLType(),
		})
	}

	if len(newSchemaInfo.nonEntFields) == 0 {
		// we want something here for extensibility since graphql doesn't have void types
		// so if we decide to add something in the future it works...
		// but if we have success: true or something, how do we know about it in the future?
		// hmm...
		// but how do we even send the success: true flag?
		// if it doesn't throw an error or something

		newSchemaInfo.addNonEntField(&graphQLNonEntField{
			fieldName: "success",
			fieldType: (&enttype.NullableBoolType{}).GetGraphQLType(),
		})
	}
	schema.addSchemaInfo(newSchemaInfo)

	return newSchemaInfo.TypeName
}

func (schema *graphQLSchema) processArgsOfFunction(
	fn *schemaparser.Function,
	field *graphQLNonEntField,
	customFn *customFunction,
) {
	if len(fn.Args) == 0 {
		return
	}
	// if only a context arg, nothing to do here
	if len(fn.Args) == 1 && enttype.IsContextType(fn.Args[0].Type) {
		return
	}
	var args []*graphQLArg
	for idx, arg := range fn.Args {
		// don't add context type here.
		if idx == 0 && enttype.IsContextType(arg.Type) {
			customFn.SupportsContext = true
			continue
		}
		fieldName := arg.Name
		fieldType := arg.Type.GetGraphQLType()

		// ent is an input field so handle it
		input, slice, simplifiedFieldType := schema.isIDInputField(arg.Type)
		if input {
			if slice {
				// there's a singular version use it
				singular := inflection.Singular(fieldName)
				if singular != fieldName {
					fieldName = singular + "IDs"
				} else {
					fieldName = fieldName + "IDs"
				}
				fieldType = "[ID!]!"
			} else {
				// TODO input objects mutation?
				// assume for now that it's always a required ID
				fieldName = fieldName + "ID"
				fieldType = "ID!"
			}
			customFn.FlagIDField(arg, simplifiedFieldType, fieldName, slice)
		}

		args = append(args, &graphQLArg{
			fieldName: fieldName,
			fieldType: fieldType,
		})
	}
	// by default mutation objects should be input types
	// we're are creating an input type to be consistent
	if fn.NodeName == "Mutation" && !fn.CommentGroup.DisableGraphQLInputType() {
		customFn.FlagInputObject()
		inputTypeName := strcase.ToCamel(fn.GraphQLName + "Input")
		inputSchemaInfo := newGraphQLSchemaInfo("input", inputTypeName)

		for _, arg := range args {
			inputSchemaInfo.addNonEntField(&graphQLNonEntField{
				fieldName: arg.fieldName,
				fieldType: arg.fieldType,
			})
		}
		schema.addSchemaInfo(inputSchemaInfo)
		field.args = append(field.args, &graphQLArg{
			fieldName: "input",
			fieldType: fmt.Sprintf("%s!", inputTypeName),
		})
	} else {
		field.args = args
	}
}

func (schema *graphQLSchema) isIDInputField(typ enttype.Type) (bool, bool, string) {
	var slice bool
	fieldType := typ.GetGraphQLType()
	listType, ok := typ.(enttype.ListType)
	if ok {
		fieldType = strings.TrimSuffix(listType.GetElemGraphQLType(), "!")
		slice = true
	}

	nodeData := schema.config.Schema.GetNodeDataFromGraphQLName(fieldType)
	return nodeData != nil, slice, fieldType
}

func (schema *graphQLSchema) addQueryField(f *graphQLNonEntField) {
	schema.Types["Query"].addNonEntField(f)
}

func (schema *graphQLSchema) addMutationField(f *graphQLNonEntField) {
	schema.Types["Mutation"].addNonEntField(f)
}

func (schema *graphQLSchema) addSchemaInfo(info *graphQLSchemaInfo) {
	schema.Types[info.TypeName] = info
	schema.sortedTypes = append(schema.sortedTypes, info)
}

func (s *graphQLSchema) addGraphQLInfoForType(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) {
	// Contact, User etc...
	schemaInfo := newGraphQLSchemaInfo("type", nodeData.Node)
	// all top level nodes implement the Node interface
	schemaInfo.interfaces = []string{"Node"}

	fieldInfo := nodeData.FieldInfo
	// for any edge fields that reference an existing ID field, invalidate the id field so that it's not exposed to GraphQL
	// TODO allow client to override this :(
	// TODO probably cleaner to be passed into field generation so that each part is siloed so an orchestrator handles this
	if nodeData.EdgeInfo != nil {
		for _, edge := range nodeData.EdgeInfo.FieldEdges {
			f := fieldInfo.GetFieldByName(edge.FieldName)
			// TODO this shouldn't be here but be somewhere else...
			if f != nil {
				if err := fieldInfo.InvalidateFieldForGraphQL(f); err != nil {
					util.GoSchemaKill(err)
				}
			}
			schemaInfo.addFieldEdge(&graphqlFieldEdge{edge})
		}

		for _, edge := range nodeData.EdgeInfo.Associations {
			if nodeMap.HideFromGraphQL(edge) {
				continue
			}
			if edge.Unique {
				schemaInfo.addFieldEdge(&graphqlFieldEdge{edge})
			} else {
				schemaInfo.addPluralEdge(&graphqlPluralEdge{PluralEdge: edge})
				s.addEdgeAndConnection(edge)
			}
		}

		for _, e := range nodeData.EdgeInfo.DestinationEdges {
			if nodeMap.HideFromGraphQL(e) {
				continue
			}
			plural, ok := e.(edge.PluralEdge)
			if !ok {
				spew.Dump("warn: non-plural edge returned", e.GetEdgeName())
			}
			schemaInfo.addPluralEdge(&graphqlPluralEdge{PluralEdge: plural})
		}

		for _, edgeGroup := range nodeData.EdgeInfo.AssocGroups {
			schemaInfo.addNonEntField(&graphQLNonEntField{
				fieldName: edgeGroup.GetStatusFieldName(),
				fieldType: edgeGroup.ConstType,
			})
		}
	}

	// very simple, just get fields and create types. no nodes, edges, return ID fields etc
	// and then we go from there...
	if fieldInfo != nil {
		for _, f := range fieldInfo.Fields {
			if !f.ExposeToGraphQL() {
				continue
			}
			schemaInfo.addField(&graphQLField{Field: f})
		}

		for _, f := range fieldInfo.NonEntFields {
			schemaInfo.addNonEntField(
				&graphQLNonEntField{
					fieldName: f.GetGraphQLName(),
					fieldType: f.FieldType.GetGraphQLType(),
				},
			)
		}
	}

	// add any enums
	for _, cg := range nodeData.ConstantGroups {
		if !cg.CreateNewType() {
			continue
		}

		s.addSchemaInfo(s.processConstantForEnum(cg))
	}

	// top level quries that will show up e.g. user(id: ), account(id: ) etc
	// add everything as top level query for now
	s.addQueryField(&graphQLNonEntField{
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
	s.addSchemaInfo(schemaInfo)
}

func (s *graphQLSchema) addPathToObj(packagePath, nodeName string) {
	// add path so we can use it to map from path to GraphQLtype
	// e.g. github.com/lolopinto/jarvis/models.User
	s.pathsToGraphQLObjects[fmt.Sprintf("%s.%s", packagePath, nodeName)] = nodeName
}

func (s *graphQLSchema) generateGraphQLSchemaData() {
	schema := s.config.Schema

	if len(schema.Nodes) > 0 {
		s.addSchemaInfo(s.getNodeInterfaceType())
	}

	// potentially add Query and Mutation type
	s.addSchemaInfo(s.getQuerySchemaType())
	s.addSchemaInfo(s.getMutationSchemaType())

	if len(schema.GetEdges()) > 0 {
		s.addSchemaInfo(s.getEdgeInterfaceType())
		s.addSchemaInfo(s.getConnectionInterfaceType())
	}

	pathToModels := s.config.Config.GetImportPathToModels()

	nodeMap := schema.Nodes
	for _, info := range nodeMap {
		nodeData := info.NodeData

		if nodeData.HideFromGraphQL {
			continue
		}

		// add graphql path
		s.addPathToObj(pathToModels, nodeData.Node)

		// add the GraphQL type e.g. User, Contact etc
		s.addGraphQLInfoForType(nodeMap, nodeData)

		s.processActions(nodeData.ActionInfo)
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
				fieldName: fmt.Sprintf("%sID", action.GetNodeInfo().NodeInstance),
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
			// use singular version so that this is friendID instead of friendsID
			fieldName: fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
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

		if err != nil {
			util.GoSchemaKill(err)
		}
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
		Type:     "type",
		TypeName: "Query",
	}
}

func (s *graphQLSchema) getMutationSchemaType() *graphQLSchemaInfo {
	return &graphQLSchemaInfo{
		Type:     "type",
		TypeName: "Mutation",
	}
}

func (s *graphQLSchema) getNodeInterfaceType() *graphQLSchemaInfo {
	return &graphQLSchemaInfo{
		Type:     "interface",
		TypeName: "Node",
		nonEntFields: []*graphQLNonEntField{
			&graphQLNonEntField{
				fieldName: "id",
				fieldType: "ID!",
			},
		},
	}
}

func (s *graphQLSchema) getEdgeInterfaceType() *graphQLSchemaInfo {
	return &graphQLSchemaInfo{
		Type:     "interface",
		TypeName: "Edge",
		nonEntFields: []*graphQLNonEntField{
			// &graphQLNonEntField{
			// 	fieldName: "cursor",
			// 	fieldType: "ID",
			// },
			&graphQLNonEntField{
				fieldName: "node",
				fieldType: "Node!",
			},
		},
	}
}

func (s *graphQLSchema) getConnectionInterfaceType() *graphQLSchemaInfo {
	return &graphQLSchemaInfo{
		Type:     "interface",
		TypeName: "Connection",
		nonEntFields: []*graphQLNonEntField{
			&graphQLNonEntField{
				fieldName: "edges",
				fieldType: "[Edge!]",
			},
			&graphQLNonEntField{
				fieldName: "nodes",
				fieldType: "[Node!]",
			},
		},
	}
}

func (s *graphQLSchema) addEdgeAndConnection(assocEdge *edge.AssociationEdge) {
	gqlEdge := &graphQLSchemaInfo{
		Type:     "type",
		TypeName: assocEdge.NodeInfo.Nodes + "Edge",
		nonEntFields: []*graphQLNonEntField{
			&graphQLNonEntField{
				fieldName: "node",
				fieldType: fmt.Sprintf("%s!", assocEdge.NodeInfo.Node),
			},
		},
		interfaces: []string{
			"Edge",
		},
	}

	gqlConnection := &graphQLSchemaInfo{
		Type:     "type",
		TypeName: assocEdge.NodeInfo.Nodes + "Connection",
		nonEntFields: []*graphQLNonEntField{
			&graphQLNonEntField{
				fieldName: "edges",
				fieldType: fmt.Sprintf("[%sEdge!]", assocEdge.NodeInfo.Nodes),
			},
			&graphQLNonEntField{
				fieldName: "nodes",
				fieldType: fmt.Sprintf("[%s!]", assocEdge.NodeInfo.Node),
			},
		},
		interfaces: []string{
			"Connection",
		},
	}

	s.addSchemaInfo(gqlEdge)
	s.addSchemaInfo(gqlConnection)
}

func getSortedTypes(t *graphqlSchemaTemplate) []*graphqlSchemaTypeInfo {
	// sort graphql types by type name so that we are not always changing the order of the generated schema
	sort.Slice(t.Types, func(i, j int) bool {
		return t.Types[i].TypeName < t.Types[j].TypeName
	})
	return t.Types
}

func (schema *graphQLSchema) writeGraphQLSchema() error {
	// TODO
	return file.Write(&file.TemplatedBasedFileWriter{
		Data:              schema.getSchemaForTemplate(),
		AbsPathToTemplate: util.GetAbsolutePath("graphql_schema.tmpl"),
		TemplateName:      "graphql_schema.tmpl",
		PathToFile:        schema.getPath("schema.graphql"),
		CreateDirIfNeeded: true,
		FuncMap: template.FuncMap{
			"sortedTypes": getSortedTypes,
		},
	})
}

func (s *graphQLSchema) buildYmlConfig(
	customResult schemaparser.ParseCustomGQLResult,
	topLevelResult schemaparser.ParseCustomGQLResult,
) *config.Config {
	// init with DefaultConfig then override as needed
	// This inits a default value for Directives for example
	cfg := config.DefaultConfig()
	cfg.SchemaFilename = []string{
		s.getPath("schema.graphql"),
	}
	cfg.Exec = config.PackageConfig{
		Filename: s.getPath("generated.go"),
		Package:  "graphql",
	}
	cfg.Model = config.PackageConfig{
		Filename: s.getPath("models_gen.go"),
		Package:  "graphql",
	}
	// don't need this since we're handling this ourselves
	// cfg. Resolver = config.PackageConfig{
	// 	Filename: s.getPath("resolver.go"),
	// 	Package:  "graphql",
	// 	Type:     "Resolver",
	// }

	models := make(config.TypeMap)

	customFns := customResult.Functions
	topLevelFns := topLevelResult.Functions

	for path, nodeName := range s.pathsToGraphQLObjects {
		entry := config.TypeMapEntry{
			Model: []string{path},
		}

		functions, ok := customFns[nodeName]
		if !ok {
			functions, ok = topLevelFns[nodeName]
		}

		if ok {
			//			spew.Dump(functions)
			entry.Fields = make(map[string]config.TypeMapField)
			for _, fn := range functions {
				// should only need this if GraphQLName != FunctionName
				if strings.ToLower(fn.GraphQLName) == strings.ToLower(fn.FunctionName) {
					continue
				}
				entry.Fields[fn.GraphQLName] = config.TypeMapField{
					FieldName: fn.FunctionName,
				}
			}
		}
		models[nodeName] = entry
	}

	// add Node to TypeMapEntry
	// Have historically dependend on an autogenerated interface being added here
	// but models_gen.go is not generated if we don't have any new Nodes or Enums and then this fails
	// see https://github.com/99designs/gqlgen/blob/master/plugin/modelgen/models.go#L241
	// This is needed to make TestFunctionThatReturnsObjDirectly work
	if s.Types["Node"] != nil {
		entry := config.TypeMapEntry{
			Model: []string{"github.com/lolopinto/ent/ent.Entity"},
		}
		models["Node"] = entry
	}

	cfg.Models = models
	return cfg
}

func (s *graphQLSchema) getYmlConfig() *config.Config {
	if s.gqlConfig == nil {
		s.gqlConfig = s.buildYmlConfig(s.customEntResult, s.topLevelResult)
	}
	return s.gqlConfig
}

func (s *graphQLSchema) writeGQLGenYamlFile(cfg *codegen.Config) error {
	return file.Write(&file.YamlFileWriter{
		Config:            cfg,
		Data:              s.getYmlConfig(),
		PathToFile:        s.getPath("gqlgen.yml"),
		CreateDirIfNeeded: true,
	})
}

func (s *graphQLSchema) disableServerPlugin() {
	s.disableServerGO = true
}

func (s *graphQLSchema) overrideGraphQLFolder(folder string) {
	s.graphqlFolder = folder
}

func (s *graphQLSchema) generateGraphQLCode() error {
	// We're handling the Resolver generation instead of using the stub graphqlgen produces.
	// We build on the default implementation they support and go from there.
	options := []api.Option{
		api.AddPlugin(newGraphQLResolverPlugin(s, s.getPath("resolver.go"))),
	}
	if !s.disableServerGO {
		options = append(options, api.AddPlugin(newGraphQLServerPlugin(s.config)))
	}
	return api.Generate(
		s.getYmlConfig(),
		options...,
	)
}

// get the schema that will be passed to the template for rendering in a schema file
func (s *graphQLSchema) getSchemaForTemplate() *graphqlSchemaTemplate {
	ret := &graphqlSchemaTemplate{}

	for _, typ := range s.Types {

		if len(typ.nonEntFields) == 0 {
			// special case since we want the objects to exist ASAP but only render in schema.graphql if they have fields
			if typ.TypeName == "Query" {
				// TODO query is required so put a dummy thing that requires a resolver to be implemented. This doesn't work long term and we should throw an error
				typ.addNonEntField(&graphQLNonEntField{
					fieldName: "foo",
					fieldType: "String",
				})
			} else if typ.TypeName == "Mutation" {
				// nothing to do here, don't render anything
				continue
			} else {
				// probably throw an error here?
			}
		}

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
			OpeningSchemaLine: typ.GetOpeningSchemaLine(),
			TypeName:          typ.TypeName,
			SchemaLines:       lines,
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
	edge.Edge
}

func (e *graphqlFieldEdge) GetSchemaLine() string {
	// TODO allow overrides of this
	edgeName := strcase.ToLowerCamel(e.GetEdgeName())
	nodeName := e.GetNodeInfo().Node

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
	interfaces    []string
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
	s.fieldEdgeMap[e.GetEdgeName()] = e
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

func (s *graphQLSchemaInfo) GetOpeningSchemaLine() string {
	if len(s.interfaces) == 0 {
		return fmt.Sprintf("%s %s {", s.Type, s.TypeName)
	}
	return fmt.Sprintf("%s %s implements %s {", s.Type, s.TypeName, strings.Join(s.interfaces, "&"))
}

// wrapper object to represent the list of schema types that will be passed to a schema template file
type graphqlSchemaTemplate struct {
	Types   []*graphqlSchemaTypeInfo
	Scalars []string
}

// represents information needed by the schema template file to generate the schema for each type
type graphqlSchemaTypeInfo struct {
	TypeName          string
	OpeningSchemaLine string
	SchemaLines       []string // list of lines that will be generated for each graphql type e.g. "id: ID!", "user(id: ID!): User" etc
}
