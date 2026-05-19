package codegenmatrix

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

type catalog struct {
	Version  int       `yaml:"version"`
	Fixtures []fixture `yaml:"fixtures"`
	Features []feature `yaml:"features"`
}

type fixture struct {
	ID              string           `yaml:"id"`
	Path            string           `yaml:"path"`
	Includes        []string         `yaml:"includes"`
	Description     string           `yaml:"description"`
	Surfaces        []string         `yaml:"surfaces"`
	Dialect         string           `yaml:"dialect"`
	RuntimeVariants []runtimeVariant `yaml:"runtime_variants"`
	Covers          []string         `yaml:"covers"`
	SkipReason      string           `yaml:"skip_reason"`
}

type feature struct {
	ID              string   `yaml:"id"`
	Owns            []string `yaml:"owns"`
	Mode            string   `yaml:"mode"`
	DialectCoverage []string `yaml:"dialect_coverage"`
	Rationale       string   `yaml:"rationale"`
	SkipReason      string   `yaml:"skip_reason"`
	TestRefs        []string `yaml:"test_refs"`
}

type runtimeVariant struct {
	ID             string `yaml:"id"`
	Runtime        string `yaml:"runtime"`
	PostgresDriver string `yaml:"postgresDriver"`
}

type fixtureAssertions struct {
	Contains []fixtureContainsAssertion `yaml:"contains"`
}

type fixtureContainsAssertion struct {
	Path string `yaml:"path"`
	Text string `yaml:"text"`
}

const (
	dirMode  os.FileMode = 0o755
	fileMode os.FileMode = 0o644
)

var uuidLiteralPattern = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)

func TestFeatureCatalogClassifiesCodegenInputs(t *testing.T) {
	c := loadCatalog(t)
	repo := repoRoot(t)
	requiredOwners := map[string]bool{}
	for _, owner := range requiredOwnersList() {
		requiredOwners[owner] = true
	}

	featuresByID := map[string]feature{}
	owners := map[string]string{}
	for _, f := range c.Features {
		require.NotEmpty(t, f.ID, "feature id is required")
		require.NotEmpty(t, f.Mode, "feature %s must declare a mode", f.ID)
		if f.Mode == "skipped" {
			require.NotEmpty(t, f.SkipReason, "skipped feature %s must include skip_reason", f.ID)
		} else {
			require.NotEmpty(t, f.Rationale, "feature %s must explain why it is classified this way", f.ID)
		}
		if f.Mode == "existing_test" {
			require.NotEmpty(t, f.TestRefs, "existing_test feature %s must point at existing tests", f.ID)
		}
		require.NotContains(t, featuresByID, f.ID, "duplicate feature id")
		featuresByID[f.ID] = f
		for _, owner := range f.Owns {
			if !requiredOwners[owner] {
				t.Fatalf("feature %s claims unknown owner %s", f.ID, owner)
			}
			if existing, ok := owners[owner]; ok {
				t.Fatalf("owner %s is claimed by both %s and %s", owner, existing, f.ID)
			}
			owners[owner] = f.ID
		}
	}

	var missingOwners []string
	for _, owner := range requiredOwnersList() {
		if _, ok := owners[owner]; !ok {
			missingOwners = append(missingOwners, owner)
		}
	}
	require.Empty(t, missingOwners, "codegen input owners missing from testdata/codegen_matrix/features.yml")

	coveredFeatures := map[string]string{}
	coveredDialects := map[string]map[string]string{}
	for _, fixture := range c.Fixtures {
		require.NotEmpty(t, fixture.ID, "fixture id is required")
		require.NotEmpty(t, fixture.Path, "fixture %s must declare path", fixture.ID)
		validateFixturePaths(t, repo, fixture)
		validateFixtureDialect(t, fixture)
		validateFixtureRuntimeVariants(t, fixture)
		validateFixtureRuntimeCoverage(t, fixture)
		for _, covered := range fixture.Covers {
			if _, ok := featuresByID[covered]; !ok {
				t.Fatalf("fixture %s covers unknown feature %s", fixture.ID, covered)
			}
			coveredFeatures[covered] = fixture.ID
			if fixture.Dialect != "" {
				if coveredDialects[covered] == nil {
					coveredDialects[covered] = map[string]string{}
				}
				coveredDialects[covered][fixture.Dialect] = fixture.ID
			}
		}
	}

	var uncovered []string
	for _, f := range c.Features {
		switch f.Mode {
		case "non_codegen", "skipped", "existing_test":
			continue
		}
		if _, ok := coveredFeatures[f.ID]; !ok {
			uncovered = append(uncovered, f.ID)
		}
	}
	sort.Strings(uncovered)
	require.Empty(t, uncovered, "active features need fixture coverage")
	require.Empty(t, missingDialectCoverage(c.Features, coveredDialects), "features covered by dialect fixtures must declare matching dialect_coverage")
}

func validateFixturePaths(t *testing.T, repo string, fixture fixture) {
	t.Helper()
	matrixRoot := filepath.Join(repo, "testdata/codegen_matrix")
	require.DirExists(t, filepath.Join(matrixRoot, fixture.Path), "fixture %s path is missing", fixture.ID)
	for _, include := range fixture.Includes {
		require.DirExists(t, filepath.Join(matrixRoot, include), "fixture %s include %s is missing", fixture.ID, include)
	}
}

func validateFixtureRuntimeVariants(t *testing.T, fixture fixture) {
	t.Helper()
	seen := map[string]bool{}
	for _, variant := range runtimeVariantsForFixture(fixture) {
		require.NotEmpty(t, variant.ID, "runtime variant id is required for fixture %s", fixture.ID)
		require.False(t, seen[variant.ID], "duplicate runtime variant %s for fixture %s", variant.ID, fixture.ID)
		seen[variant.ID] = true
		require.Contains(t, validRuntimes(), variant.Runtime, "fixture %s runtime variant %s has unknown runtime", fixture.ID, variant.ID)
		require.Contains(t, validPostgresDrivers(), variant.PostgresDriver, "fixture %s runtime variant %s has unknown postgres driver", fixture.ID, variant.ID)
		if variant.PostgresDriver == "bun" {
			require.Equal(t, "bun", variant.Runtime, "fixture %s runtime variant %s cannot use Bun postgres driver outside Bun runtime", fixture.ID, variant.ID)
		}
	}
}

func validateFixtureRuntimeCoverage(t *testing.T, fixture fixture) {
	t.Helper()
	var hasBunRuntime, hasBunPostgresDriver bool
	for _, variant := range runtimeVariantsForFixture(fixture) {
		hasBunRuntime = hasBunRuntime || variant.Runtime == "bun"
		hasBunPostgresDriver = hasBunPostgresDriver || variant.PostgresDriver == "bun"
	}
	if fixtureCovers(fixture, "runtime.bun") {
		require.True(t, hasBunRuntime, "fixture %s claims runtime.bun coverage without a Bun runtime variant", fixture.ID)
	}
	if fixtureCovers(fixture, "postgres_driver.bun") {
		require.True(t, hasBunPostgresDriver, "fixture %s claims postgres_driver.bun coverage without a Bun postgres driver variant", fixture.ID)
	}
}

func fixtureCovers(fixture fixture, featureID string) bool {
	for _, covered := range fixture.Covers {
		if covered == featureID {
			return true
		}
	}
	return false
}

func validateFixtureDialect(t *testing.T, fixture fixture) {
	t.Helper()
	if fixtureRunsDBCodegen(fixture) {
		require.NotEmpty(t, fixture.Dialect, "DB fixture %s must declare dialect", fixture.ID)
	}
	if fixture.Dialect == "" {
		return
	}
	require.Contains(t, validDialects(), fixture.Dialect, "fixture %s has unknown dialect", fixture.ID)
}

func missingDialectCoverage(features []feature, coveredDialects map[string]map[string]string) []string {
	var missing []string
	for _, f := range features {
		switch f.Mode {
		case "non_codegen", "skipped", "existing_test":
			continue
		}
		actual := coveredDialects[f.ID]
		if len(actual) == 0 && len(f.DialectCoverage) == 0 {
			continue
		}
		declared := map[string]bool{}
		for _, dialect := range f.DialectCoverage {
			if !validDialects()[dialect] {
				missing = append(missing, fmt.Sprintf("%s declares unknown dialect %s", f.ID, dialect))
				continue
			}
			declared[dialect] = true
			if actual[dialect] == "" {
				missing = append(missing, fmt.Sprintf("%s missing %s fixture coverage", f.ID, dialect))
			}
		}
		for dialect := range actual {
			if !declared[dialect] {
				missing = append(missing, fmt.Sprintf("%s covered by %s fixture but missing dialect_coverage entry", f.ID, dialect))
			}
		}
	}
	sort.Strings(missing)
	return missing
}

func validDialects() map[string]bool {
	return map[string]bool{
		"sqlite":   true,
		"postgres": true,
	}
}

func validRuntimes() map[string]bool {
	return map[string]bool{
		"node": true,
		"bun":  true,
	}
}

func validPostgresDrivers() map[string]bool {
	return map[string]bool{
		"pg":  true,
		"bun": true,
	}
}

func TestCodegenMatrixFixtures(t *testing.T) {
	c := loadCatalog(t)
	repo := repoRoot(t)
	entDist := buildEntDist(t, repo)
	fixtureFilter := os.Getenv("ENT_CODEGEN_MATRIX_FIXTURE")
	runtimeFilter := os.Getenv("ENT_CODEGEN_MATRIX_RUNTIME")

	for _, fixture := range c.Fixtures {
		fixture := fixture
		if fixtureFilter != "" && fixtureFilter != fixture.ID {
			continue
		}
		t.Run(fixture.ID, func(t *testing.T) {
			if fixture.SkipReason != "" && os.Getenv("ENT_CODEGEN_MATRIX_RUN_SKIPPED") != "true" {
				t.Skip(fixture.SkipReason)
			}
			for _, variant := range runtimeVariantsForFixture(fixture) {
				variant := variant
				if runtimeFilter != "" && runtimeFilter != variant.ID && runtimeFilter != variant.Runtime {
					continue
				}
				t.Run(variant.ID, func(t *testing.T) {
					appRoot := copyFixture(t, repo, fixture)
					writeGeneratedHarnessFiles(t, repo, appRoot, entDist)
					applyRuntimeVariantConfig(t, appRoot, variant)
					runCodegenFixture(t, repo, appRoot, fixture)
				})
			}
		})
	}
}

func loadCatalog(t *testing.T) catalog {
	t.Helper()
	repo := repoRoot(t)
	path := filepath.Join(repo, "testdata/codegen_matrix/features.yml")
	b, err := os.ReadFile(path)
	require.NoError(t, err)

	var c catalog
	require.NoError(t, yaml.Unmarshal(b, &c))
	require.Equal(t, 1, c.Version)
	require.NotEmpty(t, c.Features)
	require.NotEmpty(t, c.Fixtures)
	return c
}

func repoRoot(t *testing.T) string {
	t.Helper()
	return repoRootFromSource()
}

func repoRootFromSource() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		panic("could not resolve codegenmatrix source path")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func copyFixture(t *testing.T, repo string, fixture fixture) string {
	t.Helper()
	dst := filepath.Join(t.TempDir(), fixture.ID)
	for _, include := range fixture.Includes {
		require.NoError(t, copyDir(filepath.Join(repo, "testdata/codegen_matrix", include), dst), "copy include %s", include)
	}
	src := filepath.Join(repo, "testdata/codegen_matrix", fixture.Path)
	require.NoError(t, copyDir(src, dst))
	return dst
}

func runtimeVariantsForFixture(fixture fixture) []runtimeVariant {
	if len(fixture.RuntimeVariants) > 0 {
		var variants []runtimeVariant
		for _, variant := range fixture.RuntimeVariants {
			variants = append(variants, normalizeRuntimeVariant(variant))
		}
		return variants
	}
	return []runtimeVariant{defaultRuntimeVariant()}
}

func normalizeRuntimeVariant(variant runtimeVariant) runtimeVariant {
	if variant.Runtime == "" {
		variant.Runtime = "node"
	}
	if variant.PostgresDriver == "" {
		variant.PostgresDriver = "pg"
	}
	return variant
}

func defaultRuntimeVariant() runtimeVariant {
	return runtimeVariant{
		ID:             "node_pg",
		Runtime:        "node",
		PostgresDriver: "pg",
	}
}

func applyRuntimeVariantConfig(t *testing.T, appRoot string, variant runtimeVariant) {
	t.Helper()
	path := filepath.Join(appRoot, "ent.yml")
	b, err := os.ReadFile(path)
	require.NoError(t, err)
	cfg := map[string]any{}
	if len(bytes.TrimSpace(b)) > 0 {
		require.NoError(t, yaml.Unmarshal(b, &cfg))
	}
	cfg["runtime"] = variant.Runtime
	cfg["postgresDriver"] = variant.PostgresDriver
	out, err := yaml.Marshal(cfg)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, out, fileMode))
}

func writeGeneratedHarnessFiles(t *testing.T, repo, appRoot, entDist string) {
	t.Helper()
	nodeModules := filepath.Join(appRoot, "node_modules")
	if _, err := os.Lstat(nodeModules); err == nil {
		require.NoError(t, os.RemoveAll(nodeModules))
	}
	linkHarnessNodeModules(t, filepath.Join(repo, "ts", "node_modules"), nodeModules, entDist)

	writeHarnessTSConfig(t, filepath.Join(appRoot, "tsconfig.json"), entPathMapping{
		packageRoot:     filepath.Join(repo, "ts", "src", "index.ts"),
		packageWildcard: filepath.Join(repo, "ts", "src", "*"),
	})
	writeHarnessTSConfig(t, filepath.Join(appRoot, "tsconfig.generated.json"), entPathMapping{
		packageRoot:     filepath.Join(entDist, "index.d.ts"),
		packageWildcard: filepath.Join(entDist, "*"),
	})
	replaceHarnessPlaceholders(t, appRoot)
}

func linkHarnessNodeModules(t *testing.T, sourceNodeModules, targetNodeModules, entDist string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(targetNodeModules, dirMode))
	entries, err := os.ReadDir(sourceNodeModules)
	require.NoError(t, err)
	for _, entry := range entries {
		if entry.Name() == "@snowtop" {
			linkHarnessSnowtopModules(t, filepath.Join(sourceNodeModules, entry.Name()), filepath.Join(targetNodeModules, entry.Name()), entDist)
			continue
		}
		require.NoError(t, os.Symlink(
			filepath.Join(sourceNodeModules, entry.Name()),
			filepath.Join(targetNodeModules, entry.Name()),
		))
	}
	snowtopDir := filepath.Join(targetNodeModules, "@snowtop")
	require.NoError(t, os.MkdirAll(snowtopDir, dirMode))
	ensureSnowtopEntLink(t, snowtopDir, entDist)
}

func linkHarnessSnowtopModules(t *testing.T, sourceSnowtop, targetSnowtop, entDist string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(targetSnowtop, dirMode))
	entries, err := os.ReadDir(sourceSnowtop)
	require.NoError(t, err)
	for _, entry := range entries {
		if entry.Name() == "ent" {
			continue
		}
		require.NoError(t, os.Symlink(
			filepath.Join(sourceSnowtop, entry.Name()),
			filepath.Join(targetSnowtop, entry.Name()),
		))
	}
	ensureSnowtopEntLink(t, targetSnowtop, entDist)
}

func ensureSnowtopEntLink(t *testing.T, snowtopDir, entDist string) {
	t.Helper()
	entLink := filepath.Join(snowtopDir, "ent")
	if _, err := os.Lstat(entLink); err == nil {
		require.NoError(t, os.RemoveAll(entLink))
	}
	require.NoError(t, os.Symlink(entDist, entLink))
}

type entPathMapping struct {
	packageRoot     string
	packageWildcard string
}

func writeHarnessTSConfig(t *testing.T, path string, entPaths entPathMapping) {
	t.Helper()
	// tsconfig.json maps to source for schema loading; tsconfig.generated.json
	// maps to dist declarations to typecheck generated code like a package user.
	tsconfig := fmt.Sprintf(`{
  "compilerOptions": {
    "lib": ["es2018", "esnext.asynciterable"],
    "target": "es2020",
    "module": "commonjs",
    "downlevelIteration": true,
    "baseUrl": ".",
    "paths": {
      "src/*": ["src/*"],
      "@snowtop/ent": [%q],
      "@snowtop/ent/*": [%q]
    },
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": false,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`, entPaths.packageRoot, entPaths.packageWildcard)
	require.NoError(t, os.WriteFile(path, []byte(tsconfig), fileMode))
}

func replaceHarnessPlaceholders(t *testing.T, appRoot string) {
	t.Helper()
	replacements := map[string]string{
		"__APP_ROOT__": appRoot,
	}
	for _, relPath := range []string{"ent.yml", filepath.Join("src", "schema", "custom_graphql.json")} {
		path := filepath.Join(appRoot, relPath)
		b, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		updated := string(b)
		for from, to := range replacements {
			updated = strings.ReplaceAll(updated, from, to)
		}
		require.NoError(t, os.WriteFile(path, []byte(updated), fileMode))
	}
}

func postgresDatabaseName(t *testing.T) string {
	t.Helper()
	hash := sha256.Sum256([]byte(t.Name()))
	return fmt.Sprintf("codegen_matrix_%s", hex.EncodeToString(hash[:])[:16])
}

func buildEntDist(t *testing.T, repo string) string {
	t.Helper()
	cmd := exec.Command("npm", "run", "prepare-code")
	cmd.Dir = filepath.Join(repo, "ts")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("failed to build @snowtop/ent dist:\n%s\n%v", string(out), err)
	}
	return filepath.Join(repo, "ts", "dist")
}

func runCodegenFixture(t *testing.T, repo, appRoot string, fixture fixture) {
	t.Helper()
	envPath := filepath.Join(repo, "ts", "node_modules", ".bin") + string(os.PathListSeparator) + os.Getenv("PATH")
	t.Setenv("PATH", envPath)
	t.Setenv("LOCAL_SCRIPT_PATH", "true")
	t.Setenv("GRAPHQL_PATH", filepath.Join(repo, "ts", "src", "graphql"))
	configureFixtureDatabase(t, fixture)
	tsentBinary := buildTsentBinary(t, repo)

	// The first pass bootstraps generated files and build metadata. The second
	// pass gives codegen one clean stabilization pass before the idempotence
	// snapshot, and the third pass is the actual no-churn assertion.
	runCodegenCycle(t, tsentBinary, appRoot, fixture)
	runCodegenCycle(t, tsentBinary, appRoot, fixture)
	firstSnapshot := snapshotGeneratedTree(t, appRoot, fixture)
	firstHash := hashGeneratedSnapshot(firstSnapshot)
	runCodegenCycle(t, tsentBinary, appRoot, fixture)
	secondSnapshot := snapshotGeneratedTree(t, appRoot, fixture)
	secondHash := hashGeneratedSnapshot(secondSnapshot)
	require.Equal(t, firstHash, secondHash, "codegen fixture is not idempotent; changed files: %s\n%s", strings.Join(changedSnapshotFiles(firstSnapshot, secondSnapshot), ", "), snapshotChangeSummary(firstSnapshot, secondSnapshot))

	runFixtureGeneratedAssertions(t, appRoot)

	cmd := exec.Command(filepath.Join(repo, "ts", "node_modules", ".bin", "tsc"), "--noEmit", "--project", filepath.Join(appRoot, "tsconfig.generated.json"))
	cmd.Dir = appRoot
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated TypeScript did not compile:\n%s\n%v", string(out), err)
	}
}

func runFixtureGeneratedAssertions(t *testing.T, appRoot string) {
	t.Helper()
	path := filepath.Join(appRoot, "codegen_matrix_assertions.yml")
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return
	}
	require.NoError(t, err)

	var assertions fixtureAssertions
	require.NoError(t, yaml.Unmarshal(b, &assertions))
	for _, assertion := range assertions.Contains {
		require.NotEmpty(t, assertion.Path, "generated assertion path is required")
		require.NotEmpty(t, assertion.Text, "generated assertion text is required for %s", assertion.Path)

		target := filepath.Join(appRoot, assertion.Path)
		contents, err := os.ReadFile(target)
		require.NoError(t, err, "read generated assertion target %s", assertion.Path)
		require.Contains(t, string(contents), assertion.Text, "generated assertion failed for %s", assertion.Path)
	}
}

func configureFixtureDatabase(t *testing.T, fixture fixture) {
	t.Helper()
	if fixtureHasSurface(fixture, "postgres_db_codegen") {
		dsn := os.Getenv("ENT_CODEGEN_MATRIX_POSTGRES_URL")
		if dsn == "" {
			dsn = os.Getenv("DB_CONNECTION_STRING")
		}
		if !isPostgresDSN(dsn) {
			t.Skip("postgres fixture requires ENT_CODEGEN_MATRIX_POSTGRES_URL or a postgres DB_CONNECTION_STRING")
		}
		t.Setenv("DB_CONNECTION_STRING", createIsolatedPostgresDatabase(t, dsn))
		return
	}
	t.Setenv("DB_CONNECTION_STRING", "sqlite:///"+filepath.Join(t.TempDir(), "codegen_matrix.sqlite"))
}

func isPostgresDSN(dsn string) bool {
	return strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://")
}

func createIsolatedPostgresDatabase(t *testing.T, dsn string) string {
	t.Helper()
	adminURL, err := url.Parse(dsn)
	require.NoError(t, err)
	if adminURL.Path == "" || adminURL.Path == "/" {
		adminURL.Path = "/postgres"
	}
	ensurePostgresSSLModeDisabled(adminURL)
	dbName := postgresDatabaseName(t)
	isolatedURL := *adminURL
	isolatedURL.Path = "/" + dbName

	adminDB, err := sql.Open("postgres", adminURL.String())
	require.NoError(t, err)
	defer adminDB.Close()
	resetPostgresDatabase(t, adminDB, dbName)

	t.Cleanup(func() {
		cleanupDB, err := sql.Open("postgres", adminURL.String())
		if err != nil {
			return
		}
		defer cleanupDB.Close()
		_, _ = cleanupDB.Exec("DROP DATABASE IF EXISTS " + pq.QuoteIdentifier(dbName) + " WITH (FORCE)")
	})

	return isolatedURL.String()
}

func ensurePostgresSSLModeDisabled(u *url.URL) {
	q := u.Query()
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "disable")
		u.RawQuery = q.Encode()
	}
}

func resetPostgresDatabase(t *testing.T, db *sql.DB, dbName string) {
	t.Helper()
	quoted := pq.QuoteIdentifier(dbName)
	_, err := db.Exec("DROP DATABASE IF EXISTS " + quoted + " WITH (FORCE)")
	require.NoError(t, err)
	_, err = db.Exec("CREATE DATABASE " + quoted)
	require.NoError(t, err)
}

func buildTsentBinary(t *testing.T, repo string) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "tsent")
	cmd := exec.Command("go", "build", "-o", bin, "./tsent")
	cmd.Dir = repo
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("failed to build tsent:\n%s\n%v", string(out), err)
	}
	return bin
}

func runCodegenCycle(t *testing.T, tsentBinary, appRoot string, fixture fixture) {
	t.Helper()
	if fixtureRunsDBCodegen(fixture) {
		runCodegenStep(t, tsentBinary, appRoot, "db")
	}
	runCodegenStep(t, tsentBinary, appRoot, "codegen")
	runCodegenStep(t, tsentBinary, appRoot, "graphql")
}

func fixtureRunsDBCodegen(fixture fixture) bool {
	return fixtureHasSurface(fixture, "db_codegen") || fixtureHasSurface(fixture, "postgres_db_codegen")
}

func fixtureHasSurface(fixture fixture, surface string) bool {
	for _, candidate := range fixture.Surfaces {
		if candidate == surface {
			return true
		}
	}
	return false
}

func runCodegenStep(t *testing.T, tsentBinary, appRoot, step string) {
	t.Helper()
	cmd := exec.Command(
		tsentBinary,
		"codegen",
		"--disable_upgrade",
		"--disable_prompts",
		"--step",
		step,
	)
	cmd.Dir = appRoot
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("codegen step %s failed:\n%s\n%v", step, string(out), err)
	}
}

func snapshotGeneratedTree(t *testing.T, appRoot string, fixture fixture) map[string][]byte {
	t.Helper()
	var paths []string
	roots := []string{
		filepath.Join(appRoot, ".ent"),
		filepath.Join(appRoot, "src", "ent"),
		filepath.Join(appRoot, "src", "graphql"),
	}
	if fixtureRunsDBCodegen(fixture) {
		roots = append(roots,
			filepath.Join(appRoot, "src", "schema", "schema.py"),
			filepath.Join(appRoot, "src", "schema", ".ent"),
			filepath.Join(appRoot, "src", "schema", "versions"),
		)
	}
	for _, root := range roots {
		if _, err := os.Stat(root); err != nil {
			continue
		}
		info, err := os.Stat(root)
		require.NoError(t, err)
		if !info.IsDir() {
			paths = append(paths, root)
			continue
		}
		require.NoError(t, filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() && d.Name() == "__pycache__" {
				return filepath.SkipDir
			}
			if d.IsDir() {
				return nil
			}
			if strings.HasSuffix(path, ".pyc") {
				return nil
			}
			paths = append(paths, path)
			return nil
		}))
	}
	sort.Strings(paths)
	snapshot := map[string][]byte{}
	for _, path := range paths {
		rel, err := filepath.Rel(appRoot, path)
		require.NoError(t, err)
		if rel == ".ent/build_info.yaml" {
			continue
		}
		b, err := os.ReadFile(path)
		require.NoError(t, err)
		// Generated migration metadata can contain UUID literals; normalize them
		// so idempotence assertions focus on structural churn.
		b = uuidLiteralPattern.ReplaceAll(b, []byte("<uuid>"))
		b = bytes.TrimRight(b, "\r\n")
		snapshot[rel] = b
	}
	return snapshot
}

func hashGeneratedSnapshot(snapshot map[string][]byte) string {
	h := sha256.New()
	var paths []string
	for path := range snapshot {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	for _, path := range paths {
		h.Write([]byte(path))
		h.Write([]byte{0})
		h.Write(snapshot[path])
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

func changedSnapshotFiles(first, second map[string][]byte) []string {
	files := map[string]bool{}
	for path := range first {
		files[path] = true
	}
	for path := range second {
		files[path] = true
	}
	var changed []string
	for path := range files {
		firstContent, firstOK := first[path]
		secondContent, secondOK := second[path]
		if firstOK != secondOK || !bytes.Equal(firstContent, secondContent) {
			changed = append(changed, path)
		}
	}
	sort.Strings(changed)
	return changed
}

func snapshotChangeSummary(first, second map[string][]byte) string {
	var summaries []string
	for _, path := range changedSnapshotFiles(first, second) {
		firstLines := strings.Split(string(first[path]), "\n")
		secondLines := strings.Split(string(second[path]), "\n")
		max := len(firstLines)
		if len(secondLines) > max {
			max = len(secondLines)
		}
		for i := 0; i < max; i++ {
			var a, b string
			if i < len(firstLines) {
				a = firstLines[i]
			}
			if i < len(secondLines) {
				b = secondLines[i]
			}
			if a != b {
				summaries = append(summaries, fmt.Sprintf("%s:%d\n- %s\n+ %s", path, i+1, a, b))
				break
			}
		}
	}
	return strings.Join(summaries, "\n")
}

func copyDir(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, dirMode)
		}
		return copyFile(path, target)
	})
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), dirMode); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, fileMode)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func requiredOwnersList() []string {
	return mergeOwners(derivedOwnersList(), syntheticOwners())
}

func derivedOwnersList() []string {
	return mergeOwners(reflectedInputOwners(), reflectedActionOperationOwners())
}

// Owners are coverage keys for generator inputs. Most are reflected from
// internal/schema/input/input.go; synthetic owners should be limited to
// non-reflectable codegen surfaces, not behavior/regression scenario names.
func syntheticOwners() []string {
	return []string{
		"input.ActionField.List",
		"custom_graphql.gqlField",
		"custom_graphql.gqlObjectType",
		"custom_graphql.gqlInputObjectType",
		"custom_graphql.gqlQuery",
		"custom_graphql.gqlMutation",
		"custom_graphql.gqlConnection",
		"custom_graphql.mutationReturnType",
		"codegen.prettier",
	}
}

func mergeOwners(ownerLists ...[]string) []string {
	seen := map[string]bool{}
	var owners []string
	for _, ownerList := range ownerLists {
		for _, owner := range ownerList {
			if seen[owner] {
				continue
			}
			seen[owner] = true
			owners = append(owners, owner)
		}
	}
	sort.Strings(owners)
	return owners
}

func TestSyntheticOwnersDoNotDuplicateDerivedInputs(t *testing.T) {
	derived := map[string]bool{}
	for _, owner := range derivedOwnersList() {
		derived[owner] = true
	}

	var duplicated []string
	for _, owner := range syntheticOwners() {
		if derived[owner] {
			duplicated = append(duplicated, owner)
		}
	}
	sort.Strings(duplicated)
	require.Empty(t, duplicated, "derived input owners should be removed from syntheticOwners")
}

func reflectedInputOwners() []string {
	var owners []string
	src := filepath.Join(repoRootFromSource(), "internal", "schema", "input", "input.go")
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, src, nil, 0)
	if err != nil {
		panic(err)
	}
	for _, decl := range file.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok {
			continue
		}
		switch gen.Tok {
		case token.TYPE:
			for _, spec := range gen.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok || !typeSpec.Name.IsExported() {
					continue
				}
				structType, ok := typeSpec.Type.(*ast.StructType)
				if !ok {
					continue
				}
				for _, field := range structType.Fields.List {
					for _, name := range field.Names {
						if !name.IsExported() {
							continue
						}
						owners = append(owners, "input."+typeSpec.Name.Name+"."+name.Name)
					}
				}
			}
		case token.CONST:
			var currentType string
			for _, spec := range gen.Specs {
				valueSpec, ok := spec.(*ast.ValueSpec)
				if !ok {
					continue
				}
				if ident, ok := valueSpec.Type.(*ast.Ident); ok {
					currentType = ident.Name
				}
				if currentType == "" {
					continue
				}
				for _, name := range valueSpec.Names {
					if owner := reflectedInputEnumOwner(currentType, name.Name); owner != "" {
						owners = append(owners, owner)
					}
				}
			}
		}
	}
	sort.Strings(owners)
	return owners
}

func reflectedActionOperationOwners() []string {
	src := filepath.Join(repoRootFromSource(), "internal", "schema", "input", "input.go")
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, src, nil, 0)
	if err != nil {
		panic(err)
	}

	edgeActions := map[string]bool{
		"AddEdge":    true,
		"RemoveEdge": true,
		"EdgeGroup":  true,
	}
	seen := map[string]bool{}
	var owners []string
	ast.Inspect(file, func(n ast.Node) bool {
		fn, ok := n.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "getTSStringOperation" {
			return true
		}
		ast.Inspect(fn.Body, func(n ast.Node) bool {
			ret, ok := n.(*ast.ReturnStmt)
			if !ok || len(ret.Results) != 1 {
				return true
			}
			lit, ok := ret.Results[0].(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}
			value, err := strconv.Unquote(lit.Value)
			if err != nil || !strings.HasPrefix(value, "ActionOperation.") {
				return true
			}
			operation := strings.TrimPrefix(value, "ActionOperation.")
			ownerPrefix := "input.Action.Operation."
			if edgeActions[operation] {
				ownerPrefix = "input.EdgeAction.Operation."
			}
			owner := ownerPrefix + operation
			if !seen[owner] {
				seen[owner] = true
				owners = append(owners, owner)
			}
			return true
		})
		return false
	})
	sort.Strings(owners)
	return owners
}

func reflectedInputEnumOwner(typeName, constName string) string {
	switch typeName {
	case "DBType", "CustomType", "OnDeleteFkey", "IndexType":
		return "input." + typeName + "." + constName
	case "OrderByDirection":
		return "input.OrderByDirection." + constName
	case "NullsPlacement":
		return "input.NullsPlacement." + constName
	case "FullTextLanguage":
		return "input.FullText.Language." + constName
	case "NullableItem":
		switch constName {
		case "NullableContents":
			return "input.NullableItem.Contents"
		case "NullableContentsAndList":
			return "input.NullableItem.ContentsAndList"
		case "NullableTrue":
			return "input.NullableItem.True"
		}
	case "ActionType":
		if strings.HasPrefix(constName, "ActionType") {
			return "input.ActionField.Type." + strings.TrimPrefix(constName, "ActionType")
		}
	case "ConstraintType":
		switch constName {
		case "PrimaryKeyConstraint":
			return "input.Constraint.Type.PrimaryKey"
		case "ForeignKeyConstraint":
			return "input.Constraint.Type.ForeignKey"
		case "UniqueConstraint":
			return "input.Constraint.Type.Unique"
		case "CheckConstraint":
			return "input.Constraint.Type.Check"
		}
	}
	return ""
}
