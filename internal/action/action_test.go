package action_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/testingutils/testmodel"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequiredField(t *testing.T) {
	f := testmodel.GetFieldFromSchema(t, "Account", "LastName")
	f2 := testmodel.GetFieldFromSchema(t, "Account", "Bio")

	a := testmodel.GetActionFromSchema(t, "Account", "CreateAccountAction")
	a2 := testmodel.GetActionFromSchema(t, "Account", "EditAccountAction")

	assert.True(t, action.IsRequiredField(a, f), "LastName field not required in CreateAction as expected")
	assert.False(t, action.IsRequiredField(a2, f), "LastName field required in EditAction not expected")
	assert.False(t, action.IsRequiredField(a, f2), "Bio field required in CreateAction not expected")
	assert.False(t, action.IsRequiredField(a2, f2), "Bio field required in EditAction not expected")
}

func TestEdgeActions(t *testing.T) {
	edge := testmodel.GetEdgeFromSchema(t, "Account", "Folders")
	// 2 actions!
	assert.Equal(t, len(edge.EdgeActions), 2)

	actionInfo := testmodel.GetActionInfoFromSchema(t, "Account")

	var testCases = []struct {
		actionName       string
		exposeToGraphQL  bool
		graphQLName      string
		actionMethodName string
	}{
		{
			"AccountAddFolderAction",
			true,
			"accountFolderAdd",
			"AccountAddFolder",
		},
		{
			"AccountRemoveFolderAction",
			true,
			"accountRemoveFolder",
			"AccountRemoveFolder",
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
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Account")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")
	assert.NotNil(t, edgeGroup)

	assert.Equal(t, len(edgeGroup.EdgeActions), 1)

	actionInfo := testmodel.GetActionInfoFromSchema(t, "Account")

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
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"contact.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, ActionOperation} from "{schema}";

			const ContactSchema = new EntSchema({
				fields: {
					EmailAddress: StringType(),
					FirstName: StringType(),
					LastName: StringType(),
					PhoneNumber: StringType(),
				},
				actions: [
					{
						operation: ActionOperation.Mutations,
					},
				],
 			});
			export default ContactSchema;
			`),
		},
		base.TypeScript,
		"ContactConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
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
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, ActionOperation} from "{schema}";

			const UserSchema = new EntSchema({
				fields: {
					EmailAddress: StringType({unique:true}),
					Password: StringType({private:true, hideFromGraphQL: true}),
					FirstName: StringType(),
				},

				actions: [
					{
						operation: ActionOperation.Create,
						fields: ["FirstName", "EmailAddress", "Password"]
					},
					{
						operation: ActionOperation.Edit,
						fields: ["FirstName"]
					},
				],
			
			});
			export default UserSchema;
			`),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
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
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, ActionOperation} from "{schema}";

			const UserSchema = new EntSchema({
				fields: {
					EmailAddress: StringType({unique:true}),
					Password: StringType({private:true, hideFromGraphQL: true}),
					FirstName: StringType(),
				},

				actions: [
					{
						operation: ActionOperation.Create,
					},
					{
						operation: ActionOperation.Edit,
					},
				],
			
			});
			export default UserSchema;
			`),
		},
		base.TypeScript,
		"UserConfig",
	)

	verifyExpectedActions(
		t,
		actionInfo,
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
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema, NoFields} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastName: StringType(),
					};

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
				fields: []expectedField{
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
				},
			},
		},
	)
}

func TestExplicitNoFields(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema, NoFields} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastName: StringType(),
					};

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
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastNAme: StringType(),
						EmailAddress: StringType({nullable: true}),
					};

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
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema, requiredField} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastName: StringType(),
						EmailAddress: StringType({nullable: true}),
					};

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

func TestPrivateFieldExposedToActions(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema, requiredField} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastName: StringType(),
						EmailAddress: StringType(),
						Password: StringType({
							private: {
								exposeToActions: true,
							},
						}),
					};

					actions: Action[] = [
						{
							operation: ActionOperation.Create, 
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
				name: "CreateUserAction",
				fields: []expectedField{
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
		},
	)
}

func TestPrivateField(t *testing.T) {
	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema, requiredField} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastName: StringType(),
						EmailAddress: StringType(),
						Password: StringType({
							private: true,
						}),
					};

					actions: Action[] = [
						{
							operation: ActionOperation.Create, 
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
				name: "CreateUserAction",
				fields: []expectedField{
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
				`import {Schema, FieldMap, StringType, Action, ActionOperation, BaseEntSchema, optionalField} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: FieldMap = {
						FirstName: StringType(),
						LastName: StringType(),
						EmailAddress: StringType({nullable: true}),
					};

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
				import {BaseEntSchema, Action, FieldMap, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event extends BaseEntSchema {
					fields: FieldMap = {
						name: StringType(),
						start_time: TimestampType(),
					};

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
				fields: []expectedField{
					{
						name:    "name",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "start_time",
						tsType:  "Date",
						gqlType: "Time!",
					},
				},
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

func TestActionOnlyFieldsInvalidAction(t *testing.T) {
	schema, err := testhelper.ParseSchemaForTestFull(
		t,
		map[string]string{
			"contact.ts": testhelper.GetCodeWithSchema(
				`
				import {BaseEntSchema, Action, FieldMap, ActionOperation, StringType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: FieldMap = {
						name: StringType(),
					};

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
							actionOnlyFields: [{
								name: "emails",
								type: "Object",
								list: true,
								actionName: "CreateEmailAction",
							}],
						},
					];
				};`),
			"contact_email.ts": testhelper.GetCodeWithSchema(
				`
				import {BaseEntSchema, Action, FieldMap, ActionOperation, StringType} from "{schema}";

				export default class ContactEmail extends BaseEntSchema {
					fields: FieldMap = {
						email: StringType(),
						label: StringType(),
					};

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
						},
					];
				};`,
			),
		},
		base.TypeScript,
	)

	require.Nil(t, schema)
	require.NotNil(t, err)
	require.Equal(t, err.Error(), "invalid action only field emails. couldn't find action with name CreateEmailAction")
}

func TestEmbeddedActionOnlyFields(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(
		t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(
				`import {BaseEntSchema, Action, FieldMap, StringType, UUIDType, ActionOperation} from "{schema}";

		export default class Address extends BaseEntSchema {
		fields: FieldMap = {
			Street: StringType(),
			City: StringType(),
			State: StringType(),
			ZipCode: StringType(), 
		};

		actions: Action[] = [
			{
				operation: ActionOperation.Create,
			},
		];
	}`),
			"event_activity.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Action, FieldMap, ActionOperation, StringType, TimestampType, UUIDType} from "{schema}";

				export default class EventActivity extends BaseEntSchema {
					fields: FieldMap = {
						name: StringType(),
						eventID: UUIDType(),
					};

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
				import {BaseEntSchema, Action, FieldMap, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event extends BaseEntSchema {
					fields: FieldMap = {
						name: StringType(),
						start_time: TimestampType(),
					};

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
	activityFields := activityCoreFields

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
				fields: []expectedField{
					{
						name:    "name",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "start_time",
						tsType:  "Date",
						gqlType: "Time!",
					},
				},
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

func TestFieldEdgeFields(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(
		t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(
				`import {BaseEntSchema, Action, FieldMap, StringType, UUIDType, ActionOperation} from "{schema}";

		export default class Address extends BaseEntSchema {
		fields: FieldMap = {
			Street: StringType(),
			City: StringType(),
			State: StringType(),
			ZipCode: StringType(), 
		};
	}`),
			"profile.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Action, FieldMap, ActionOperation, StringType, TimestampType, UUIDType} from "{schema}";

				export default class Profile extends BaseEntSchema {
					fields: FieldMap = {
						name: StringType(),
						addressID: UUIDType({fieldEdge: { schema: "Address", inverseEdge: "residents"}}),
					};

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
						},
					];
				};`),
		},
		base.TypeScript,
	)

	addressInfo := schema.Nodes["AddressConfig"].NodeData.ActionInfo
	require.NotNil(t, addressInfo)

	verifyExpectedActions(
		t,
		addressInfo,
		[]expectedAction{},
	)

	profileInfo := schema.Nodes["ProfileConfig"].NodeData.ActionInfo
	require.NotNil(t, profileInfo)
	verifyExpectedActions(
		t,
		profileInfo,
		[]expectedAction{
			{
				name: "CreateProfileAction",
				fields: []expectedField{
					{
						name:    "name",
						tsType:  "string",
						gqlType: "String!",
					},
					{
						name:    "addressID",
						tsType:  "ID | Builder<Address, Viewer>",
						gqlType: "ID!",
					},
				},
			},
		},
	)
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
			require.Len(t, customInterfaces, len(expAction.customInterfaces))

			for idx, customInt := range customInterfaces {
				expCustomInt := expAction.customInterfaces[idx]

				assert.Equal(t, customInt.TSType, expCustomInt.tsType)
				assert.Equal(t, customInt.GQLName, expCustomInt.gqlType)

				verifyFields(t, customInt.Fields, expCustomInt.fields)
				verifyNonEntFields(t, customInt.NonEntFields, expCustomInt.nonEntFields)

				if expCustomInt.actionName == "" {
					assert.Nil(t, customInt.Action)
				} else {
					action := customInt.Action.(action.Action)
					assert.Equal(t, expCustomInt.actionName, action.GetActionName())
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
		require.Equal(t, expField.tsType, field.TsBuilderType(&codegenapi.DummyConfig{}), "fieldname %s not equal", field.FieldName)
	}
}

func verifyNonEntFields(t *testing.T, nonEntFields []*field.NonEntField, expFields []actionOnlyField) {
	require.Equal(t, len(expFields), len(nonEntFields), "length of fields")

	for idx, nonEntField := range nonEntFields {
		actionOnlyField := expFields[idx]
		fieldName := nonEntField.GetFieldName()
		require.Equal(t, actionOnlyField.name, fieldName, "name %s not equal. idx %d", fieldName, idx)
		require.Equal(t, actionOnlyField.nullable, nonEntField.Nullable(), "fieldname %s not equal. idx %d", fieldName, idx)
		require.Equal(t, actionOnlyField.typ.graphqlType, nonEntField.GetFieldType().GetGraphQLType(), "graphql type %s not equal. idx %d", fieldName, idx)
		require.Equal(t, actionOnlyField.typ.tsType, nonEntField.GetGraphQLFieldType().GetTSType(), "ts type %s not equal. idx %d", fieldName, idx)
	}
}
