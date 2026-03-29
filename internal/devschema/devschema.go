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

	currentBranch := ""
	currentBranchResolved := false
	resolveCurrentBranch := func() string {
		if !currentBranchResolved {
			currentBranch = ResolveGitBranch(opts.RepoRoot)
			currentBranchResolved = true
		}
		return currentBranch
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
	branchName := ""
	pruneEnabled, pruneDays := resolvePrune(cfg, state)

	if cfg != nil && cfg.SchemaName != "" {
		schemaName = cfg.SchemaName
		explicitSchema = true
	} else if state != nil {
		schemaName = state.SchemaName
		branchName = state.BranchName
		if schemaName != "" && branchName == "" {
			explicitSchema = true
		}
	}

	if explicitSchema {
		schemaName = sanitizeIdentifier(schemaName)
	} else if cfg != nil {
		branchName = resolveCurrentBranch()
		if branchName == "" {
			return nil, fmt.Errorf("dev branch schemas are enabled but the current git branch could not be determined; set devSchema.schemaName explicitly")
		}
		schemaName = buildSchemaName(branchName)
	} else {
		if schemaName != "" && branchName != "" {
			// State-file mode is tied to the branch that generated the schema.
			// Fail closed after branch switches until codegen refreshes the state.
			current := resolveCurrentBranch()
			if current == "" {
				return nil, fmt.Errorf("dev branch schema state was generated for branch %q but the current git branch could not be determined; run ent codegen to regenerate or set devSchema.schemaName explicitly", branchName)
			}
			if current != branchName {
				return nil, fmt.Errorf("dev branch schema state was generated for branch %q but current branch is %q; run ent codegen to regenerate or set devSchema.schemaName explicitly", branchName, current)
			}
		}
		if schemaName == "" {
			branchName = resolveCurrentBranch()
			if branchName == "" {
				return nil, fmt.Errorf("dev branch schemas are enabled but the current git branch could not be determined; set devSchema.schemaName explicitly or run ent codegen to regenerate src/schema/.ent/dev_schema.json")
			}
			schemaName = buildSchemaName(branchName)
		}
	}
	branchForIgnore := branchName
	if branchForIgnore == "" {
		branchForIgnore = resolveCurrentBranch()
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
