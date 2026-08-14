package cmd

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/require"
)

func TestGetCommandInfoDefaultsToNodeLauncher(t *testing.T) {
	dir := t.TempDir()

	info, err := GetCommandInfo(dir, false)
	require.NoError(t, err)
	require.Equal(t, "node", info.Name)
	require.Len(t, info.Args, 1)
	require.True(t, strings.HasSuffix(info.Args[0], filepath.Join("scripts", "run_tsx.js")))
	require.Equal(t, "node", info.Runtime)
	require.Equal(t, "esm", info.ModuleFormat)
	require.Contains(t, info.Env, "ENT_MODULE_FORMAT=esm")

	scriptPath := util.GetPathToScript("scripts/custom_graphql.ts", dir, false, info.Runtime)
	require.True(t, strings.Contains(scriptPath, "node_modules"))
	require.True(t, strings.HasSuffix(scriptPath, filepath.Join("scripts", "custom_graphql.js")))
}

func TestGetCommandInfoUsesBunRuntimeFromConfig(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("runtime: bun\npostgresDriver: pg\n"), 0o644))

	info, err := GetCommandInfo(dir, false)
	require.NoError(t, err)
	require.Equal(t, "bun", info.Name)
	require.Empty(t, info.Args)
	require.Equal(t, "bun", info.Runtime)
	require.Equal(t, "esm", info.ModuleFormat)
	require.Contains(t, info.Env, "ENT_RUNTIME=bun")
	require.Contains(t, info.Env, "ENT_POSTGRES_DRIVER=pg")

	scriptPath := util.GetPathToScript("scripts/custom_graphql.ts", dir, false, info.Runtime)
	require.True(t, strings.Contains(scriptPath, "node_modules"))
	require.True(t, strings.HasSuffix(scriptPath, filepath.Join("scripts", "custom_graphql.js")))
}

func TestGetPathToScriptUsesLocalSourcesWhenRequested(t *testing.T) {
	t.Setenv("LOCAL_SCRIPT_PATH", "true")

	scriptPath := util.GetPathToScript("scripts/custom_graphql.ts", t.TempDir(), false, "bun")
	require.True(t, strings.HasSuffix(scriptPath, filepath.Join("ts", "src", "scripts", "custom_graphql.ts")))
}

func TestGetPathToScriptUsesInstalledScriptsForRepoBunProjects(t *testing.T) {
	scriptPath := util.GetPathToScript("scripts/custom_graphql.ts", filepath.Join(util.GetAbsolutePath("../../"), "examples", "simple"), false, "bun")
	require.True(t, strings.Contains(scriptPath, "node_modules"))
	require.True(t, strings.HasSuffix(scriptPath, filepath.Join("scripts", "custom_graphql.js")))
}

func TestGetCommandInfoEnvOverridesConfig(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("runtime: bun\npostgresDriver: bun\nmoduleFormat: commonjs\n"), 0o644))

	t.Setenv("ENT_RUNTIME", "node")
	t.Setenv("ENT_POSTGRES_DRIVER", "pg")
	t.Setenv("ENT_MODULE_FORMAT", "esm")

	info, err := GetCommandInfo(dir, false)
	require.NoError(t, err)
	require.Equal(t, "node", info.Name)
	require.Len(t, info.Args, 1)
	require.Equal(t, "node", info.Runtime)
	require.Equal(t, "esm", info.ModuleFormat)
	require.Contains(t, info.Env, "ENT_RUNTIME=node")
	require.Contains(t, info.Env, "ENT_POSTGRES_DRIVER=pg")
	require.Contains(t, info.Env, "ENT_MODULE_FORMAT=esm")
}

func TestGetCommandInfoUsesCommonJSCompatibilityMode(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("moduleFormat: commonjs\n"), 0o644))

	info, err := GetCommandInfo(dir, false)
	require.NoError(t, err)
	require.Equal(t, "node", info.Name)
	require.Equal(t, "commonjs", info.ModuleFormat)
	require.Contains(t, info.Env, "ENT_MODULE_FORMAT=commonjs")
}

func TestGetCommandInfoRejectsInvalidEnvRuntime(t *testing.T) {
	t.Setenv("ENT_RUNTIME", "deno")

	_, err := GetCommandInfo(t.TempDir(), false)
	require.EqualError(t, err, "invalid runtime \"deno\". valid values: node, bun")
}

func TestGetCommandInfoRejectsInvalidConfigDriver(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("postgresDriver: jdbc\n"), 0o644))

	_, err := GetCommandInfo(dir, false)
	require.EqualError(t, err, "invalid postgresDriver \"jdbc\". valid values: pg, bun")
}

func TestGetCommandInfoRejectsInvalidEnvModuleFormat(t *testing.T) {
	t.Setenv("ENT_MODULE_FORMAT", "umd")

	_, err := GetCommandInfo(t.TempDir(), false)
	require.EqualError(t, err, "invalid moduleFormat \"umd\". valid values: esm, commonjs")
}

func TestGetCommandInfoRejectsInvalidConfigModuleFormat(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("moduleFormat: amd\n"), 0o644))

	_, err := GetCommandInfo(dir, false)
	require.EqualError(t, err, "invalid moduleFormat \"amd\". valid values: esm, commonjs")
}

func TestGetCommandInfoRejectsOldInstalledEntTooling(t *testing.T) {
	dir := t.TempDir()
	packageDir := filepath.Join(dir, "node_modules", "@snowtop", "ent")
	require.NoError(t, os.MkdirAll(packageDir, 0o755))
	require.NoError(t, os.WriteFile(
		filepath.Join(packageDir, "package.json"),
		[]byte(`{"name":"@snowtop/ent","version":"0.2.13"}`),
		0o644,
	))

	_, err := GetCommandInfo(dir, false)
	require.ErrorContains(t, err, "requires @snowtop/ent's native-ESM tooling contract 1")
	require.ErrorContains(t, err, "upgrade tsent and @snowtop/ent together")

	require.NoError(t, os.MkdirAll(filepath.Join(packageDir, "scripts"), 0o755))
	require.NoError(t, os.WriteFile(
		filepath.Join(packageDir, "scripts", "run_tsx.js"),
		[]byte(`import "tsx/cli";`),
		0o644,
	))

	_, err = GetCommandInfo(dir, false)
	require.ErrorContains(t, err, "requires @snowtop/ent's native-ESM tooling contract 1")

	require.NoError(t, os.WriteFile(
		filepath.Join(packageDir, "package.json"),
		[]byte(`{"name":"@snowtop/ent","version":"0.2.13","entToolingContract":1}`),
		0o644,
	))

	info, err := GetCommandInfo(dir, false)
	require.NoError(t, err)
	require.True(t, strings.HasSuffix(info.Args[0], filepath.Join("scripts", "run_tsx.js")))
}
