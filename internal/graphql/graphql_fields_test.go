package graphql

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestActionWithFieldEdgeFieldConfig(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(
		t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(
				`import {EntSchema, StringType, UUIDType, ActionOperation} from "{schema}";

		const Address = new EntSchema({
			fields: {
				Street: StringType(),
				City: StringType(),
				State: StringType(),
				ZipCode: StringType(), 
			},
		});
		export default Address;`),
			"profile.ts": testhelper.GetCodeWithSchema(`
				import {EntSchema, ActionOperation, StringType, TimestampType, UUIDType} from "{schema}";

				const Profile = new EntSchema({
					fields: {
						name: StringType(),
						addressID: UUIDType({fieldEdge: { schema: "Address", inverseEdge: "residents"}}),
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
				export default Profile`),
		},
	)
	processor, err := codegen.NewTestCodegenProcessor("src/schema", schema, &codegen.CodegenConfig{
		DisableGraphQLRoot: true,
	})
	require.Nil(t, err)

	profileCfg := schema.Nodes["Profile"]
	require.NotNil(t, profileCfg)

	createAction := profileCfg.NodeData.ActionInfo.GetByName("CreateProfileAction")
	require.NotNil(t, createAction)

	createActionCfg, err := buildActionFieldConfig(processor, profileCfg.NodeData, createAction)
	require.Nil(t, err)

	verifyFieldsOverlap(t, createAction, createActionCfg)

	editAction := profileCfg.NodeData.ActionInfo.GetByName("EditProfileAction")
	require.NotNil(t, createAction)

	editActionCfg, err := buildActionFieldConfig(processor, profileCfg.NodeData, editAction)
	require.Nil(t, err)

	verifyFieldsOverlap(t, createAction, editActionCfg)

	createNode, err := buildActionInputNode(processor, profileCfg.NodeData, createAction)
	require.Nil(t, err)
	assert.Len(t, createNode.Fields, len(createAction.GetFields())+len(createAction.GetNonEntFields()))

	editNode, err := buildActionInputNode(processor, profileCfg.NodeData, editAction)
	require.Nil(t, err)
	assert.Len(t, editNode.Fields, len(editAction.GetFields())+len(editAction.GetNonEntFields())+1)
}

func TestActionOnlyIDListFieldConfigDecodesGraphQLIDs(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(
		t,
		map[string]string{
			"payment.ts": testhelper.GetCodeWithSchema(
				`import {EntSchema, ActionOperation, IntegerType, StringType, UUIDType} from "{schema}";

				const Payment = new EntSchema({
					fields: {
						externalID: StringType(),
						amount: IntegerType(),
						entID: UUIDType(),
					},

					actions: [
						{
							operation: ActionOperation.Create,
							fields: ["externalID", "amount", "entID"],
							actionOnlyFields: [
								{
									name: "studbooks",
									type: "ID",
									list: true,
									nullable: true,
								},
								{
									name: "nullableStudbooks",
									type: "ID",
									list: true,
									nullable: "contents",
								},
							],
						},
					],
				});
				export default Payment;`),
		},
	)
	processor, err := codegen.NewTestCodegenProcessor("src/schema", schema, &codegen.CodegenConfig{
		DisableGraphQLRoot: true,
	})
	require.NoError(t, err)

	paymentCfg := schema.Nodes["Payment"]
	require.NotNil(t, paymentCfg)

	createAction := paymentCfg.NodeData.ActionInfo.GetByName("CreatePaymentAction")
	require.NotNil(t, createAction)

	createActionCfg, err := buildActionFieldConfig(processor, paymentCfg.NodeData, createAction)
	require.NoError(t, err)

	contents := strings.Join(createActionCfg.FunctionContents, "\n")
	assert.Contains(
		t,
		contents,
		"studbooks: input.studbooks ? input.studbooks.map((i:any) => mustDecodeIDFromGQLID(i.toString())) : input.studbooks,",
	)
	assert.Contains(
		t,
		contents,
		"nullableStudbooks: input.nullableStudbooks.map((i:any) => mustDecodeNullableIDFromGQLID(i?.toString() ?? i)),",
	)
	assert.Contains(t, actionConfigImportNames(createActionCfg), "mustDecodeIDFromGQLID")
	assert.Contains(t, actionConfigImportNames(createActionCfg), "mustDecodeNullableIDFromGQLID")
}

func TestActionOnlyObjectListFieldConfigDecodesNestedGraphQLIDs(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(
		t,
		map[string]string{
			"registration.ts": testhelper.GetCodeWithSchema(
				`import {EntSchema, ActionOperation, IntegerType, UUIDType} from "{schema}";

				const Registration = new EntSchema({
					fields: {
						registryID: UUIDType(),
						position: IntegerType(),
					},

					actions: [
						{
							operation: ActionOperation.Create,
							actionName: "AddRegistrationAction",
						},
					],
				});
				export default Registration;`),
			"payment.ts": testhelper.GetCodeWithSchema(
				`import {EntSchema, ActionOperation, StringType} from "{schema}";

				const Payment = new EntSchema({
					fields: {
						externalID: StringType(),
					},

					actions: [
						{
							operation: ActionOperation.Create,
							actionOnlyFields: [
								{
									name: "registrations",
									type: "Object",
									list: true,
									nullable: true,
									actionName: "AddRegistrationAction",
								},
							],
						},
					],
				});
				export default Payment;`),
		},
	)
	processor, err := codegen.NewTestCodegenProcessor("src/schema", schema, &codegen.CodegenConfig{
		DisableGraphQLRoot: true,
	})
	require.NoError(t, err)

	paymentCfg := schema.Nodes["Payment"]
	require.NotNil(t, paymentCfg)

	createAction := paymentCfg.NodeData.ActionInfo.GetByName("CreatePaymentAction")
	require.NotNil(t, createAction)

	createActionCfg, err := buildActionFieldConfig(processor, paymentCfg.NodeData, createAction)
	require.NoError(t, err)

	contents := strings.Join(createActionCfg.FunctionContents, "\n")
	assert.Contains(
		t,
		contents,
		"registrations: input.registrations ? input.registrations.map((item: any) =>  ( {...item,  registryId: mustDecodeIDFromGQLID(item.registryId.toString())} )) : input.registrations,",
	)
	assert.Contains(t, actionConfigImportNames(createActionCfg), "mustDecodeIDFromGQLID")
}

func verifyFieldsOverlap(t *testing.T, action action.Action, cfg *fieldConfig) {
	for _, f := range action.GetFields() {
		found := false
		for _, line := range cfg.FunctionContents {
			// not the best thing but just want to verify that we have foo: blah in the response
			if strings.HasPrefix(line, names.ToTsFieldName(f.FieldName)) {
				found = true
				break
			}
		}
		assert.True(t, found, "couldn't find field %s in FunctionContents", f.FieldName)
	}
}

func actionConfigImportNames(cfg *fieldConfig) []string {
	var imports []string
	for _, imp := range cfg.ArgImports {
		imports = append(imports, imp.Import)
	}
	return imports
}

func TestNestedActionInputImportsReferencedActionInput(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t, map[string]string{
		"address.ts": testhelper.GetCodeWithSchema(`
			import { EntSchema, ActionOperation, StringType } from "{schema}";
			export default new EntSchema({
				fields: { street: StringType() },
				actions: [{ operation: ActionOperation.Create }],
			});`),
		"event_activity.ts": testhelper.GetCodeWithSchema(`
			import { EntSchema, ActionOperation, StringType } from "{schema}";
			export default new EntSchema({
				fields: { name: StringType() },
				actions: [{ operation: ActionOperation.Create, actionOnlyFields: [{
					name: "address", type: "Object", nullable: true,
					actionName: "CreateAddressAction",
				}] }],
			});`),
		"event.ts": testhelper.GetCodeWithSchema(`
			import { EntSchema, ActionOperation, StringType } from "{schema}";
			export default new EntSchema({
				fields: { name: StringType() },
				actions: [{ operation: ActionOperation.Create, actionOnlyFields: [{
					name: "activities", type: "Object", list: true, nullable: true,
					actionName: "CreateEventActivityAction",
				}] }],
			});`),
	})
	processor, err := codegen.NewTestCodegenProcessor("src/schema", schema, &codegen.CodegenConfig{})
	require.NoError(t, err)
	nodeData := schema.Nodes["Event"].NodeData
	createAction := nodeData.ActionInfo.GetByName("CreateEventAction")
	nodes, err := buildActionNodes(processor, nodeData, createAction)
	require.NoError(t, err)
	fieldConfig, err := buildActionFieldConfig(processor, nodeData, createAction)
	require.NoError(t, err)
	output := filepath.Join(t.TempDir(), "event_create_type.ts")
	require.NoError(t, writeFile(processor, &gqlNode{
		FilePath: output,
		ObjData: &gqlobjectData{
			Node:        nodeData.Node,
			GQLNodes:    nodes,
			FieldConfig: fieldConfig,
			Package:     processor.Config.GetImportPackage(),
		},
	}))
	contents, err := os.ReadFile(output)
	require.NoError(t, err)
	assert.Regexp(t, `import\s*\{\s*AddressEventActivityCreateInput\s*\}\s*from\s*"src/graphql/generated/mutations/event_activity/event_activity_create_type"`, string(contents))
	assert.Contains(t, string(contents), "export const ActivityEventCreateInput")
	assert.Contains(t, string(contents), "type: AddressEventActivityCreateInput")
}
