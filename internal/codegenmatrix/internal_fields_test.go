package codegenmatrix

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// Exercise real generated builders and actions against a disposable SQLite DB.
// The ordinary TS test builders collect fields dynamically and cannot catch a
// field omitted by builder.tmpl.
func TestDisableUserEditableBuilderPersistence(t *testing.T) {
	repo := repoRoot(t)
	entDist := buildEntDist(t, repo)
	f := fixture{ID: "internal_fields", Path: "fixtures/internal_fields"}
	appRoot := copyFixture(t, repo, f)
	writeGeneratedHarnessFiles(t, repo, appRoot, entDist)
	t.Setenv("PATH", filepath.Join(repo, "ts", "node_modules", ".bin")+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("LOCAL_SCRIPT_PATH", "true")
	t.Setenv("GRAPHQL_PATH", filepath.Join(repo, "ts", "src", "graphql"))
	configureFixtureDatabase(t, f)
	runCodegenCycle(t, buildTsentBinary(t, repo), appRoot, f)

	cmd := exec.Command("tsc", "--noEmit", "--project", "tsconfig.generated.json")
	cmd.Dir = appRoot
	out, err := cmd.CombinedOutput()
	require.NoError(t, err, "generated action input types:\n%s", out)

	// Resolve Ent to the freshly built package, just as a generated app does.
	t.Setenv("TS_NODE_PROJECT", filepath.Join(appRoot, "tsconfig.generated.json"))
	cmd = exec.Command("node", "-r", "ts-node/register", "src/internal_fields_test.ts")
	cmd.Dir = appRoot
	out, err = cmd.CombinedOutput()
	require.NoError(t, err, "generated builder runtime regression:\n%s", out)
	t.Log(string(out))
}
