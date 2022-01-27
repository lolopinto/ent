package graphql

import (
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestActionWithFieldEdgeFieldConfig(t *testing.T) {
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
	}`),
			"profile.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Action, Field, ActionOperation, StringType, TimestampType, UUIDType} from "{schema}";

				export default class Profile extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "name"}),
						UUIDType({name: "addressID", fieldEdge: { schema: "Address", inverseEdge: "residents"}}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
						},
						{
							operation: ActionOperation.Edit,
						},
					];
				};`),
		},
		base.TypeScript,
	)
	processor, err := codegen.NewTestCodegenProcessor("src/schema", schema, &codegen.CodegenConfig{
		DisableGraphQLRoot: true,
	})
	require.Nil(t, err)

	profileCfg := schema.Nodes["ProfileConfig"]
	require.NotNil(t, profileCfg)

	createAction := profileCfg.NodeData.ActionInfo.GetByName("CreateProfileAction")
	require.NotNil(t, createAction)

	createActionCfg, err := buildActionFieldConfig(processor, profileCfg.NodeData, createAction, "Profile")
	require.Nil(t, err)

	verifyFieldsOverlap(t, createAction, createActionCfg)

	editAction := profileCfg.NodeData.ActionInfo.GetByName("EditProfileAction")
	require.NotNil(t, createAction)

	editActionCfg, err := buildActionFieldConfig(processor, profileCfg.NodeData, editAction, "Profile")
	require.Nil(t, err)

	verifyFieldsOverlap(t, createAction, editActionCfg)

	createNode := buildActionInputNode(processor, profileCfg.NodeData, createAction, "Profile")
	assert.Len(t, createNode.Fields, len(createAction.GetFields())+len(createAction.GetNonEntFields()))

	editNode := buildActionInputNode(processor, profileCfg.NodeData, editAction, "Profile")
	assert.Len(t, editNode.Fields, len(editAction.GetFields())+len(editAction.GetNonEntFields())+1)
}

func verifyFieldsOverlap(t *testing.T, action action.Action, cfg *fieldConfig) {
	for _, f := range action.GetFields() {
		found := false
		for _, line := range cfg.FunctionContents {
			// not the best thing but just want to verify that we have foo: blah in the response
			if strings.HasPrefix(line, f.FieldName) {
				found = true
				break
			}
		}
		assert.True(t, found, "couldn't find field %s in FunctionContents", f.FieldName)
	}
}
