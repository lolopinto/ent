package graphql

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/require"
)

func TestKnownCustomScalarInfoRenderedOnlyWhenUsed(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "src", "schema"), os.ModePerm))
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "src", "graphql", "generated"), os.ModePerm))

	cfg, err := codegen.NewConfig(filepath.Join(dir, "src", "schema"), "")
	require.NoError(t, err)

	s := &gqlSchema{
		customData: &CustomData{
			CustomTypes: map[string]*CustomType{
				"GraphQLJSON": {
					Type:       "GraphQLJSON",
					ScalarInfo: &CustomScalarInfo{Name: "JSON"},
				},
				"GraphQLTime": {
					Type:       "GraphQLTime",
					ScalarInfo: &CustomScalarInfo{Name: "Time"},
				},
			},
		},
		allTypes: []typeInfo{
			{
				Obj: newObjectType(&objectType{
					Node:    "Blob",
					GQLType: "GraphQLObjectType",
					Fields: []*fieldType{
						{
							Name: "contents",
							FieldImports: []*tsimport.ImportPath{
								tsimport.NewGraphQLScalarsImportPath("GraphQLByte"),
							},
						},
					},
				}),
			},
		},
		usedCustomScalarTypes: map[string]bool{},
	}

	require.NoError(t, generateAlternateSchemaFile(&codegen.Processor{Config: cfg}, s))

	contents, err := os.ReadFile(filepath.Join(dir, "src", "graphql", "generated", "schema.gql"))
	require.NoError(t, err)

	schema := string(contents)
	require.Contains(t, schema, "contents: Byte")
	require.Contains(t, schema, "scalar Byte")
	require.Contains(t, schema, "scalar JSON")
	require.NotContains(t, schema, "scalar Time")
	require.Equal(t, 1, strings.Count(schema, "scalar Byte"))
}

func TestKnownCustomTypeFallbackImportUsesRegistry(t *testing.T) {
	s := &gqlSchema{
		customData: &CustomData{
			CustomTypes: map[string]*CustomType{},
		},
	}

	imp := s.getImportFor(&codegen.Processor{}, "Byte", false)
	require.Equal(t, tsimport.NewGraphQLScalarsImportPath("GraphQLByte"), imp)
}
