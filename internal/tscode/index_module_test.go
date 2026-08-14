package tscode

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/stretchr/testify/require"
)

func TestWriteEntIndexFileUsesModuleFormatAwareExport(t *testing.T) {
	tests := map[string]struct {
		entConfig            string
		moduleFormatOverride string
		expected             string
	}{
		"esm": {
			expected: `export * from "./internal.js";`,
		},
		"commonjs": {
			entConfig: "moduleFormat: commonjs\n",
			expected:  `export * from "./internal";`,
		},
		"environment override": {
			entConfig:            "moduleFormat: esm\n",
			moduleFormatOverride: "commonjs",
			expected:             `export * from "./internal";`,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			if test.moduleFormatOverride != "" {
				t.Setenv("ENT_MODULE_FORMAT", test.moduleFormatOverride)
			}
			dir := t.TempDir()
			require.NoError(t, os.MkdirAll(filepath.Join(dir, "src", "schema"), 0o755))
			if test.entConfig != "" {
				require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte(test.entConfig), 0o644))
			}
			cfg, err := codegen.NewConfig(filepath.Join(dir, "src", "schema"), "")
			require.NoError(t, err)
			require.NoError(t, writeEntIndexFile(&codegen.Processor{Config: cfg}))

			contents, err := os.ReadFile(filepath.Join(dir, "src", "ent", "index.ts"))
			require.NoError(t, err)
			require.Contains(t, string(contents), test.expected)
		})
	}
}
