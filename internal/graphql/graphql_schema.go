package graphql

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"text/template"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"

	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
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
	return "graphql_plugin"
}

func (p *Step) ProcessData(data *codegen.Data) error {
	// eventually make this configurable
	graphql := newGraphQLSchema(data)
	graphql.generateSchema()

	// right now it all panics but we have to change that lol
	return nil
}

var _ codegen.Step = &Step{}

type graphQLSchema struct {
	config         *codegen.Data
	Types          map[string]*graphQLSchemaInfo
	sortedTypes    []*graphQLSchemaInfo
	queryFields    []*graphQLNonEntField
	mutationFields []*graphQLNonEntField
}

func newGraphQLSchema(data *codegen.Data) *graphQLSchema {
	types := make(map[string]*graphQLSchemaInfo)

	return &graphQLSchema{
		config: data,
		Types:  types,
	}
}

func (schema *graphQLSchema) generateSchema() {
	validTypes := schema.generateGraphQLSchemaData()

	itemMap, err := schemaparser.ParseCustomGraphQLDefinitions(schema.config.CodePath.GetAbsPathToModels(), validTypes)
	util.Die(err)
	spew.Dump(itemMap)

	if len(itemMap) != 0 {
		schema.handleCustomDefinitions(itemMap)
	}

	schema.writeGraphQLSchema()

	schema.writeGQLGenYamlFile(itemMap)

	schema.generateGraphQLCode()
}

func (schema *graphQLSchema) handleCustomDefinitions(
	itemMap map[string][]schemaparser.ParsedItem,
) {

	getType := func(typ string, nullable bool) string {
		// TODO this doesn't work. we need to actually do type conversions here
		if typ == "float64" {
			typ = "float"
		}
		typ = strcase.ToCamel(typ)
		if nullable {
			return typ
		}
		return typ + "!"
	}

	for nodeName, items := range itemMap {
		schemaInfo, ok := schema.Types[nodeName]
		if !ok {
			util.Die(fmt.Errorf("invalid schema info %s retrieved", nodeName))
		}

		for _, item := range items {
			field := &graphQLNonEntField{
				fieldName: item.GraphQLName,
				fieldType: getType(item.Type, item.Nullable),
			}
			if len(item.Args) > 0 {
				args := make([]*graphQLArg, len(item.Args))
				for idx, arg := range item.Args {
					args[idx] = &graphQLArg{
						fieldName: arg.Name,
						fieldType: getType(arg.Type, arg.Nullable),
					}
				}
				field.args = args
			}
			schemaInfo.addNonEntField(field)
		}
	}
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

func (s *graphQLSchema) addGraphQLInfoForType(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) {
	// Contact, User etc...
	schemaInfo := newGraphQLSchemaInfo("type", nodeData.Node)
	// all top level nodes implement the Node interface
	schemaInfo.interfaces = []string{"Node"}

	fieldInfo := nodeData.FieldInfo
	// for any edge fields that reference an existing ID field, invalidate the id field so that it's not exposed to GraphQL
	// TODO allow client to override this :(
	// TODO probably cleaner to be passed into field generation so that each part is siloed so an orchestrator handles this
	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		if f != nil {
			fieldInfo.InvalidateFieldForGraphQL(f)
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

func (s *graphQLSchema) generateGraphQLSchemaData() map[string]bool {
	s.addSchemaInfo(s.getNodeInterfaceType())

	schema := s.config.Schema
	if len(schema.GetEdges()) > 0 {
		s.addSchemaInfo(s.getEdgeInterfaceType())
		s.addSchemaInfo(s.getConnectionInterfaceType())
	}

	validTypes := make(map[string]bool)
	nodeMap := schema.Nodes
	for _, info := range nodeMap {
		nodeData := info.NodeData

		if nodeData.HideFromGraphQL {
			continue
		}

		validTypes[nodeData.Node] = true
		// add the GraphQL type e.g. User, Contact etc
		s.addGraphQLInfoForType(nodeMap, nodeData)

		s.processActions(nodeData.ActionInfo)
	}

	s.addSchemaInfo(s.getQuerySchemaType())
	mutationsType := s.getMutationSchemaType()
	if mutationsType != nil {
		s.addSchemaInfo(mutationsType)
	}
	return validTypes
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

func (s *graphQLSchema) writeGraphQLSchema() {
	file.Write(&file.TemplatedBasedFileWriter{
		Data:              s.getSchemaForTemplate(),
		AbsPathToTemplate: util.GetAbsolutePath("graphql_schema.tmpl"),
		TemplateName:      "graphql_schema.tmpl",
		PathToFile:        "graphql/schema.graphql",
		CreateDirIfNeeded: true,
		FuncMap: template.FuncMap{
			"sortedTypes": getSortedTypes,
		},
	})
}

func (s *graphQLSchema) buildYmlConfig(
	itemMap map[string][]schemaparser.ParsedItem,
) config.Config {
	cfg := config.Config{
		SchemaFilename: []string{
			"graphql/schema.graphql",
		},
		Exec: config.PackageConfig{
			Filename: "graphql/generated.go",
			Package:  "graphql",
		},
		Model: config.PackageConfig{
			Filename: "graphql/models_gen.go",
			Package:  "graphql",
		},
		// don't need this since we're handling this ourselves
		// Resolver: config.PackageConfig{
		// 	Filename: "graphql/resolver.go",
		// 	Package:  "graphql",
		// 	Type:     "Resolver",
		// },
	}

	pathToModels := s.config.CodePath.GetImportPathToModels()

	models := make(config.TypeMap)

	for _, info := range s.config.Schema.Nodes {
		nodeData := info.NodeData

		if nodeData.HideFromGraphQL {
			continue
		}

		entry := config.TypeMapEntry{
			Model: []string{
				fmt.Sprintf(
					// e.g. github.com/lolopinto/jarvis/models.User
					"%s.%s",
					pathToModels,
					nodeData.Node,
				),
			},
		}

		items, ok := itemMap[nodeData.Node]
		if ok {
			entry.Fields = make(map[string]config.TypeMapField)
			for _, item := range items {
				// should only need this if GraphQLName != FunctionName
				if strings.ToLower(item.GraphQLName) == strings.ToLower(item.FunctionName) {
					continue
				}
				entry.Fields[item.GraphQLName] = config.TypeMapField{
					FieldName: item.FunctionName,
				}
			}
		}

		models[nodeData.Node] = entry
	}
	cfg.Models = models
	return cfg
}

func (s *graphQLSchema) writeGQLGenYamlFile(
	itemMap map[string][]schemaparser.ParsedItem,
) {
	file.Write(&file.YamlFileWriter{
		Data:              s.buildYmlConfig(itemMap),
		PathToFile:        "graphql/gqlgen.yml",
		CreateDirIfNeeded: true,
	})
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
