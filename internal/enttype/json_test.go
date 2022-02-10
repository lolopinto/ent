package enttype_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
)

func TestJSONType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"json": {
			&enttype.JSONType{},
			expType{
				// TODO also do sqlite everywhere here...
				db:      "postgresql.JSON",
				graphql: "JSON!",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				tsType:       "any",
				nullableType: &enttype.NullableJSONType{},
				goTypePanics: true,
				importType:   &enttype.JSONImport{},
				convertFn:    "convertJSON",
			},
			nil,
		},
		"jsonb": {
			&enttype.JSONBType{},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON!",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				tsType:       "any",
				nullableType: &enttype.NullableJSONBType{},
				goTypePanics: true,
				importType:   &enttype.JSONBImport{},
				convertFn:    "convertJSON",
			},
			nil,
		},
		"nullable json": {
			&enttype.NullableJSONType{},
			expType{
				db:      "postgresql.JSON",
				graphql: "JSON",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				// any works for null so keeping that
				tsType:          "any",
				nonNullableType: &enttype.JSONType{},
				goTypePanics:    true,
				convertFn:       "convertNullableJSON",
				importType:      &enttype.JSONImport{},
			},
			nil,
		},
		"nullable jsonb": {
			&enttype.NullableJSONBType{},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				// any works for null so keeping that
				tsType:          "any",
				nonNullableType: &enttype.JSONBType{},
				goTypePanics:    true,
				convertFn:       "convertNullableJSON",
				importType:      &enttype.JSONBImport{},
			},
			nil,
		},
		"json with import type": {
			&enttype.JSONType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "JSON!",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				tsType: "Foo",
				nullableType: &enttype.NullableJSONType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &enttype.InputImportType{
							Type: "Foo",
							Path: "path",
						},
					},
				},
				goTypePanics:  true,
				convertFn:     "convertJSON",
				tsTypeImports: []string{"Foo"},
				importType:    &enttype.JSONImport{},
			},
			nil,
		},
		"nullable json with import type": {
			&enttype.NullableJSONType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSON",
				graphql: "JSON",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				tsType: "Foo | null",
				nonNullableType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &enttype.InputImportType{
							Type: "Foo",
							Path: "path",
						},
					},
				},
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"Foo"},
				importType:    &enttype.JSONImport{},
			},
			nil,
		},
		"jsonb with import type": {
			&enttype.JSONBType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON!",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				tsType: "Foo",
				nullableType: &enttype.NullableJSONBType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &enttype.InputImportType{
							Type: "Foo",
							Path: "path",
						},
					},
				},
				goTypePanics:  true,
				convertFn:     "convertJSON",
				tsTypeImports: []string{"Foo"},
				importType:    &enttype.JSONBImport{},
			},
			nil,
		},
		"nullable jsonb with import type": {
			&enttype.NullableJSONBType{
				CommonJSONType: enttype.CommonJSONType{
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
					},
				},
			},
			expType{
				db:      "postgresql.JSONB",
				graphql: "JSON",
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLJSON",
						ImportType: enttype.GraphQLJSON,
					},
				},
				tsType: "Foo | null",
				nonNullableType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						ImportType: &enttype.InputImportType{
							Type: "Foo",
							Path: "path",
						},
					},
				},
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"Foo"},
				importType:    &enttype.JSONBImport{},
			},
			nil,
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "TypeWithSubFields",
						ImportType: enttype.CustomObject,
					},
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
				goTypePanics:  true,
				convertFn:     "convertJSON",
				tsTypeImports: []string{"TypeWithSubFields"},
				importType:    &enttype.JSONBImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "TypeWithSubFields",
						ImportType: enttype.CustomObject,
					},
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
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"TypeWithSubFields"},
				importType:    &enttype.JSONBImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "TypeWithSubFields",
						ImportType: enttype.CustomObject,
					},
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
				goTypePanics:  true,
				convertFn:     "convertJSON",
				tsTypeImports: []string{"TypeWithSubFields"},
				importType:    &enttype.JSONImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "TypeWithSubFields",
						ImportType: enttype.CustomObject,
					},
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
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"TypeWithSubFields"},
				importType:    &enttype.JSONImport{},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
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
							Name: "foo",
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "TypeWithUnionFields",
						ImportType: enttype.CustomObject,
					},
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
								Name: "foo",
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
				goTypePanics:  true,
				convertFn:     "convertJSON",
				tsTypeImports: []string{"TypeWithUnionFields"},
				importType:    &enttype.JSONBImport{},
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
						Name: "foo",
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
			nil,
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
							Name: "foo",
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "TypeWithUnionFields",
						ImportType: enttype.CustomObject,
					},
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
								Name: "foo",
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
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"TypeWithUnionFields"},
				importType:    &enttype.JSONBImport{},
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
						Name: "foo",
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
			nil,
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
							Name: "foo",
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "GraphQLNonNull",
						ImportType: enttype.GraphQL,
					},
					{
						Type:       "TypeWithUnionFields",
						ImportType: enttype.CustomObject,
					},
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
								Name: "foo",
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
				goTypePanics:  true,
				convertFn:     "convertJSON",
				tsTypeImports: []string{"TypeWithUnionFields"},
				importType:    &enttype.JSONImport{},
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
						Name: "foo",
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
			nil,
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
							Name: "foo",
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
				graphqlImports: []enttype.FileImport{
					{
						Type:       "TypeWithUnionFields",
						ImportType: enttype.CustomObject,
					},
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
								Name: "foo",
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
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"TypeWithUnionFields"},
				importType:    &enttype.JSONImport{},
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
						Name: "foo",
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
			nil,
		},
	})
}
