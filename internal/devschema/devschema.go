package devschema

import (
	"os"
	"path/filepath"
	"strings"
)

const (
	DefaultPrefix = "ent_dev"
	MaxSchemaLen  = 63
)

type Config struct {
	Enabled       bool
	Prefix        string
	IncludePublic *bool
	SchemaName    string
	BranchName    string
	Suffix        string
	PruneEnabled  *bool
	PruneDays     int
}

type Options struct {
	NodeEnv  string
	RepoRoot string
}

type Result struct {
	Enabled       bool
	SchemaName    string
	IncludePublic bool
	BranchName    string
	Prefix        string
}

func Resolve(cfg *Config, opts Options) (*Result, error) {
	nodeEnv := opts.NodeEnv
	if nodeEnv == "" {
		nodeEnv = os.Getenv("NODE_ENV")
	}
	if strings.EqualFold(nodeEnv, "production") {
		return &Result{Enabled: false}, nil
	}

	envEnabled := parseEnvBool(
		"ENT_DEV_SCHEMA_ENABLED",
		"ENT_DEV_BRANCH_SCHEMAS",
	)

	enabled := false
	if envEnabled != nil {
		enabled = *envEnabled
	} else if cfg != nil && cfg.Enabled {
		enabled = true
	}

	schemaName := firstEnv(
		"ENT_DEV_SCHEMA_NAME",
	)
	if schemaName == "" && cfg != nil {
		schemaName = cfg.SchemaName
	}
	if schemaName != "" {
		enabled = true
	}

	if !enabled {
		return &Result{Enabled: false}, nil
	}

	includePublic := true
	if cfg != nil && cfg.IncludePublic != nil {
		includePublic = *cfg.IncludePublic
	}
	if v := parseEnvBool("ENT_DEV_SCHEMA_INCLUDE_PUBLIC"); v != nil {
		includePublic = *v
	}

	branchName := ""
	if cfg != nil {
		branchName = cfg.BranchName
	}

	prefix := firstEnv("ENT_DEV_SCHEMA_PREFIX")
	if prefix == "" && cfg != nil {
		prefix = cfg.Prefix
	}
	if prefix == "" {
		prefix = DefaultPrefix
	}

	if schemaName == "" {
		if branchName == "" {
			branchName = ResolveGitBranch(opts.RepoRoot)
		}
		if branchName == "" {
			return &Result{
				Enabled:       true,
				IncludePublic: includePublic,
				Prefix:        prefix,
			}, nil
		}
		suffix := firstEnv("ENT_DEV_SCHEMA_SUFFIX")
		if suffix == "" && cfg != nil {
			suffix = cfg.Suffix
		}
		schemaName = buildSchemaName(prefix, branchName, suffix)
	} else {
		schemaName = sanitizeIdentifier(schemaName)
	}

	return &Result{
		Enabled:       true,
		SchemaName:    schemaName,
		IncludePublic: includePublic,
		BranchName:    branchName,
		Prefix:        prefix,
	}, nil
}

func ApplyEnvFromConfig(cfg *Config, opts Options) (*Result, error) {
	res, err := Resolve(cfg, opts)
	if err != nil {
		return res, err
	}
	if !res.Enabled || res.SchemaName == "" {
		return res, nil
	}

	if os.Getenv("ENT_DEV_SCHEMA_NAME") == "" {
		_ = os.Setenv("ENT_DEV_SCHEMA_NAME", res.SchemaName)
	}
	if os.Getenv("ENT_DEV_SCHEMA_INCLUDE_PUBLIC") == "" {
		_ = os.Setenv("ENT_DEV_SCHEMA_INCLUDE_PUBLIC", boolToString(res.IncludePublic))
	}
	if res.BranchName != "" && os.Getenv("ENT_DEV_SCHEMA_BRANCH") == "" {
		_ = os.Setenv("ENT_DEV_SCHEMA_BRANCH", res.BranchName)
	}

	if cfg != nil && cfg.PruneEnabled != nil {
		if os.Getenv("ENT_DEV_SCHEMA_PRUNE_ENABLED") == "" {
			_ = os.Setenv("ENT_DEV_SCHEMA_PRUNE_ENABLED", boolToString(*cfg.PruneEnabled))
		}
	}
	if cfg != nil && cfg.PruneDays > 0 {
		if os.Getenv("ENT_DEV_SCHEMA_PRUNE_DAYS") == "" {
			_ = os.Setenv("ENT_DEV_SCHEMA_PRUNE_DAYS", intToString(cfg.PruneDays))
		}
	}
	return res, nil
}

func ResolveGitBranch(repoRoot string) string {
	start := repoRoot
	if start == "" {
		if cwd, err := os.Getwd(); err == nil {
			start = cwd
		}
	}
	root := findGitRoot(start)
	if root == "" {
		return ""
	}
	return branchFromGitDir(resolveGitDir(filepath.Join(root, ".git")))
}
