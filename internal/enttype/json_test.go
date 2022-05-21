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
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
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
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
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
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
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
				goTypePanics: true,
				convertFn:    "convertJSON",
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONImport{},
			},
			nil,
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
				goTypePanics: true,
				convertFn:    "convertNullableJSON",
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONImport{},
			},
			nil,
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
				goTypePanics: true,
				convertFn:    "convertJSON",
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONBImport{},
			},
			nil,
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
				goTypePanics: true,
				convertFn:    "convertNullableJSON",
				tsTypeImports: []*tsimport.ImportPath{
					{
						ImportPath: "path",
						Import:     "Foo",
					},
				},
				importType: &enttype.JSONBImport{},
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
				goTypePanics: true,
				convertFn:    "convertJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
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
				goTypePanics: true,
				convertFn:    "convertNullableJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
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
				goTypePanics: true,
				convertFn:    "convertJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
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
				goTypePanics: true,
				convertFn:    "convertNullableJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
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
				goTypePanics: true,
				convertFn:    "convertJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
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
				goTypePanics: true,
				convertFn:    "convertNullableJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
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
				goTypePanics: true,
				convertFn:    "convertJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
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
				goTypePanics: true,
				convertFn:    "convertNullableJSON",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
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
			nil,
		},
	})
}
