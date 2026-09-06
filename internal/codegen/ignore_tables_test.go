package codegen

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIgnoreTablesConfig(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "ent.yml"), []byte("codegen:\n  ignoreTables: [user, public.session, auth.*]\n"), 0600))
	cfg, err := ReadConfig(root)
	require.NoError(t, err)
	require.Equal(t, []string{"user", "public.session", "auth.*"}, cfg.Codegen.IgnoreTables)
	cloned := cfg.Clone()
	cloned.Codegen.IgnoreTables[0] = "changed"
	require.Equal(t, "user", cfg.Codegen.IgnoreTables[0])
	config := &Config{config: cfg}
	require.Equal(t, cfg.Codegen.IgnoreTables, config.IgnoreTables())
	config.IgnoreTables()[0] = "changed"
	require.Equal(t, "user", cfg.Codegen.IgnoreTables[0])
	require.Empty(t, (&Config{}).IgnoreTables())
}

func TestIgnoreTablesGrammar(t *testing.T) {
	for _, pattern := range []string{"user", "public.session", "auth.*", "some_schema.table1", "CaseSensitive", "table$"} {
		require.NoError(t, ValidateIgnoreTables([]string{pattern}))
	}
	for _, pattern := range []string{"", "*", "auth*", "public.auth_*", "auth.*.x", ".user", "auth.", " auth.user", "auth.user ", "\"auth\".user", "auth.user;drop"} {
		t.Run(pattern, func(t *testing.T) {
			root := t.TempDir()
			require.NoError(t, os.WriteFile(filepath.Join(root, "ent.yml"), []byte("codegen:\n  ignoreTables: ['"+pattern+"']\n"), 0600))
			_, err := ReadConfig(root)
			require.ErrorContains(t, err, "invalid codegen.ignoreTables")
		})
	}
}
