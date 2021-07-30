package action_test

import (
	"sync"
	"testing"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/schemaparser"
	testsync "github.com/lolopinto/ent/internal/testingutils/sync"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequiredField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastName")
	f2 := getTestFieldByName(t, "AccountConfig", "Bio")

	a := getTestActionByName(t, "account", "CreateAccountAction")
	a2 := getTestActionByName(t, "account", "EditAccountAction")

	assert.True(t, action.IsRequiredField(a, f), "LastName field not required in CreateAction as expected")
	assert.False(t, action.IsRequiredField(a2, f), "LastName field required in EditAction not expected")
	assert.False(t, action.IsRequiredField(a, f2), "Bio field required in CreateAction not expected")
	assert.False(t, action.IsRequiredField(a2, f2), "Bio field required in EditAction not expected")
}

func TestEdgeActions(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetAssociationEdgeByName("Folders")
	assert.NotNil(t, edge)
	// 2 actions!
	assert.Equal(t, len(edge.EdgeActions), 2)

	actionInfo := getTestActionInfo(t, "account")

	var testCases = []struct {
		actionName       string
		exposeToGraphQL  bool
		graphQLName      string
		actionMethodName string
	}{
		{
			// these 2 are custom
			"AccountAddFolderAction",
			true,
			"accountFolderAdd",
			"AccountAddFolder",
		},
		{
			// these 2 are defaults
			"RemoveFolderAction",
			true,
			"accountRemoveFolder",
			"RemoveFolder",
		},
	}

	for _, tt := range testCases {
		a := actionInfo.GetByName(tt.actionName)

		assert.NotNil(
			t,
			a,
			"expected there to be an action with name %s ",
			tt.actionName,
		)

		actionFromGraphQL := actionInfo.GetByGraphQLName(tt.graphQLName)
		if tt.exposeToGraphQL {
			assert.NotNil(
				t,
				actionFromGraphQL,
				"expected there to be an action with graphql name %s ",
				tt.graphQLName,
			)
		} else {
			assert.Nil(
				t,
				actionFromGraphQL,
				"expected there to not be an action with graphql name %s ",
				tt.graphQLName,
			)
		}

		name, err := action.GetActionMethodName(a)
		assert.Nil(t, err)
		assert.Equal(
			t,
			tt.actionMethodName,
			name,
		)
	}
}

func TestEdgeGroupActions(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")
	assert.NotNil(t, edgeGroup)

	assert.Equal(t, len(edgeGroup.EdgeActions), 1)

	actionInfo := getTestActionInfo(t, "account")

	assert.NotNil(
		t,
		actionInfo.GetByName("AccountFriendshipStatusAction"),
		"expected there to be an action with AccountFriendshipStatusAction",
	)

	assert.NotNil(
		t,
		actionInfo.GetByGraphQLName("accountSetFriendshipStatus"),
		"expected there to be an action with graphql name accountSetFriendshipStatus",
	)
}

type expectedField struct {
	name     string
	nullable bool
	tsType   string
	gqlType  string
}

type expectedAction struct {
	name             string
	fields           []expectedField
	actionOnlyFields []actionOnlyField
	customInterfaces []customInterface
}

type customInterface struct {
	fields       []expectedField
	nonEntFields []actionOnlyField
	tsType       string
	gqlType      string
	actionName   string
}

type actionOnlyField struct {
	name     string
	nullable bool
	typ      fieldType
}

type fieldType struct {
	tsType      string
	graphqlType string
}

func TestActionFields(t *testing.T) {
	verifyExpectedFields(
		t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"
	import "github.com/lolopinto/ent/ent/field/email"
	import "github.com/lolopinto/ent/ent/field/phonenumber"

	type ContactConfig struct {}
	
	func (config *ContactConfig) GetFields() ent.FieldMap {
		return ent.FieldMap {
			"EmailAddress": field.F(
				email.Type(),
			),
			"FirstName": field.F(field.StringType()),
			"LastName": field.F(field.StringType()),
			"PhoneNumber": field.F(phonenumber.Type()),
		}
	}
	
	func (config *ContactConfig) GetActions() []*ent.ActionConfig {
		return []*ent.ActionConfig{
			&ent.ActionConfig{
				Action: ent.MutationsAction,
			},
		}
	}`,
		"contact",
		[]expectedAction{
			{
				name: "CreateContactAction",
				fields: []expectedField{
					{
						name:    "EmailAddress",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "LastName",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "PhoneNumber",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
			{
				name: "EditContactAction",
				fields: []expectedField{
					{
						name:    "EmailAddress",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "LastName",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "PhoneNumber",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
			{
				name: "DeleteContactAction",
			},
		},
	)
}

func TestActionFieldsWithPrivateFields(t *testing.T) {
	verifyExpectedFields(
		t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"
	import "github.com/lolopinto/ent/ent/field/email"
	import "github.com/lolopinto/ent/ent/field/password"

	type UserConfig struct {}
	
	func (config *UserConfig) GetFields() ent.FieldMap {
		return ent.FieldMap {
			"EmailAddress": field.F(
				email.Type(),
				field.Unique(), 
			),
			"Password": field.F(
				password.Type(),
			),
			"FirstName": field.F(field.StringType()),
		}
	}
	
	func (config *UserConfig) GetActions() []*ent.ActionConfig {
		return []*ent.ActionConfig{
			&ent.ActionConfig{
				Action: ent.CreateAction,
				Fields: []string{
					"FirstName",
					"EmailAddress",
					"Password",
				},
			},
			&ent.ActionConfig{
				Action: ent.EditAction,
				Fields: []string{
					"FirstName",
				},
			},
		}
	}`,
		"user",
		[]expectedAction{
			{
				name: "CreateUserAction",
				fields: []expectedField{
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "EmailAddress",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "Password",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
			{
				name: "EditUserAction",
				fields: []expectedField{
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
		},
	)
}

func TestDefaultActionFieldsWithPrivateFields(t *testing.T) {
	verifyExpectedFields(
		t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"
	import "github.com/lolopinto/ent/ent/field/email"
	import "github.com/lolopinto/ent/ent/field/password"

	type UserConfig struct {}
	
	func (config *UserConfig) GetFields() ent.FieldMap {
		return ent.FieldMap {
			"EmailAddress": field.F(
				email.Type(),
				field.Unique(), 
			),
			"Password": field.F(
				password.Type(),
			),
			"FirstName": field.F(field.StringType()),
		}
	}
	
	func (config *UserConfig) GetActions() []*ent.ActionConfig {
		return []*ent.ActionConfig{
			&ent.ActionConfig{
				Action: ent.CreateAction,
			},
			&ent.ActionConfig{
				Action: ent.EditAction,
			},
		}
	}`,
		"user",
		// Password not show up here by default since private
		[]expectedAction{
			{
				name: "CreateUserAction",
				fields: []expectedField{
					{
						name:    "EmailAddress",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
			{
				name: "EditUserAction",
				fields: []expectedField{
					{
						name:    "EmailAddress",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
		},
	)
}

func TestDefaultNoFields(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, Field, StringType, Action, ActionOperation, BaseEntSchema, NoFields} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "FirstName"}),
						StringType({name: "LastName"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Edit, 
						},
					];
				}
				`,
			),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
		[]expectedAction{
			{
				name: "EditUserAction",
				// TODO action.GetFields() shouldn't include fields that are not editable by the action
				fields: expectedFieldsPlusDefault(
					expectedField{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String!",
					},
					expectedField{
						name:    "LastName",
						tsType:  "string",
						gqlType: "String!",
					},
				),
			},
		},
	)
}

func TestExplicitNoFields(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, Field, StringType, Action, ActionOperation, BaseEntSchema, NoFields} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "FirstName"}),
						StringType({name: "LastName"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Edit, 
							fields: [NoFields],
						},
					];
				}
				`,
			),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
		[]expectedAction{
			{
				name:   "EditUserAction",
				fields: []expectedField{},
			},
		},
	)
}

func TestNullableFieldInAction(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, Field, StringType, Action, ActionOperation, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "FirstName"}),
						StringType({name: "LastName"}),
						StringType({name: "EmailAddress", nullable: true}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Edit, 
							actionName: "EditEmailAddressAction",
							graphQLName: "editEmailAddressAction",
							fields: ["EmailAddress"],
						},
					];
				}
				`,
			),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
		[]expectedAction{
			{
				name: "EditEmailAddressAction",
				fields: []expectedField{
					{
						name:     "EmailAddress",
						nullable: true,
						tsType:   "string | null",
						gqlType:  "String",
					},
				},
			},
		},
	)
}
func TestOverriddenRequiredActionField(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, Field, StringType, Action, ActionOperation, BaseEntSchema, requiredField} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "FirstName"}),
						StringType({name: "LastName"}),
						StringType({name: "EmailAddress", nullable: true}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Edit, 
							actionName: "EditEmailAddressAction",
							graphQLName: "editEmailAddressAction",
							fields: [requiredField("EmailAddress")],
						},
					];
				}
				`,
			),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
		[]expectedAction{
			{
				name: "EditEmailAddressAction",
				fields: []expectedField{
					{
						// not nullable!
						name:    "EmailAddress",
						tsType:  "string",
						gqlType: "String!",
					},
				},
			},
		},
	)
}

func TestOverriddenOptionalActionField(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, Field, StringType, Action, ActionOperation, BaseEntSchema, optionalField} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "FirstName"}),
						StringType({name: "LastName"}),
						StringType({name: "EmailAddress", nullable: true}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Edit, 
							actionName: "EditNameAction",
							graphQLName: "editUserName",
							fields: [optionalField("FirstName"), optionalField("LastName")],
						},
					];
				}
				`,
			),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
		[]expectedAction{
			{
				name: "EditNameAction",
				fields: []expectedField{
					{
						name:    "FirstName",
						tsType:  "string",
						gqlType: "String",
					},
					{
						name:    "LastName",
						tsType:  "string",
						gqlType: "String",
					},
				},
			},
		},
	)
}

func TestActionOnlyFields(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"event.ts": testhelper.GetCodeWithSchema(
				`
				import {BaseEntSchema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
							actionOnlyFields: [{
								name: "addCreatorAsAdmin",
								type: "Boolean",
							},
							{
								name: "localTime",
								type: "Time",
								nullable: true,
							}],
						},
					];
				};`),
		},
		base.TypeScript,
		"EventConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
		[]expectedAction{
			{
				name: "CreateEventAction",
				fields: expectedFieldsPlusDefault(
					expectedField{
						name:    "name",
						tsType:  "string",
						gqlType: "String!",
					},
					expectedField{
						name:    "start_time",
						tsType:  "Date",
						gqlType: "Time!",
					},
				),
				actionOnlyFields: []actionOnlyField{
					{
						name: "addCreatorAsAdmin",
						typ: fieldType{
							tsType:      "boolean",
							graphqlType: "Boolean!",
						},
					},
					{
						name:     "localTime",
						nullable: true,
						typ: fieldType{
							tsType:      "Date | null",
							graphqlType: "Time",
						},
					},
				},
			},
		},
	)
}

func TestEmbeddedActionOnlyFields(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(
		t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(
				`import {BaseEntSchema, Action, Field, StringType, UUIDType, ActionOperation} from "{schema}";

		export default class Address extends BaseEntSchema {
		fields: Field[] = [
			StringType({ name: "Street" }),
			StringType({ name: "City" }),
			StringType({ name: "State" }),
			StringType({ name: "ZipCode" }), 
		];

		actions: Action[] = [
			{
				operation: ActionOperation.Create,
			},
		];
	}`),
			"event_activity.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Action, Field, ActionOperation, StringType, TimestampType, UUIDType} from "{schema}";

				export default class EventActivity extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "name"}),
						UUIDType({name: "eventID"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
							actionOnlyFields: [{
								name: "address",
								actionName: "CreateAddressAction",
								type: "Object",
							}],
						},
					];
				};`),
			"event.ts": testhelper.GetCodeWithSchema(
				`
				import {BaseEntSchema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
							actionOnlyFields: [{
								name: "activities",
								actionName: "CreateEventActivityAction",
								list: true,
								type: "Object",
							}],
						},
					];
				};`),
		},
		base.TypeScript,
	)

	activityActionInfo := schema.Nodes["EventActivityConfig"].NodeData.ActionInfo
	require.NotNil(t, activityActionInfo)

	activityCoreFields := []expectedField{
		{
			name:    "name",
			tsType:  "string",
			gqlType: "String!",
		},
		{
			name:    "eventID",
			tsType:  "ID",
			gqlType: "ID!",
		},
	}
	activityFields := expectedFieldsPlusDefault(activityCoreFields...)

	addressCoreFields := []expectedField{
		{
			name:    "Street",
			tsType:  "string",
			gqlType: "String!",
		},
		{
			name:    "City",
			tsType:  "string",
			gqlType: "String!",
		},
		{
			name:    "State",
			tsType:  "string",
			gqlType: "String!",
		},
		{
			name:    "ZipCode",
			tsType:  "string",
			gqlType: "String!",
		},
	}

	verifyExpectedActions(
		t,
		activityActionInfo,
		[]expectedAction{
			{
				name:   "CreateEventActivityAction",
				fields: activityFields,
				actionOnlyFields: []actionOnlyField{
					{
						name: "address",
						typ: fieldType{
							tsType:      "customAddressInput",
							graphqlType: "AddressEventActivityCreateInput!",
						},
					},
				},
				customInterfaces: []customInterface{
					{
						fields:  addressCoreFields,
						tsType:  "customAddressInput",
						gqlType: "AddressEventActivityCreateInput",
					},
				},
			},
		},
	)
	eventActionInfo := schema.Nodes["EventConfig"].NodeData.ActionInfo
	require.NotNil(t, eventActionInfo)

	verifyExpectedActions(
		t,
		eventActionInfo,
		[]expectedAction{
			{
				name: "CreateEventAction",
				fields: expectedFieldsPlusDefault(
					expectedField{
						name:    "name",
						tsType:  "string",
						gqlType: "String!",
					},
					expectedField{
						name:    "start_time",
						tsType:  "Date",
						gqlType: "Time!",
					},
				),
				actionOnlyFields: []actionOnlyField{
					{
						name: "activities",
						typ: fieldType{
							tsType:      "customActivityInput[]",
							graphqlType: "[ActivityEventCreateInput!]!",
						},
					},
				},
				customInterfaces: []customInterface{
					{
						fields:  activityCoreFields,
						tsType:  "customActivityInput",
						gqlType: "ActivityEventCreateInput",
						nonEntFields: []actionOnlyField{
							{
								name: "address",
								typ: fieldType{
									tsType:      "customAddressInput",
									graphqlType: "AddressEventActivityCreateInput!",
								},
							},
						},
					},
					{
						fields:     addressCoreFields,
						tsType:     "customAddressInput",
						gqlType:    "AddressEventActivityCreateInput",
						actionName: "CreateEventActivityAction",
					},
				},
			},
		},
	)
}

func verifyExpectedFields(t *testing.T, code, nodeName string, expActions []expectedAction) {
	pkg, fnMap, err := schemaparser.FindFunctions(code, "configs", "GetFields", "GetActions")
	require.Nil(t, err)
	require.Len(t, fnMap, 2)
	require.NotNil(t, pkg)
	require.NotNil(t, fnMap["GetFields"])

	fieldInfo, err := field.ParseFieldsFunc(pkg, fnMap["GetFields"])
	require.NotNil(t, fieldInfo)
	require.Nil(t, err)

	require.NotNil(t, fnMap["GetActions"])

	actionInfo, err := action.ParseActions(nodeName, fnMap["GetActions"], fieldInfo, nil, base.GoLang)
	require.Nil(t, err)
	verifyExpectedActions(t, actionInfo, expActions)
}

func verifyExpectedActions(t *testing.T, actionInfo *action.ActionInfo, expActions []expectedAction) {
	require.Len(t, actionInfo.Actions, len(expActions))

	for _, expAction := range expActions {
		a := actionInfo.GetByName(expAction.name)
		require.NotNil(t, a, "action by name %s is nil", expAction.name)

		verifyFields(t, a.GetFields(), expAction.fields)

		verifyNonEntFields(t, a.GetNonEntFields(), expAction.actionOnlyFields)

		if len(expAction.customInterfaces) != 0 {
			// only do this for when we want to test this
			// TODO we should change everywhere to test this
			customInterfaces := a.GetCustomInterfaces()
			require.Len(t, expAction.customInterfaces, len(customInterfaces))

			for idx, customInt := range customInterfaces {
				expCustomInt := expAction.customInterfaces[idx]

				assert.Equal(t, customInt.TSType, expCustomInt.tsType)
				assert.Equal(t, customInt.GQLType, expCustomInt.gqlType)

				verifyFields(t, customInt.Fields, expCustomInt.fields)
				verifyNonEntFields(t, customInt.NonEntFields, expCustomInt.nonEntFields)

				if expCustomInt.actionName == "" {
					assert.Nil(t, customInt.Action)
				} else {
					assert.Equal(t, expCustomInt.actionName, customInt.Action.GetActionName())
				}
			}
		}
	}
}

func verifyFields(t *testing.T, fields []*field.Field, expFields []expectedField) {
	require.Equal(t, len(expFields), len(fields), "length of fields")

	for idx, field := range fields {
		expField := expFields[idx]
		require.Equal(t, expField.name, field.FieldName, "fieldname %s not equal", field.FieldName)
		require.Equal(t, expField.nullable, field.Nullable(), "fieldname %s not equal", field.FieldName)
		require.Equal(t, expField.gqlType, field.GetGraphQLTypeForField(), "fieldname %s not equal", field.FieldName)
		require.Equal(t, expField.tsType, field.TsBuilderType(), "fieldname %s not equal", field.FieldName)
	}
}

func verifyNonEntFields(t *testing.T, nonEntFields []*action.NonEntField, expFields []actionOnlyField) {
	require.Equal(t, len(expFields), len(nonEntFields), "length of fields")

	for idx, nonEntField := range nonEntFields {
		actionOnlyField := expFields[idx]
		require.Equal(t, actionOnlyField.name, nonEntField.FieldName, "name %s not equal. idx %d", nonEntField.FieldName, idx)
		require.Equal(t, actionOnlyField.nullable, nonEntField.Nullable, "fieldname %s not equal. idx %d", nonEntField.FieldName, idx)
		require.Equal(t, actionOnlyField.typ.graphqlType, nonEntField.FieldType.GetGraphQLType(), "graphql type %s not equal. idx %d", nonEntField.FieldName, idx)
		require.Equal(t, actionOnlyField.typ.tsType, nonEntField.FieldType.GetTSType(), "ts type %s not equal. idx %d", nonEntField.FieldName, idx)
	}
}

func getParsedConfig(t *testing.T) *parsehelper.FileConfigData {
	return parsehelper.ParseFilesForTest(t, parsehelper.ParseFuncs(parsehelper.ParseStruct|parsehelper.ParseEdges|parsehelper.ParseActions))
}

// this is slightly confusing but we have multi-caching going on here
// similar to field_test, edge_test, we're caching the results of parsing fields, edges, actions into separate
// instances of RunOnce.
// They all use getParsedConfig() which has its own caching based on flags passed above.
var rF *testsync.RunOnce
var rA *testsync.RunOnce
var rE *testsync.RunOnce

var once sync.Once

func initSyncs() {
	once.Do(func() {
		rF = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)
			fieldInfo, err := field.GetFieldInfoForStruct(data.StructMap[configName], data.Info)
			assert.Nil(t, err)
			assert.NotNil(t, fieldInfo, "invalid fieldInfo retrieved")
			return fieldInfo
		})

		rE = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)
			fn := data.GetEdgesFn(configName)
			assert.NotNil(t, fn, "GetEdges fn was unexpectedly nil")
			edgeInfo, err := edge.ParseEdgesFunc(configName, fn)
			require.Nil(t, err)
			assert.NotNil(t, edgeInfo, "invalid edgeInfo retrieved")
			return edgeInfo
		})

		rA = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)

			fn := data.GetActionsFn(configName)
			assert.NotNil(t, fn, "GetActions fn was unexpectedly nil")

			// TODO need to fix this dissonance...
			fieldInfo := getTestFieldInfo(t, strcase.ToCamel(configName)+"Config")
			edgeInfo := getTestEdgeInfo(t, configName)
			actionInfo, err := action.ParseActions("Account", fn, fieldInfo, edgeInfo, base.GoLang)
			assert.NotNil(t, actionInfo, "invalid actionInfo retrieved")
			require.NoError(t, err)
			return actionInfo
		})
	})
}

func getFieldInfoMap() *testsync.RunOnce {
	initSyncs()
	return rF
}

func getActionInfoMap() *testsync.RunOnce {
	initSyncs()
	return rA
}

func getEdgeInfoMap() *testsync.RunOnce {
	initSyncs()
	return rE
}

func getTestActionInfo(t *testing.T, configName string) *action.ActionInfo {
	return getActionInfoMap().Get(t, configName).(*action.ActionInfo)
}

func getTestActionByName(t *testing.T, configName string, actionName string) action.Action {
	//	name := action.GetActionTypeFromString(actionType).(actionWithDefaultActionName).getDefaultActionName(configName)
	a := getTestActionInfo(t, configName).GetByName(actionName)
	assert.NotNil(t, a, "invalid action retrieved")
	return a
}

// copied and modified from field_test.go
func getTestFieldInfo(t *testing.T, configName string) *field.FieldInfo {
	return getFieldInfoMap().Get(t, configName).(*field.FieldInfo)
}

func getTestEdgeInfo(t *testing.T, configName string) *edge.EdgeInfo {
	return getEdgeInfoMap().Get(t, configName).(*edge.EdgeInfo)
}

func getTestFieldByName(t *testing.T, configName string, fieldName string) *field.Field {
	fieldInfo := getTestFieldInfo(t, configName)
	return fieldInfo.GetFieldByName(fieldName)
}

func expectedFieldsPlusDefault(fields ...expectedField) []expectedField {
	// TODO action.GetFields() shouldn't include fields that are not editable by the action
	ret := []expectedField{
		{
			name:    "ID",
			tsType:  "ID",
			gqlType: "ID!",
		},
		{
			name:    "createdAt",
			tsType:  "Date",
			gqlType: "Time!",
		},
		{
			name:    "updatedAt",
			tsType:  "Date",
			gqlType: "Time!",
		},
	}
	ret = append(ret, fields...)
	return ret
}
