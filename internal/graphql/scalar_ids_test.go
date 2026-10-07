package graphql

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/require"
)

func TestScalarReferenceMetadata(t *testing.T) {
	s := testhelper.ParseSchemaForTest(t, map[string]string{
		"holiday_schema.ts": testhelper.GetCodeWithSchema(`import {EntSchema, StringType} from "{schema}"; export default new EntSchema({fields: {name: StringType()}});`),
	})
	for _, disabled := range []bool{false, true} {
		p, err := codegen.NewTestCodegenProcessor("src/schema", s, &codegen.CodegenConfig{DisableGraphQLRoot: true, DisableBase64Encoding: disabled})
		require.NoError(t, err)
		for _, tc := range []struct {
			name, target string
			raw, list    bool
			wantErr      string
		}{
			{name: "holiday_id"}, {name: "holiday_ids", list: true},
			{name: "reference", target: "Holiday"}, {name: "reference", target: "Holiday", list: true},
			{name: "reference", target: "Holiday", raw: true},
			{name: "unmatched_id"}, {name: "reference", target: "Missing", wantErr: "unknown graphQLIDType"},
		} {
			t.Run(tc.name+tc.target, func(t *testing.T) {
				typ := &input.FieldType{DBType: input.UUID}
				if tc.list {
					typ = &input.FieldType{DBType: input.List, ListElemType: typ}
				}
				fi, err := field.NewFieldInfoFromInputs(p.Config, "Entry", []*input.Field{{Name: tc.name, Type: typ, GraphQLIDType: tc.target, DisableBase64Encode: tc.raw, Nullable: true}}, &field.Options{})
				require.NoError(t, err)
				ci := &customtype.CustomInterface{TSType: "Entry", GQLName: "Entry", Fields: fi.EntFields()}
				obj, err := buildCustomInterfaceNode(p, ci, &customInterfaceInfo{name: "Entry"})
				if tc.wantErr != "" {
					require.ErrorContains(t, err, tc.wantErr)
					return
				}
				require.NoError(t, err)
				scalar := obj.Fields[len(obj.Fields)-1]
				require.Contains(t, scalar.FieldType(), "GraphQLID")
				encoded := !disabled && !tc.raw && (tc.target != "" || tc.name == "holiday_id" || tc.name == "holiday_ids")
				if encoded {
					require.Contains(t, scalar.FunctionContents[0], `"holiday"`)
					require.Contains(t, scalar.FunctionContents[0], "encodeGQLIDReference")
				} else {
					require.Empty(t, scalar.FunctionContents)
				}
				in, err := buildCustomInterfaceNode(p, ci, &customInterfaceInfo{name: "EntryInput", input: true})
				require.NoError(t, err)
				require.Len(t, in.Fields, 1)
				require.False(t, in.Fields[0].HasResolveFunction)
			})
		}
		for _, kind := range []CustomFieldType{Field, Accessor, Function, AsyncFunction} {
			cf := CustomField{GraphQLName: "referenceId", FunctionName: "reference", GraphQLIDType: "Holiday", FieldType: kind, Results: []CustomItem{{Type: "ID", List: true, Nullable: NullableTrue}}}
			gql, err := getCustomGQLField(p, &CustomData{}, cf, &gqlSchema{}, "obj")
			require.NoError(t, err)
			if !disabled {
				require.Contains(t, gql.FunctionContents[0], "encodeGQLIDReference(await obj.reference")
				require.True(t, gql.HasAsyncModifier)
			}
			cf.GraphQLIDType = "Missing"
			_, err = getCustomGQLField(p, &CustomData{}, cf, &gqlSchema{}, "obj")
			require.ErrorContains(t, err, "unknown graphQLIDType")
			cf.GraphQLIDType = "Holiday"
			cf.Results[0].Type = "String"
			_, err = getCustomGQLField(p, &CustomData{}, cf, &gqlSchema{}, "obj")
			require.ErrorContains(t, err, "requires an ID scalar")
		}
	}
}
