package codegen

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/require"
)

func TestGlobalSchemaChangeForcesWriteAll(t *testing.T) {
	tmpDir := t.TempDir()
	schemaDir := filepath.Join(tmpDir, ".ent")
	require.NoError(t, os.MkdirAll(schemaDir, 0o755))

	existingInput := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			TransformsEdges: false,
		},
	}

	b, err := json.Marshal(existingInput)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(schemaDir, "schema.json"), b, 0o644))

	currentInput := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			TransformsEdges: true,
		},
	}

	currentSchema, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, currentInput, base.TypeScript)
	require.NoError(t, err)

	cfg := &Config{
		absPathToRoot:    tmpDir,
		absPathToConfigs: tmpDir,
	}

	processor, err := NewCodegenProcessor(currentSchema, "", ProcessorConfig(cfg))
	require.NoError(t, err)
	require.True(t, processor.Config.WriteAllFiles())
}

func TestBiomeConfigPathPrefersLocalConfig(t *testing.T) {
	tmpDir := t.TempDir()
	localConfigPath := filepath.Join(tmpDir, "biome.json")
	require.NoError(
		t,
		os.WriteFile(
			localConfigPath,
			[]byte(`{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 4,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "none",
      "semicolons": "as-needed"
    }
  }
}`),
			0o644,
		),
	)

	cfg := &Config{
		absPathToRoot:    tmpDir,
		absPathToConfigs: tmpDir,
	}

	configPath, err := cfg.GetBiomeConfigPath()
	require.NoError(t, err)
	require.Equal(t, localConfigPath, configPath)
}

func TestBiomeConfigPathFallsBackToRepoDefault(t *testing.T) {
	tmpDir := t.TempDir()

	cfg := &Config{
		absPathToRoot:    tmpDir,
		absPathToConfigs: tmpDir,
	}

	configPath, err := cfg.GetBiomeConfigPath()
	require.NoError(t, err)
	require.Equal(t, util.GetAbsolutePath("../../ts/biome.json"), configPath)
}
