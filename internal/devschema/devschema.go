package devschema

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	DefaultPrefix    = "ent_dev"
	DefaultPruneDays = 30
	MaxSchemaLen     = 63
)

type Config struct {
	Enabled        bool
	SchemaName     string
	IncludePublic  bool
	IgnoreBranches []string
	PruneEnabled   bool
	PruneDays      int
}

type Options struct {
	NodeEnv    string
	RepoRoot   string
	SchemaPath string
}

type Result struct {
	Enabled        bool
	SchemaName     string
	BranchName     string
	IncludePublic  bool
	IgnoreBranches []string
	PruneEnabled   bool
	PruneDays      int
}

func Resolve(cfg *Config, opts Options) (*Result, error) {
	nodeEnv := opts.NodeEnv
	if nodeEnv == "" {
		nodeEnv = os.Getenv("NODE_ENV")
	}
	if strings.EqualFold(nodeEnv, "production") {
		return &Result{Enabled: false}, nil
	}

	var state *State
	if cfg == nil {
		var err error
		state, err = LoadState(opts)
		if err != nil {
			return nil, err
		}
	}

	envEnabled := parseEnvBool("ENT_DEV_SCHEMA_ENABLED")
	enabled := false
	if envEnabled != nil {
		enabled = *envEnabled
	} else if cfg != nil {
		enabled = cfg.Enabled
	} else if state != nil && state.SchemaName != "" {
		enabled = true
	}

	if !enabled {
		return &Result{Enabled: false}, nil
	}

	includePublic := false
	if cfg != nil {
		includePublic = cfg.IncludePublic
	} else if state != nil {
		includePublic = state.IncludePublic
	}
	ignoreBranches := []string{}
	if cfg != nil && len(cfg.IgnoreBranches) > 0 {
		ignoreBranches = cfg.IgnoreBranches
	} else if state != nil && len(state.IgnoreBranches) > 0 {
		ignoreBranches = state.IgnoreBranches
	}

	schemaName := ""
	explicitSchema := false
	if cfg != nil && cfg.SchemaName != "" {
		schemaName = cfg.SchemaName
		explicitSchema = true
	} else if state != nil {
		schemaName = state.SchemaName
		if schemaName != "" && state.BranchName == "" {
			explicitSchema = true
		}
	}

	pruneEnabled, pruneDays := resolvePrune(cfg, state)

	branchName := ""
	if !explicitSchema {
		if state != nil {
			branchName = state.BranchName
		}
		if branchName == "" {
			branchName = ResolveGitBranch(opts.RepoRoot)
		}
		if schemaName == "" {
			if branchName == "" {
				return nil, fmt.Errorf("dev branch schemas are enabled but no git branch or schema name is available")
			}
			schemaName = buildSchemaName(branchName)
		}
	} else if schemaName != "" {
		schemaName = sanitizeIdentifier(schemaName)
	}
	branchForIgnore := branchName
	if branchForIgnore == "" {
		branchForIgnore = ResolveGitBranch(opts.RepoRoot)
	}
	if envEnabled == nil && isBranchIgnored(ignoreBranches, branchForIgnore) {
		return &Result{Enabled: false}, nil
	}

	return &Result{
		Enabled:        true,
		SchemaName:     schemaName,
		BranchName:     branchName,
		IncludePublic:  includePublic,
		IgnoreBranches: ignoreBranches,
		PruneEnabled:   pruneEnabled,
		PruneDays:      pruneDays,
	}, nil
}

func WriteStateFromConfig(cfg *Config, opts Options) (*Result, error) {
	res, err := Resolve(cfg, opts)
	if err != nil {
		return nil, err
	}
	if err := WriteState(res, opts); err != nil {
		return nil, err
	}
	return res, nil
}

func resolvePrune(cfg *Config, state *State) (bool, int) {
	if cfg != nil {
		days := cfg.PruneDays
		if days <= 0 {
			days = DefaultPruneDays
		}
		return cfg.PruneEnabled, days
	}
	if state != nil {
		days := state.PruneDays
		if days <= 0 {
			days = DefaultPruneDays
		}
		return state.PruneEnabled, days
	}
	return false, DefaultPruneDays
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
