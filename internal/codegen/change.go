package codegen

import (
	"bytes"

	"github.com/lolopinto/ent/internal/auto_schema"
)

type ChangeType string

const (
	// NOTE: this was a list that was in sync with change_type in auto_schema/change_type.py
	// since deprecated and we're only using one, only keeping reference to that one
	AddColumn   ChangeType = "add_column"
	CreateIndex ChangeType = "create_index"
	DropIndex   ChangeType = "drop_index"
)

type deprecatedChange struct {
	Change ChangeType
	Desc   string
	Col    string
	Index  string
}

// get db changes and store in Buffer (output of auto_schema --changes)
func dbChanges(cfg *Config) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	err := auto_schema.RunPythonCommandWriter(cfg, &buf, "--changes")
	return &buf, err
}
