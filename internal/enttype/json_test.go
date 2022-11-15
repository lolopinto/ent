package enttype_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
)

func TestJSONType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"json": {
			&enttype.JSONType{},
			expType{
				// TODO also do sqlite everywhere here...
				db:      "postgresql.JSON",
				graphql: "JSON!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType:           "any",
				nullableType:     &enttype.NullableJSONType{},
				importType:       &enttype.JSONImport{},
				convertSqliteFns: []string{"convertJSON"},
			},
		},
		"jsonb": {
			&enttype.JSONBType{},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType:           "any",
				nullableType:     &enttype.NullableJSONBType{},
				importType:       &enttype.JSONBImport{},
				convertSqliteFns: []string{"convertJSON"},
			},
		},
		"nullable json": {
			&enttype.NullableJSONType{},
			expType{
				db:      "postgresql.JSON",
				graphql: "JSON",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				// any works for null so keeping that
				tsType:           "any",
				nonNullableType:  &enttype.JSONType{},
				convertSqliteFns: []string{"convertNullableJSON"},
				importType:       &enttype.JSONImport{},
			},
		},
		"nullable jsonb": {
			&enttype.NullableJSONBType{},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				// any works for null so keeping that
				tsType:           "any",
				nonNullableType:  &enttype.JSONBType{},
				convertSqliteFns: []string{"convertNullableJSON"},
				importType:       &enttype.JSONBImport{},
			},
		},
		"json with import type": {
			&enttype.JSONType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &tsimport.ImportPath{
						Import:     "Foo",
						ImportPath: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "JSON!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "Foo",
				nullableType: &enttype.NullableJSONType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &tsimport.ImportPath{
							Import:     "Foo",
							ImportPath: "path",
						},
					},
				},
				convertSqliteFns: []string{"convertJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONImport{},
			},
		},
		"nullable json with import type": {
			&enttype.NullableJSONType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &tsimport.ImportPath{
						Import:     "Foo",
						ImportPath: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "JSON",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "Foo | null",
				nonNullableType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &tsimport.ImportPath{
							Import:     "Foo",
							ImportPath: "path",
						},
					},
				},
				convertSqliteFns: []string{"convertNullableJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONImport{},
			},
		},
		"jsonb with import type": {
			&enttype.JSONBType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &tsimport.ImportPath{
						Import:     "Foo",
						ImportPath: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "Foo",
				nullableType: &enttype.NullableJSONBType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &tsimport.ImportPath{
							Import:     "Foo",
							ImportPath: "path",
						},
					},
				},
				convertSqliteFns: []string{"convertJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONBImport{},
			},
		},
		"nullable jsonb with import type": {
			&enttype.NullableJSONBType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &tsimport.ImportPath{
						Import:     "Foo",
						ImportPath: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "Foo | null",
				nonNullableType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &tsimport.ImportPath{
							Import:     "Foo",
							ImportPath: "path",
						},
					},
				},
				convertSqliteFns: []string{"convertNullableJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONBImport{},
			},
		},
		"jsonb with sub fields": {
			&enttype.JSONBType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithSubFields",
					CustomGraphQLInterface: "TypeWithSubFields",
					SubFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType: input.String,
							},
							Name: "string",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "TypeWithSubFields!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields",
				nullableType: &enttype.NullableJSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
				},
				importType: &enttype.JSONBImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
		},
		"nullable jsonb with sub fields": {
			&enttype.NullableJSONBType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithSubFields",
					CustomGraphQLInterface: "TypeWithSubFields",
					SubFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType: input.String,
							},
							Name: "string",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "TypeWithSubFields",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields | null",
				nonNullableType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertNullableJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
				},
				importType: &enttype.JSONBImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
		},
		"json with sub fields": {
			&enttype.JSONType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithSubFields",
					CustomGraphQLInterface: "TypeWithSubFields",
					SubFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType: input.String,
							},
							Name: "string",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "TypeWithSubFields!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields",
				nullableType: &enttype.NullableJSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
				},
				importType: &enttype.JSONImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
		},
		"nullable json with sub fields": {
			&enttype.NullableJSONType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithSubFields",
					CustomGraphQLInterface: "TypeWithSubFields",
					SubFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType: input.String,
							},
							Name: "string",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "TypeWithSubFields",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields | null",
				nonNullableType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertNullableJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
				},
				importType: &enttype.JSONImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
		},
		"jsonb with union fields": {
			&enttype.JSONBType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithUnionFields",
					CustomGraphQLInterface: "TypeWithUnionFields",
					UnionFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType:      input.JSONB,
								Type:        "UnionField",
								GraphQLType: "UnionField",
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "Foo",
						},
						{
							Type: &input.FieldType{
								DBType: input.JSONB,
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "bar",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "TypeWithUnionFields!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields",
				nullableType: &enttype.NullableJSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSONB,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "Foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSONB,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
				},
				importType: &enttype.JSONBImport{},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.JSONB,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "Foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSONB,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
		},
		"nullable jsonb with union fields": {
			&enttype.NullableJSONBType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithUnionFields",
					CustomGraphQLInterface: "TypeWithUnionFields",
					UnionFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType:      input.JSONB,
								Type:        "UnionField",
								GraphQLType: "UnionField",
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "Foo",
						},
						{
							Type: &input.FieldType{
								DBType: input.JSONB,
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "bar",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "TypeWithUnionFields",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields | null",
				nonNullableType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSONB,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "Foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSONB,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertNullableJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
				},
				importType: &enttype.JSONBImport{},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UnionField",
							GraphQLType: "UnionField",
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "Foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSONB,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
		},
		"json with union fields": {
			&enttype.JSONType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithUnionFields",
					CustomGraphQLInterface: "TypeWithUnionFields",
					UnionFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType:      input.JSON,
								Type:        "UnionField",
								GraphQLType: "UnionField",
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "Foo",
						},
						{
							Type: &input.FieldType{
								DBType: input.JSON,
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "bar",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "TypeWithUnionFields!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields",
				nullableType: &enttype.NullableJSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSON,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "Foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSON,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
				},
				importType: &enttype.JSONImport{},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.JSON,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "Foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSON,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
		},
		"nullable json with union fields": {
			&enttype.NullableJSONType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "TypeWithUnionFields",
					CustomGraphQLInterface: "TypeWithUnionFields",
					UnionFields: []*input.Field{
						{
							Type: &input.FieldType{
								DBType:      input.JSON,
								Type:        "UnionField",
								GraphQLType: "UnionField",
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "Foo",
						},
						{
							Type: &input.FieldType{
								DBType: input.JSON,
								SubFields: []*input.Field{
									{
										Name: "string",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "int",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
								},
							},
							Name: "bar",
						},
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "TypeWithUnionFields",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields | null",
				nonNullableType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSON,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "Foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSON,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
				convertSqliteFns: []string{"convertNullableJSON"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
				},
				importType: &enttype.JSONImport{},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType:      input.JSON,
							Type:        "UnionField",
							GraphQLType: "UnionField",
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "Foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSON,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
		},
	})
}
