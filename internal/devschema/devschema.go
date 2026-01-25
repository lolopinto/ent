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

var defaultConfig *Config

func SetDefaultConfig(cfg *Config) {
	if cfg == nil {
		defaultConfig = nil
		return
	}
	clone := *cfg
	defaultConfig = &clone
}

func Resolve(cfg *Config, opts Options) (*Result, error) {
	if cfg == nil {
		cfg = defaultConfig
	}
	nodeEnv := opts.NodeEnv
	if nodeEnv == "" {
		nodeEnv = os.Getenv("NODE_ENV")
	}
	if strings.EqualFold(nodeEnv, "production") {
		return &Result{Enabled: false}, nil
	}

	envEnabled, hasEnvEnabled := parseEnvBool(
		"ENT_DEV_SCHEMA_ENABLED",
	)

	enabled := false
	if hasEnvEnabled {
		enabled = envEnabled
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
	if v, ok := parseEnvBool("ENT_DEV_SCHEMA_INCLUDE_PUBLIC"); ok {
		includePublic = v
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
	SetDefaultConfig(cfg)
	return Resolve(cfg, opts)
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
