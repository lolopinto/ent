package devschema

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeGitHead(t *testing.T, root, branch string) {
	t.Helper()
	gitDir := filepath.Join(root, ".git")
	if err := os.MkdirAll(gitDir, 0o755); err != nil {
		t.Fatalf("mkdir git dir: %v", err)
	}
	head := []byte("ref: refs/heads/" + branch)
	if err := os.WriteFile(filepath.Join(gitDir, "HEAD"), head, 0o644); err != nil {
		t.Fatalf("write HEAD: %v", err)
	}
}

func TestResolveEnabledFalseOverridesSchemaName(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	t.Setenv("ENT_DEV_SCHEMA_ENABLED", "")
	cfg := &Config{
		Enabled:    false,
		SchemaName: "explicit_schema",
	}
	res, err := Resolve(cfg, Options{})
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if res.Enabled {
		t.Fatalf("expected disabled when enabled=false, got enabled")
	}
}

func TestResolveIgnoreBranches(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	t.Setenv("ENT_DEV_SCHEMA_ENABLED", "")
	root := t.TempDir()
	writeGitHead(t, root, "main")
	cfg := &Config{
		Enabled:        true,
		IgnoreBranches: []string{"main"},
	}
	res, err := Resolve(cfg, Options{RepoRoot: root})
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if res.Enabled {
		t.Fatalf("expected disabled for ignored branch")
	}
}

func TestResolveIgnoreBranchesEnvOverride(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	root := t.TempDir()
	writeGitHead(t, root, "main")
	t.Setenv("ENT_DEV_SCHEMA_ENABLED", "true")
	cfg := &Config{
		Enabled:        true,
		IgnoreBranches: []string{"main"},
	}
	res, err := Resolve(cfg, Options{RepoRoot: root})
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if !res.Enabled {
		t.Fatalf("expected enabled when env override is true")
	}
}

func TestResolveIgnoreBranchesFromState(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	t.Setenv("ENT_DEV_SCHEMA_ENABLED", "")
	root := t.TempDir()
	writeGitHead(t, root, "main")
	res := &Result{
		Enabled:        true,
		SchemaName:     "ent_dev_main_abcd1234",
		BranchName:     "main",
		IgnoreBranches: []string{"main"},
	}
	if err := WriteState(res, Options{RepoRoot: root}); err != nil {
		t.Fatalf("write state: %v", err)
	}
	out, err := Resolve(nil, Options{RepoRoot: root})
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if out.Enabled {
		t.Fatalf("expected disabled via state ignoreBranches")
	}
}

func TestResolveSanitizesExplicitSchemaName(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	t.Setenv("ENT_DEV_SCHEMA_ENABLED", "")
	cfg := &Config{
		Enabled:    true,
		SchemaName: "123bad",
	}
	res, err := Resolve(cfg, Options{})
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if res.SchemaName != "schema_123bad" {
		t.Fatalf("expected sanitized schema name, got %q", res.SchemaName)
	}
}

func TestBuildSchemaNameLength(t *testing.T) {
	t.Setenv("NODE_ENV", "development")
	branch := strings.Repeat("feature-super-long-", 10)
	name := buildSchemaName(branch)
	if len(name) > MaxSchemaLen {
		t.Fatalf("expected schema name <= %d, got %d", MaxSchemaLen, len(name))
	}
	if !strings.HasPrefix(name, sanitizeIdentifier(DefaultPrefix)+"_") {
		t.Fatalf("expected prefix %q, got %q", sanitizeIdentifier(DefaultPrefix), name)
	}
}
