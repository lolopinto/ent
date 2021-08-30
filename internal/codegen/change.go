package codegen

import (
	"bytes"

	"github.com/lolopinto/ent/internal/auto_schema"
)

type ChangeType string

// note these need to be in sync with change_type in auto_schema/change_type.py
const (
	AddTable               ChangeType = "add_table"
	DropTable              ChangeType = "drop_table"
	AddColumn              ChangeType = "add_column"
	DropColumn             ChangeType = "drop_column"
	CreateIndex            ChangeType = "create_index"
	DropIndex              ChangeType = "drop_index"
	CreateForeignKey       ChangeType = "create_foreign_key"
	AlterColumn            ChangeType = "alter_column"
	CreateUniqueConstraint ChangeType = "create_unique_constraint"
	AddEdges               ChangeType = "add_edges"
	RemoveEdges            ChangeType = "remove_edges"
	ModifyEdge             ChangeType = "modify_edge"
	AddRows                ChangeType = "add_rows"
	RemoveRows             ChangeType = "remove_rows"
	ModifyRows             ChangeType = "modify_rows"
	AlterEnum              ChangeType = "alter_enum"
	AddEnum                ChangeType = "add_enum"
	DropEnum               ChangeType = "drop_enum"
	CreateCheckConstraint  ChangeType = "create_check_constraint"
	DropCheckConstraint    ChangeType = "drop_check_constraint"
)

type change struct {
	Change ChangeType
	Desc   string
	Col    string
}

// get db changes and store in Buffer (output of auto_schema --changes)
func dbChanges(cfg *Config) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	err := auto_schema.RunPythonCommandWriter(cfg.GetRootPathToConfigs(), &buf, "--changes")
	return &buf, err
}
