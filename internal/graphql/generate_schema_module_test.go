package graphql

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/stretchr/testify/require"
)

func TestWriteSchemaFileUsesModuleFormatAwareImports(t *testing.T) {
	tests := map[string]struct {
		entConfig        string
		schemaImport     string
		unexpectedImport string
	}{
		"esm": {
			schemaImport:     `import schema from "./generated/schema.js";`,
			unexpectedImport: `from "graphql/utilities"`,
		},
		"commonjs": {
			entConfig:        "moduleFormat: commonjs\n",
			schemaImport:     `import schema from "./generated/schema";`,
			unexpectedImport: `from "./generated/schema.js"`,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.MkdirAll(filepath.Join(dir, "src", "schema"), 0o755))
			if test.entConfig != "" {
				require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte(test.entConfig), 0o644))
			}
			cfg := getConfig(t, dir)
			filePath := filepath.Join(dir, "src", "graphql", "gen_schema.ts")
			require.NoError(t, writeSchemaFile(cfg, filePath, true))

			contents, err := os.ReadFile(filePath)
			require.NoError(t, err)
			generated := string(contents)
			require.Contains(t, generated, test.schemaImport)
			require.Contains(t, generated, `import {printSchema} from "graphql";`)
			require.NotContains(t, generated, test.unexpectedImport)
		})
	}
}

func TestWriteResolverIndexUsesModuleFormatAwareExport(t *testing.T) {
	tests := map[string]struct {
		entConfig string
		expected  string
	}{
		"esm": {
			expected: `export * from "./internal.js";`,
		},
		"commonjs": {
			entConfig: "moduleFormat: commonjs\n",
			expected:  `export * from "./internal";`,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			require.NoError(t, os.MkdirAll(filepath.Join(dir, "src", "schema"), 0o755))
			if test.entConfig != "" {
				require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte(test.entConfig), 0o644))
			}
			cfg := getConfig(t, dir)
			require.NoError(t, writeGQLResolversIndexFile(&codegen.Processor{Config: cfg}))

			contents, err := os.ReadFile(filepath.Join(dir, "src", "graphql", "resolvers", "index.ts"))
			require.NoError(t, err)
			require.Contains(t, string(contents), test.expected)
		})
	}
}
