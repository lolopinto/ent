package graphql

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/99designs/gqlgen/codegen/config"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
)

func TestBuildGraphQLSchema(t *testing.T) {
	// TODO this test is useless. need to make it better
	t.Skip()
	schema := getTestGraphQLSchema(t)
	// Account from AccountConfig
	// Todo from TodoConfig
	// Event from EventConfig
	// Query
	// Create/Edit (Input|Response)
	expTypes := 27

	assert.Equal(
		t,
		expTypes,
		len(schema.Types),
		"expected %d types created, got %d instead",
		expTypes,
		len(schema.Types),
	)
}

func TestGraphQLObjectFields(t *testing.T) {
	s := getTestGraphQLObject("Account", t)

	if s.Type != "type" {
		t.Errorf("expected the Account GraphQL object's type to be %s, got %s instead", "type", s.Type)
	}

	if s.TypeName != "Account" {
		t.Errorf("graphql object type name was not as expected. expected %s, got %s", "Account", s.TypeName)
	}

	if len(s.fields) != 8 {
		t.Errorf("expected %d fields, got %d instead", 8, len(s.fields))
	}

	// friendship status
	if len(s.nonEntFields) != 1 {
		t.Errorf("expected %d non ent fields, got %d instead", 0, len(s.nonEntFields))
	}
}

func TestGraphQLIDField(t *testing.T) {
	f := getTestGraphQLField("Account", "ID", t)

	testField(t, f, "ID", "id: ID!")
}

func TestGraphQLStringField(t *testing.T) {
	f := getTestGraphQLField("Account", "FirstName", t)

	testField(t, f, "FirstName", "firstName: String!")
}

func TestGraphQLIntegerField(t *testing.T) {
	f := getTestGraphQLField("Folder", "NumberOfFiles", t)

	testField(t, f, "NumberOfFiles", "numberOfFiles: Int!")
}

func TestGraphQLTimeField(t *testing.T) {
	f := getTestGraphQLField("Account", "LastLoginAt", t)

	testField(t, f, "LastLoginAt", "lastLoginTime: Time!")
}

func TestGraphQLOtherIDField(t *testing.T) {
	assert.Panics(
		t,
		func() {
			getTestGraphQLField("Todo", "AccountID", t)
		},
		"couldn't get graphql field AccountID for Todo object",
	)

	// TODO re-write these comments since handled below
	// TODO multiple things wrong here.
	// 1: We need to move the logic in db_schema that accounts for this to fieldInfo
	// so that we account for strings in here and make this ID!
	// 2: we don't want IDs in here when they map to an accompanying object. so we should really
	// create an Account edge here automatically since we know it's a fkey
	// OR if there's a FieldEdge that maps to an ID field, we should use that and make sure there's a graphql edge for that instead
	//	testLine(line, "accountID: String!", "accountID", t)
}

func TestGraphQLOtherIDWithNoEdge(t *testing.T) {
	sources := make(map[string]string)

	sources["todo_config.go"] = `
	package configs

type TodoConfig struct {
	Text      string
	AccountID string 
}

	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	s := newGraphQLSchema(&codegen.Data{
		Schema: parseSchema(t, sources, "GraphQLOtherIDWithNoEdge"),
	})

	s.generateGraphQLSchemaData()
	f := getTestGraphQLFieldFromTemplate("Todo", "AccountID", s, t)

	testField(t, f, "AccountID", "accountID: String!")
}

func TestGraphQLHiddenObj(t *testing.T) {
	sources := make(map[string]string)

	sources["hidden_obj_config.go"] = `
	package configs

type HiddenObjConfig struct {
	Text      string
}

	func (config *HiddenObjConfig) GetTableName() string {
		return "hidden_obj"
	}

	func (config *HiddenObjConfig) HideFromGraphQL() bool {
		return true
	}
	`

	s := newGraphQLSchema(&codegen.Data{
		Schema: parseSchema(t, sources, "GraphQLHiddenObj"),
	})

	assert.Panics(
		t,
		func() {
			getTestGraphQLObjectFromSchema("HiddenObj", s, t)
		},
		"couldn't get graphql object for HiddenObj object",
	)
}

func TestNonExistentField(t *testing.T) {
	assert.Panics(
		t,
		func() {
			getTestGraphQLField("Account", "AccountID", t)
		},
		"couldn't get graphql field AccountID for Account object",
	)
}

func TestGraphQLQuery(t *testing.T) {
	s := getTestGraphQLObject("Query", t)

	if s.Type != "type" {
		t.Errorf("expected the Query GraphQL object's type to be %s, got %s instead", "type", s.Type)
	}

	if s.TypeName != "Query" {
		t.Errorf("graphql object type name was not as expected. expected %s, got %s", "Query", s.TypeName)
	}

	if len(s.fields) != 0 {
		t.Errorf("expected %d fields, got %d instead", 0, len(s.fields))
	}

	// account, folder, todo, event top level fields...
	if len(s.nonEntFields) != 4 {
		t.Errorf("expected %d non ent fields, got %d instead", 4, len(s.nonEntFields))
	}

	// to make sure account comes before todo
	sort.Slice(s.nonEntFields, func(i, j int) bool {
		return s.nonEntFields[i].fieldName < s.nonEntFields[j].fieldName
	})

	account := s.nonEntFields[0]
	if account.fieldName != "account" {
		t.Errorf(
			"graphql non-ent field for account has incorrect fieldName. expected %s, got %s instead",
			"account",
			account.fieldName,
		)
	}

	if account.fieldType != "Account" {
		t.Errorf(
			"graphql non-ent field for account has incorrect fieldType. expected %s, got %s instead",
			"Account",
			account.fieldType,
		)
	}

	if len(account.args) != 1 {
		t.Errorf(
			"graphql non-ent field for account has incorrect number of arguments. expected %d, got %d instead",
			1,
			len(account.args),
		)
	}
	arg := account.args[0]
	if arg.fieldName != "id" {
		t.Errorf(
			"fieldName for arg passed to account top level field invalid. expected %s, got %s instead",
			"id",
			arg.fieldName,
		)
	}

	if arg.fieldType != "ID!" {
		t.Errorf(
			"fieldType for arg passed to account top level field invalid. expected %s, got %s instead",
			"ID!",
			arg.fieldType,
		)
	}

	testLine(t, account, "account(id: ID!): Account", "accountField")
}

func TestGraphQLFieldEdge(t *testing.T) {
	e := getTestGraphQLFieldEdge("Todo", "Account", t)

	testEdge(t, e, "Account", "account: Account")
}

func TestGraphQLUniqueEdge(t *testing.T) {
	e := getTestGraphQLFieldEdge("Event", "Creator", t)

	testEdge(t, e, "Creator", "creator: Account")
}

func TestGraphQLForeignKeyEdge(t *testing.T) {
	e := getTestGraphqlPluralEdge("Account", "Todos", t)

	testEdge(t, e, "Todos", "todos: [Todo!]!")
}

func TestGraphQLAssociationKeyEdge(t *testing.T) {
	e := getTestGraphqlPluralEdge("Account", "Friends", t)

	testEdge(t, e, "Friends", "friends: [Account!]!")
}

func TestGraphQLCustomFunctions(t *testing.T) {
	sources := make(map[string]string)
	sources["account_gen.go"] = getFakeGeneratedFile()
	sources["account.go"] = `
	package models

	// GetFoo blah blah blah
  // @graphql
func (account *Account) GetFoo(baz int) string {
	return "foo"
}`

	s := newGraphQLSchema(&codegen.Data{
		// don't need real values here since we're not testing this
		// can do lazy schema for now since we're not testing the loaded schema path
		// probably fragile and needs to change
		CodePath: codegen.NewCodePath("", ""),
		Schema: &schema.Schema{
			Nodes: map[string]*schema.NodeDataInfo{
				"Account": &schema.NodeDataInfo{
					NodeData: &schema.NodeData{
						NodeInfo:    nodeinfo.GetNodeInfo("account"),
						PackageName: "account",
					},
				},
			},
		},
	})

	// do the minimum and add Account as a schemaInfo item.
	accountSchemaInfo := newGraphQLSchemaInfo("type", "Account")
	s.addSchemaInfo(accountSchemaInfo)

	resultChan := schemaparser.ParseCustomGraphQLDefinitions(
		&schemaparser.SourceSchemaParser{
			PackageName: "models",
			Sources:     sources,
		},
		&customEntParser{
			validTypes: map[string]bool{
				"Account": true,
			},
		},
	)
	result := <-resultChan
	assert.Nil(t, result.Error)
	assert.NotNil(t, result.ParsedItems)

	parsedItems := result.ParsedItems["Account"]

	s.handleCustomDefinitions(result.ParsedItems)
	testCustomDefinitions(t, accountSchemaInfo, parsedItems)

	ymlConfig := s.buildYmlConfig(result.ParsedItems)
	testCustomYmlConfig(t, ymlConfig, accountSchemaInfo, parsedItems)
}

func testCustomDefinitions(
	t *testing.T,
	schemaInfo *graphQLSchemaInfo,
	parsedItems []schemaparser.ParsedItem,
) {

	assert.Equal(t, len(schemaInfo.nonEntFields), len(parsedItems))

	for idx, field := range schemaInfo.nonEntFields {
		item := parsedItems[idx]

		assert.Equal(t, field.fieldName, item.GraphQLName)
		assert.Equal(t, field.fieldType, item.Type.GetGraphQLType())
		assert.Equal(t, len(field.args), len(item.Args))

		for idx, arg := range field.args {
			parsedArg := item.Args[idx]

			assert.Equal(t, arg.fieldName, parsedArg.Name)
			assert.Equal(t, arg.fieldType, parsedArg.Type.GetGraphQLType())
		}
	}
}

func testCustomYmlConfig(
	t *testing.T,
	cfg config.Config,
	schemaInfo *graphQLSchemaInfo,
	parsedItems []schemaparser.ParsedItem,
) {

	model := cfg.Models[schemaInfo.TypeName]
	assert.NotNil(t, model)

	for _, item := range parsedItems {
		if strings.ToLower(item.GraphQLName) == strings.ToLower(item.FunctionName) {
			continue
		}

		expEntry := config.TypeMapField{
			FieldName: item.FunctionName,
		}

		assert.Equal(t, expEntry, model.Fields[item.GraphQLName])
	}
}

func getFakeGeneratedFile() string {
	return `
	package models

	import (
		"github.com/lolopinto/ent/ent"
		"github.com/lolopinto/ent/ent/privacy"
	)

	type Account struct {
		ent.Node
		privacy.AlwaysDenyPrivacyPolicy
	}
`
}

func testLine(t *testing.T, lineItem graphqlLineItem, expectedSchemaLine, itemName string) {
	line := lineItem.GetSchemaLine()
	if line != expectedSchemaLine {
		t.Errorf(
			"schema line for the %s field/edge was not as expected, expected %s, got %s instead",
			itemName,
			expectedSchemaLine,
			line,
		)
	}
}

func testField(t *testing.T, f *graphQLField, expectedFieldName, expectedSchemaLine string) {
	if f.FieldName != expectedFieldName {
		t.Errorf(
			"field name for field was not as expected, expected %s, got %s instead",
			expectedFieldName,
			f.FieldName,
		)
	}
	testFieldLine(t, f, expectedSchemaLine)
}

func testFieldLine(t *testing.T, f *graphQLField, expectedSchemaLine string) {
	testLine(t, f, expectedSchemaLine, f.FieldName)
}

func testEdge(t *testing.T, e graphqlEdge, expectedEdgeName, expectedSchemaLine string) {
	if e.GetEdgeName() != expectedEdgeName {
		t.Errorf(
			"edge name for edge was not as expected, expected %s, got %s",
			e.GetEdgeName(),
			expectedEdgeName,
		)
	}
	testEdgeLine(t, e, expectedSchemaLine)
}

func testEdgeLine(t *testing.T, e graphqlEdge, expectedSchemaLine string) {
	testLine(t, e, expectedSchemaLine, e.GetEdgeName())
}

func getTestGraphQLObject(typeName string, t *testing.T) *graphQLSchemaInfo {
	schema := getTestGraphQLSchema(t)
	return getTestGraphQLObjectFromSchema(typeName, schema, t)
}

func getTestGraphQLObjectFromSchema(typeName string, schema *graphQLSchema, t *testing.T) *graphQLSchemaInfo {
	s, ok := schema.Types[typeName]
	if !ok {
		panic(fmt.Errorf("couldn't get graphql object for %s object", typeName))
	}
	return s
}

func getTestGraphQLField(typeName, fieldName string, t *testing.T) *graphQLField {
	s := getTestGraphQLObject(typeName, t)
	return getTestGraphQLFieldFromObject(typeName, fieldName, s, t)
}

func getTestGraphQLFieldFromObject(typeName, fieldName string, s *graphQLSchemaInfo, t *testing.T) *graphQLField {
	f := s.getFieldByName(fieldName)
	if f == nil {
		panic(fmt.Errorf("couldn't get graphql field %s for %s object", fieldName, typeName))
	}
	return f
}

func getTestGraphQLFieldFromTemplate(typeName, fieldName string, schema *graphQLSchema, t *testing.T) *graphQLField {
	s := getTestGraphQLObjectFromSchema(typeName, schema, t)
	return getTestGraphQLFieldFromObject(typeName, fieldName, s, t)
}

func getTestGraphQLSchema(t *testing.T) *graphQLSchema {
	data := &codegen.Data{
		Schema: getParsedTestSchema(t),
	}
	schema := newGraphQLSchema(data)
	schema.generateGraphQLSchemaData()
	return schema
}

func getTestGraphQLFieldEdge(typeName, edgeName string, t *testing.T) *graphqlFieldEdge {
	s := getTestGraphQLObject(typeName, t)
	e := s.getFieldEdgeByName(edgeName)
	if e == nil {
		panic(fmt.Errorf("couldn't get graphql field edge %s for %s object", edgeName, typeName))
	}
	return e
}

func getTestGraphqlPluralEdge(typeName, edgeName string, t *testing.T) *graphqlPluralEdge {
	s := getTestGraphQLObject(typeName, t)
	e := s.getPluralEdgeByName(edgeName)
	if e == nil {
		panic(fmt.Errorf("couldn't get graphql field edge %s for %s object", edgeName, typeName))
	}
	return e
}

// inlining this in a bunch of places to break the import cycle
func parseSchema(t *testing.T, sources map[string]string, uniqueKeyForSources string) *schema.Schema {
	data := parsehelper.ParseFilesForTest(
		t,
		parsehelper.Sources(uniqueKeyForSources, sources),
	)
	return schema.ParsePackage(data.Pkg)
}

func getParsedTestSchema(t *testing.T) *schema.Schema {
	// use parsehelper.ParseFilesForTest since that caches it
	data := parsehelper.ParseFilesForTest(t)
	return schema.ParsePackage(data.Pkg)
}
