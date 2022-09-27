package codegen

import (
	"bytes"

	"github.com/lolopinto/ent/internal/auto_schema"
)

type DBChangeType string

const (
	// NOTE: this was a list that was in sync with change_type in auto_schema/change_type.py
	// since deprecated and we're only using a few, only keeping reference to those ones
	AddColumn   DBChangeType = "add_column"
	CreateIndex DBChangeType = "create_index"
	DropIndex   DBChangeType = "drop_index"
	ModifyEdge  DBChangeType = "modify_edge"
)

type deprecatedChange struct {
	Change DBChangeType `json:"change"`
	Desc   string       `json:"desc"`
	Col    string       `json:"col"`
	Index  string       `json:"index"`
	Edge   string       `json:"edge"`
}

// get db changes and store in Buffer (output of auto_schema --changes)
func dbChanges(cfg *Config) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	err := auto_schema.RunPythonCommandWriter(cfg, &buf, "--changes")
	return &buf, err
}
