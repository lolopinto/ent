package graphql

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/stretchr/testify/require"
)

func TestResolverExportLineLocalUsesExportAll(t *testing.T) {
	local := getResolverExportLine("src/graphql/resolvers/custom_type", false)
	require.Equal(t, resolverExportLine{
		Path:      "src/graphql/resolvers/custom_type",
		ExportAll: true,
	}, local)

	generated := getResolverExportLine("src/graphql/generated/resolvers/custom_type", true)
	require.Equal(t, resolverExportLine{
		Path:   "src/graphql/generated/resolvers/custom_type",
		Export: "CustomType",
	}, generated)
}

func TestSearchForFilesIncludesEntIndexAndSkipsTopLevelEntFiles(t *testing.T) {
	absPath, err := filepath.Abs(".")
	require.NoError(t, err)
	dirPath, err := os.MkdirTemp(absPath, "project")
	require.NoError(t, err)
	defer os.RemoveAll(dirPath)

	require.NoError(t, os.MkdirAll(filepath.Join(dirPath, "src", "schema"), os.ModePerm))
	require.NoError(t, os.MkdirAll(filepath.Join(dirPath, "src", "ent"), os.ModePerm))
	require.NoError(t, os.MkdirAll(filepath.Join(dirPath, "src", "graphql", "resolvers"), os.ModePerm))
	require.NoError(
		t,
		os.WriteFile(
			filepath.Join(dirPath, "src", "ent", "index.ts"),
			[]byte(`export * from "./user";`),
			0644,
		),
	)
	require.NoError(
		t,
		os.WriteFile(
			filepath.Join(dirPath, "src", "ent", "user.ts"),
			[]byte(`@gqlField()`),
			0644,
		),
	)
	require.NoError(
		t,
		os.WriteFile(
			filepath.Join(dirPath, "src", "graphql", "resolvers", "custom.ts"),
			[]byte(`@gqlObjectType()`),
			0644,
		),
	)

	files := searchForFiles(&codegen.Processor{
		Schema: &schema.Schema{
			Nodes: schema.NodeMapInfo{
				"user": {
					NodeData: &schema.NodeData{
						PackageName: "user",
					},
				},
			},
		},
		Config: getConfig(t, dirPath),
	})

	require.Contains(t, files, "src/ent/index.ts")
	require.NotContains(t, files, "src/ent/user.ts")
	require.Contains(t, files, "src/graphql/resolvers/custom.ts")
}
