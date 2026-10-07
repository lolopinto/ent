package graphql

import (
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/require"
)

func TestNestedUnionInputConvertsSelectedMemberBeforeFlattening(t *testing.T) {
	s := testhelper.ParseSchemaForTest(t, map[string]string{
		"holiday_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema, StringType} from "{schema}"; export default new EntSchema({fields:{name:StringType()}});`),
		"settings_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema, ActionOperation, StructType, UnionType, UUIDType, StringType} from "{schema}";
  export default new EntSchema({fields:{nested:StructType({tsType:"Nested", nullable:true, fields:{choice:UnionType({tsType:"Choice", nullable:true, fields:{holiday:StructType({tsType:"HolidayChoice", fields:{holidayId:UUIDType({graphQLIDType:"Holiday"})}}), other:StructType({tsType:"OtherChoice", fields:{name:StringType(), rawId:UUIDType({disableBase64Encode:true})}})}})}})}, actions:[{operation:ActionOperation.Create}]});`),
	})
	for _, disabled := range []bool{false, true} {
		p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true, DisableBase64Encoding: disabled})
		require.NoError(t, err)
		n := s.Nodes["Settings"].NodeData
		cfg, err := buildActionFieldConfig(p, n, n.ActionInfo.GetByName("CreateSettingsAction"))
		require.NoError(t, err)
		contents := strings.Join(cfg.FunctionContents, "\n")
		require.NotContains(t, contents, "input = transformUnionTypes(")
		require.Contains(t, contents, "transformUnionInput(")
		require.Contains(t, contents, `"holiday": (v: any) =>`)
		require.Contains(t, contents, `"other": (v: any) => v`)
		require.NotContains(t, contents, "mustDecodeIDFromGQLID(v.rawId")
		if disabled {
			require.NotContains(t, contents, "mustDecodeIDFromGQLID")
		} else {
			require.Contains(t, contents, "holidayId: mustDecodeIDFromGQLID(v.holidayId.toString())")
		}
	}
}

func TestNestedObjectListInputPreservesNullableContents(t *testing.T) {
	for _, nullable := range []string{"contents", "contentsAndList"} {
		t.Run(nullable, func(t *testing.T) {
			s := testhelper.ParseSchemaForTest(t, map[string]string{
				"registration_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema, ActionOperation, UUIDType} from "{schema}"; export default new EntSchema({fields:{registryId:UUIDType()},actions:[{operation:ActionOperation.Create}]});`),
				"batch_schema.ts":        testhelper.GetCodeWithSchema(`import {EntSchema, ActionOperation, StringType} from "{schema}"; export default new EntSchema({fields:{name:StringType()},actions:[{operation:ActionOperation.Create, actionOnlyFields:[{name:"registrations",type:"Object",list:true,nullable:"` + nullable + `",actionName:"CreateRegistrationAction"}]}]});`),
				"payment_schema.ts":      testhelper.GetCodeWithSchema(`import {EntSchema, ActionOperation, StringType} from "{schema}"; export default new EntSchema({fields:{name:StringType()},actions:[{operation:ActionOperation.Create, actionOnlyFields:[{name:"batch",type:"Object",actionName:"CreateBatchAction"}]}]});`),
			})
			p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true})
			require.NoError(t, err)
			n := s.Nodes["Payment"].NodeData
			cfg, err := buildActionFieldConfig(p, n, n.ActionInfo.GetByName("CreatePaymentAction"))
			require.NoError(t, err)
			contents := strings.Join(cfg.FunctionContents, "\n")
			require.Contains(t, contents, "v.map((item: any) => item == null ? item :")
			require.Contains(t, contents, "mustDecodeIDFromGQLID(item.registryId.toString())")
		})
	}
}

func TestNestedActionInputUsesEmbeddedActionFields(t *testing.T) {
	for _, operation := range []string{"Create", "Edit", "Delete"} {
		t.Run(operation, func(t *testing.T) {
			s := testhelper.ParseSchemaForTest(t, map[string]string{
				"registration_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema, ActionOperation, UUIDType, UUIDListType, StringType} from "{schema}"; export default new EntSchema({fields:{registryId:UUIDType(), registryIds:UUIDListType(), label:StringType()},actions:[{operation:ActionOperation.` + operation + `, ` + map[string]string{"Create": `optionalFields:["registryId","registryIds"],`}[operation] + `}]});`),
				"payment_schema.ts":      testhelper.GetCodeWithSchema(`import {EntSchema, ActionOperation, StringType} from "{schema}"; export default new EntSchema({fields:{name:StringType()},actions:[{operation:ActionOperation.Create, actionOnlyFields:[{name:"registration",type:"Object",actionName:"` + operation + `RegistrationAction"}]}]});`),
			})
			p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true})
			require.NoError(t, err)
			n := s.Nodes["Payment"].NodeData
			cfg, err := buildActionFieldConfig(p, n, n.ActionInfo.GetByName("CreatePaymentAction"))
			require.NoError(t, err)
			contents := strings.Join(cfg.FunctionContents, "\n")
			if operation != "Create" {
				require.Contains(t, contents, "id: mustDecodeIDFromGQLID(v.id.toString())")
			}
			if operation != "Delete" {
				require.Contains(t, contents, "v.registryId === undefined ? {} :")
				require.Contains(t, contents, "mustDecodeNullableIDFromGQLID(v.registryId?.toString() ?? v.registryId)")
				require.Contains(t, contents, "v.registryIds === undefined ? {} :")
				require.Contains(t, contents, "v.registryIds ? v.registryIds.map")
			}
		})
	}
}

func TestNestedStructInputDecodesOnlyEncodedReferences(t *testing.T) {
	s := testhelper.ParseSchemaForTest(t, map[string]string{
		"holiday_schema.ts":  testhelper.GetCodeWithSchema(`import {EntSchema,StringType} from "{schema}";export default new EntSchema({fields:{name:StringType()}});`),
		"secret_schema.ts":   testhelper.GetCodeWithSchema(`import {EntSchema,StringType} from "{schema}";export default new EntSchema({hideFromGraphQL:true,fields:{name:StringType()}});`),
		"settings_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema,ActionOperation,StructType,UUIDType,UUIDListType} from "{schema}";export default new EntSchema({fields:{outer:StructType({tsType:"Outer",fields:{inner:StructType({tsType:"Inner",fields:{externalId:UUIDType(),externalIds:UUIDListType(),secretId:UUIDType(),holidayId:UUIDType()}})}})},actions:[{operation:ActionOperation.Create}]});`),
	})
	p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true})
	require.NoError(t, err)
	n := s.Nodes["Settings"].NodeData
	cfg, err := buildActionFieldConfig(p, n, n.ActionInfo.GetByName("CreateSettingsAction"))
	require.NoError(t, err)
	contents := strings.Join(cfg.FunctionContents, "\n")
	require.NotContains(t, contents, "externalId:")
	require.NotContains(t, contents, "externalIds:")
	require.NotContains(t, contents, "secretId:")
	require.Contains(t, contents, "holidayId: mustDecodeIDFromGQLID(v.holidayId.toString())")
}

func TestNullableEmbeddedObjectRetainsRecursiveTypeMetadata(t *testing.T) {
	for _, operation := range []string{"Create", "Edit", "Delete"} {
		t.Run(operation, func(t *testing.T) {
			s := testhelper.ParseSchemaForTest(t, map[string]string{
				"registration_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema,ActionOperation,UUIDType} from "{schema}";export default new EntSchema({fields:{registryId:UUIDType()},actions:[{operation:ActionOperation.` + operation + `}]});`),
				"batch_schema.ts":        testhelper.GetCodeWithSchema(`import {EntSchema,ActionOperation,StringType} from "{schema}";export default new EntSchema({fields:{name:StringType()},actions:[{operation:ActionOperation.Create,actionOnlyFields:[{name:"registration",type:"Object",nullable:true,actionName:"` + operation + `RegistrationAction"}]}]});`),
				"payment_schema.ts":      testhelper.GetCodeWithSchema(`import {EntSchema,ActionOperation,StringType} from "{schema}";export default new EntSchema({fields:{name:StringType()},actions:[{operation:ActionOperation.Create,actionOnlyFields:[{name:"batch",type:"Object",actionName:"CreateBatchAction"}]}]});`),
			})
			p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true})
			require.NoError(t, err)
			n := s.Nodes["Payment"].NodeData
			cfg, err := buildActionFieldConfig(p, n, n.ActionInfo.GetByName("CreatePaymentAction"))
			require.NoError(t, err)
			contents := strings.Join(cfg.FunctionContents, "\n")
			require.Contains(t, contents, "v.registration === undefined ? {} :")
			require.Contains(t, contents, ")(v.registration)")
			if operation == "Create" {
				require.Contains(t, contents, "registryId: mustDecodeIDFromGQLID(v.registryId.toString())")
			} else {
				require.Contains(t, contents, "id: mustDecodeIDFromGQLID(v.id.toString())")
			}
		})
	}
}

func TestRecursiveStructInputsEmitRuntimeRecursion(t *testing.T) {
	for _, mutual := range []bool{false, true} {
		fields := `Tree:StructType({tsType:"Tree",fields:{holidayId:UUIDType({graphQLIDType:"Holiday"}),children:StructTypeAsList({globalType:"Tree",nullable:true})}})`
		if mutual {
			fields = `Tree:StructType({tsType:"Tree",fields:{holidayId:UUIDType({graphQLIDType:"Holiday"}),next:StructType({globalType:"Branch",nullable:true})}}),Branch:StructType({tsType:"Branch",fields:{holidayId:UUIDType({graphQLIDType:"Holiday"}),children:StructTypeAsList({globalType:"Tree",nullable:true})}})`
		}
		s := testhelper.ParseSchemaForTest(t, map[string]string{
			"holiday_schema.ts":   testhelper.GetCodeWithSchema(`import {EntSchema,StringType} from "{schema}";export default new EntSchema({fields:{name:StringType()}});`),
			"__global__schema.ts": testhelper.GetCodeWithSchema(`import {StructType,StructTypeAsList,UUIDType} from "{schema}";export default {fields:{` + fields + `}};`),
			"settings_schema.ts":  testhelper.GetCodeWithSchema(`import {EntSchema,ActionOperation,StructType} from "{schema}";export default new EntSchema({fields:{tree:StructType({globalType:"Tree"})},actions:[{operation:ActionOperation.Create}]});`),
		})
		p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true})
		require.NoError(t, err)
		n := s.Nodes["Settings"].NodeData
		cfg, err := buildActionFieldConfig(p, n, n.ActionInfo.GetByName("CreateSettingsAction"))
		require.NoError(t, err)
		contents := strings.Join(cfg.FunctionContents, "\n")
		require.Contains(t, contents, "function convertInputTree(")
		require.Contains(t, contents, "convertInputTree(v.children, true)")
		require.Less(t, len(contents), 5000)
	}
}
