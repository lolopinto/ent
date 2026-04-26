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
	require.Equal(t, "ts-node-script", info.Name)
	require.Equal(t, "node", info.Runtime)

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
	require.Equal(t, "bun", info.Runtime)
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
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ent.yml"), []byte("runtime: bun\npostgresDriver: bun\n"), 0o644))

	t.Setenv("ENT_RUNTIME", "node")
	t.Setenv("ENT_POSTGRES_DRIVER", "pg")

	info, err := GetCommandInfo(dir, false)
	require.NoError(t, err)
	require.Equal(t, "ts-node-script", info.Name)
	require.Equal(t, "node", info.Runtime)
	require.Contains(t, info.Env, "ENT_RUNTIME=node")
	require.Contains(t, info.Env, "ENT_POSTGRES_DRIVER=pg")
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
