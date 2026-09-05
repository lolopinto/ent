package codegenmatrix

import (
	"database/sql"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// Exercise Go config -> Python autogen -> applied DB and generated SQL together.
func prepareExternalTables(t *testing.T, fixture fixture, appRoot string) func() {
	t.Helper()
	if !fixtureCovers(fixture, "codegen.ignore_tables") {
		return func() {}
	}
	dsn := os.Getenv("DB_CONNECTION_STRING")
	driver := "postgres"
	emptyDatabase := ""
	if fixture.Dialect == "sqlite" {
		driver = "sqlite3"
		dsn = strings.TrimPrefix(dsn, "sqlite:///")
		emptyDatabase = filepath.Join(t.TempDir(), "empty.sqlite")
	} else {
		emptyDSN := createIsolatedPostgresDatabase(t, dsn)
		emptyURL, err := url.Parse(emptyDSN)
		require.NoError(t, err)
		emptyDatabase = strings.TrimPrefix(emptyURL.Path, "/")
	}
	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	for _, stmt := range []string{
		"CREATE TABLE external_accounts (id INTEGER PRIMARY KEY)",
		"CREATE TABLE external_sessions (id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES external_accounts(id), token TEXT NOT NULL UNIQUE, CONSTRAINT session_positive CHECK (id > 0))",
		"CREATE INDEX external_session_account_idx ON external_sessions(account_id)",
		"INSERT INTO external_accounts VALUES (1)",
		"INSERT INTO external_sessions VALUES (1, 1, 'keep-me')",
	} {
		_, err := db.Exec(stmt)
		require.NoError(t, err)
	}
	if fixture.Dialect == "postgres" {
		_, err := db.Exec("CREATE SCHEMA auth; CREATE TABLE auth.sessions (id INTEGER PRIMARY KEY); INSERT INTO auth.sessions VALUES (42)")
		require.NoError(t, err)
	}
	configPath := filepath.Join(appRoot, "ent.yml")
	contents, err := os.ReadFile(configPath)
	require.NoError(t, err)
	var cfg map[string]interface{}
	require.NoError(t, yaml.Unmarshal(contents, &cfg))
	cfg["codegen"].(map[string]interface{})["databaseToCompareTo"] = emptyDatabase
	contents, err = yaml.Marshal(cfg)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(configPath, contents, fileMode))
	return func() {
		var token string
		require.NoError(t, db.QueryRow("SELECT token FROM external_sessions WHERE id = 1").Scan(&token))
		require.Equal(t, "keep-me", token)
		var indexCount int
		if fixture.Dialect == "postgres" {
			require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'external_session_account_idx'").Scan(&indexCount))
			var id int
			require.NoError(t, db.QueryRow("SELECT id FROM auth.sessions").Scan(&id))
			require.Equal(t, 42, id)
		} else {
			require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'external_session_account_idx'").Scan(&indexCount))
		}
		require.Equal(t, 1, indexCount)
		contents, err := os.ReadFile(filepath.Join(appRoot, "src/schema/schema.sql"))
		require.NoError(t, err)
		require.Contains(t, string(contents), "CREATE TABLE")
		require.NotContains(t, string(contents), "external_accounts")
		require.NotContains(t, string(contents), "external_sessions")
		require.NotContains(t, string(contents), "auth.sessions")

		// Verify the policy against an actual Go-generated FK, including the
		// ignored target's generated definition. This is read-only inspection.
		cmd := exec.Command("auto_schema", "--schema="+filepath.Join(appRoot, "src/schema"),
			"--engine="+os.Getenv("DB_CONNECTION_STRING"), "--changes",
			"--ignore_table=matrix_core_users")
		// The legacy CLI reports errors on stderr; the Go launcher treats
		// that diagnostic as failure even when the CLI exits with status 0.
		out, _ := cmd.CombinedOutput()
		require.Contains(t, string(out), "managed foreign key")
		require.Contains(t, string(out), "ignored table")
	}
}
