package enttype_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
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
				ImportType: &enttype.InputImportType{
					Type: "Foo",
					Path: "path",
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
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
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
				ImportType: &enttype.InputImportType{
					Type: "Foo",
					Path: "path",
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
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
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
				ImportType: &enttype.InputImportType{
					Type: "Foo",
					Path: "path",
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
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
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
				ImportType: &enttype.InputImportType{
					Type: "Foo",
					Path: "path",
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
					ImportType: &enttype.InputImportType{
						Type: "Foo",
						Path: "path",
					},
				},
				goTypePanics:  true,
				convertFn:     "convertNullableJSON",
				tsTypeImports: []string{"Foo"},
				importType:    &enttype.JSONBImport{},
			},
			nil,
		},
	})
}
