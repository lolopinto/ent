package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnumTable(t *testing.T) {
	testCases := map[string]testCase{
		"enum table": {
			code: map[string]string{
				"role.ts": getCodeWithSchema(`
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class Role implements Schema {
					fields: FieldMap = {
						role: StringType({
							primaryKey: true,
						}),
					};

					enumTable = true;

					dbRows = [
						{
							role: 'admin',
						},
						{
							role: 'member',
						},
						{
							role: 'archived_member',
						},
						{
							role: 'super_admin',
						},
						{
							role: 'owner',
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Role": {
					fields: []field{
						{
							name:       "role",
							dbType:     input.String,
							primaryKey: true,
						},
					},
					enumTable: true,
					dbRows: []map[string]interface{}{
						{
							"role": "admin",
						},
						{
							"role": "member",
						},
						{
							"role": "archived_member",
						},
						{
							"role": "super_admin",
						},
						{
							"role": "owner",
						},
					},
				},
			},
		},
		"enum table with other fields": {
			code: map[string]string{
				"role.ts": getCodeWithSchema(`
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class Role implements Schema {
					fields: FieldMap = {
						role: StringType({
							primaryKey: true,
						}),
						description: StringType(),
					};

					enumTable = true;

					dbRows = [
						{
							role: 'admin',
							description: "Admin",
						},
						{
							role: 'member',
							description: "Member",
						},
						{
							role: 'archived_member',
							description: "Archived Member",
						},
						{
							role: 'super_admin',
							description: "Super Admin",
						},
						{
							role: 'owner',
							description: "Owner",
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Role": {
					fields: []field{
						{
							name:       "role",
							dbType:     input.String,
							primaryKey: true,
						},
						{
							name:   "description",
							dbType: input.String,
						},
					},
					enumTable: true,
					dbRows: []map[string]interface{}{
						{
							"role":        "admin",
							"description": "Admin",
						},
						{
							"role":        "member",
							"description": "Member",
						},
						{
							"role":        "archived_member",
							"description": "Archived Member",
						},
						{
							"role":        "super_admin",
							"description": "Super Admin",
						},
						{
							"role":        "owner",
							"description": "Owner",
						},
					},
				},
			},
		},
	}

	runTestCases(t, testCases)
}

func TestEnumTypes(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType: input.StringEnum,
		},
	}
	validateEnumNames(t, f, "ItemRole", "ItemRole")
}

func TestEnumTypesTSTypeGiven(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType: input.StringEnum,
			Type:   "ItemCustomRole",
		},
	}
	validateEnumNames(t, f, "ItemCustomRole", "ItemRole")
}

func TestEnumTypesGraphQLTypeGiven(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType:      input.StringEnum,
			GraphQLType: "ItemCustomRole",
		},
	}
	validateEnumNames(t, f, "ItemRole", "ItemCustomRole")
}

func TestEnumTypesCustomTypesGiven(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType:      input.StringEnum,
			Type:        "ItemCustomRole",
			GraphQLType: "ItemCustomRole",
		},
	}
	validateEnumNames(t, f, "ItemCustomRole", "ItemCustomRole")
}

func TestIntEnumTypes(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType: input.IntEnum,
		},
	}
	validateEnumNames(t, f, "ItemRole", "ItemRole")
}

func TestIntEnumTypesTSTypeGiven(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType: input.IntEnum,
			Type:   "ItemCustomRole",
		},
	}
	validateEnumNames(t, f, "ItemCustomRole", "ItemRole")
}

func TestIntEnumTypesGraphQLTypeGiven(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType:      input.IntEnum,
			GraphQLType: "ItemCustomRole",
		},
	}
	validateEnumNames(t, f, "ItemRole", "ItemCustomRole")
}

func TestIntEnumTypesCustomTypesGiven(t *testing.T) {
	f := &input.Field{
		Name: "role",
		Type: &input.FieldType{
			DBType:      input.IntEnum,
			Type:        "ItemCustomRole",
			GraphQLType: "ItemCustomRole",
		},
	}
	validateEnumNames(t, f, "ItemCustomRole", "ItemCustomRole")
}

func validateEnumNames(t *testing.T, f *input.Field, tsName, graphqlName string) {
	entType, err := f.GetEntType("Item")
	require.Nil(t, err)
	enumType, ok := enttype.GetEnumType(entType)
	require.True(t, ok)
	assert.Equal(t, enumType.GetTSName(), tsName)
	assert.Equal(t, enumType.GetGraphQLName(), graphqlName)
}
