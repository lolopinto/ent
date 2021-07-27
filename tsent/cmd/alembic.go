package cmd

import (
	"fmt"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var validCmds = map[string]int{
	"upgrade":   1,
	"downgrade": 1,
	"history":   0,
	"current":   0,
	"heads":     0,
	"branches":  0,
	"show":      1,
	"stamp":     1,
	"edit":      1,
}

var alembicCmd = &cobra.Command{
	Use:   "alembic",
	Short: "alembic command",
	Long:  `This runs the passed in alembic command`,
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		codePathInfo := codegen.NewCodePath("src/schema", "")
		command := args[0]
		count, ok := validCmds[command]
		if !ok {
			return fmt.Errorf("invalid alembic command %s passed in", command)
		}

		if count+1 != len(args) {
			return fmt.Errorf("invalid number of args passed. expected %d", count+1)
		}

		return db.RunAlembicCommand(codePathInfo, args[0], args[1:]...)
	},
}
