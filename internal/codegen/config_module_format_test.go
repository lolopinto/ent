package codegen

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseModuleFormatValue(t *testing.T) {
	tests := map[string]struct {
		input    string
		expected ModuleFormat
	}{
		"default":  {expected: ModuleFormatESM},
		"esm":      {input: "esm", expected: ModuleFormatESM},
		"commonjs": {input: "commonjs", expected: ModuleFormatCommonJS},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			actual, err := ParseModuleFormatValue(test.input)
			require.NoError(t, err)
			require.Equal(t, test.expected, actual)
		})
	}

	_, err := ParseModuleFormatValue("umd")
	require.EqualError(t, err, `invalid moduleFormat "umd". valid values: esm, commonjs`)
}

func TestModuleFormatControlsGeneratedImportPolicy(t *testing.T) {
	esm := &Config{}
	require.Equal(t, ModuleFormatESM, esm.ModuleFormat())
	require.True(t, esm.ShouldUseRelativePaths())
	require.True(t, esm.ShouldAddImportExtensions())

	commonJS := &Config{
		config: &ConfigurableConfig{
			ModuleFormat: string(ModuleFormatCommonJS),
			Codegen: &CodegenConfig{
				RelativeImports: false,
			},
		},
	}
	require.Equal(t, ModuleFormatCommonJS, commonJS.ModuleFormat())
	require.False(t, commonJS.ShouldUseRelativePaths())
	require.False(t, commonJS.ShouldAddImportExtensions())

	commonJS.config.Codegen.RelativeImports = true
	require.True(t, commonJS.ShouldUseRelativePaths())
}

func TestReadConfigValidatesAndClonesModuleFormat(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("moduleFormat: commonjs\n"), 0o644))

	cfg, err := ReadConfig(dir)
	require.NoError(t, err)
	require.Equal(t, ModuleFormatCommonJS, cfg.ModuleFormatValue())
	require.Equal(t, "commonjs", cfg.Clone().ModuleFormat)

	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("moduleFormat: system\n"), 0o644))
	_, err = ReadConfig(dir)
	require.EqualError(t, err, `invalid moduleFormat "system". valid values: esm, commonjs`)
}

func TestModuleFormatEnvironmentOverrideControlsGeneration(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("moduleFormat: esm\n"), 0o644))
	t.Setenv("ENT_MODULE_FORMAT", "commonjs")

	cfg, err := ReadConfig(dir)
	require.NoError(t, err)
	require.Equal(t, ModuleFormatCommonJS, cfg.ModuleFormatValue())
	require.Equal(t, "commonjs", cfg.ModuleFormat)
	resolved := &Config{config: cfg}
	require.Equal(t, ModuleFormatCommonJS, resolved.ModuleFormat())
	require.False(t, resolved.ShouldAddImportExtensions())

	withoutFile, err := ReadConfig(t.TempDir())
	require.NoError(t, err)
	require.Equal(t, ModuleFormatCommonJS, withoutFile.ModuleFormatValue())
}

func TestModuleFormatEnvironmentOverrideIsValidated(t *testing.T) {
	t.Setenv("ENT_MODULE_FORMAT", "umd")

	_, err := ReadConfig(t.TempDir())
	require.EqualError(t, err, `invalid moduleFormat "umd". valid values: esm, commonjs`)
}
