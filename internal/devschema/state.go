package devschema

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const (
	stateDirName  = ".ent"
	stateFileName = "dev_schema.json"
)

type State struct {
	SchemaName     string   `json:"schemaName"`
	BranchName     string   `json:"branchName,omitempty"`
	IncludePublic  bool     `json:"includePublic"`
	IgnoreBranches []string `json:"ignoreBranches,omitempty"`
	PruneEnabled   bool     `json:"pruneEnabled,omitempty"`
	PruneDays      int      `json:"pruneDays,omitempty"`
}

func WriteState(res *Result, opts Options) error {
	path, ok := statePath(opts)
	if !ok {
		return nil
	}
	if res == nil || !res.Enabled || res.SchemaName == "" {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	state := State{
		SchemaName:     res.SchemaName,
		BranchName:     res.BranchName,
		IncludePublic:  res.IncludePublic,
		IgnoreBranches: res.IgnoreBranches,
	}
	if res.PruneEnabled {
		state.PruneEnabled = true
		state.PruneDays = res.PruneDays
	}
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func LoadState(opts Options) (*State, error) {
	path, ok := statePath(opts)
	if !ok {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	if state.SchemaName == "" {
		return nil, nil
	}
	return &state, nil
}

func statePath(opts Options) (string, bool) {
	schemaDir := opts.SchemaPath
	if schemaDir == "" {
		root := opts.RepoRoot
		if root == "" {
			if cwd, err := os.Getwd(); err == nil {
				root = findGitRoot(cwd)
				if root == "" {
					root = cwd
				}
			}
		}
		if root == "" {
			return "", false
		}
		schemaDir = filepath.Join(root, "src", "schema")
	}
	return filepath.Join(schemaDir, stateDirName, stateFileName), true
}
