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
			},
			nil,
		},
	})
}
