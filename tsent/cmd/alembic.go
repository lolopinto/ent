package cmd

import (
	"fmt"

	"github.com/lolopinto/ent/internal/auto_schema"
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
	"stamp":     1, // stamp --purge option may be needed. would need a child command or simple flag parsing here
	"edit":      1,
	"merge":     1,
}

var variableArgs = map[string]bool{
	"history": true,
}

var alembicCmd = &cobra.Command{
	Use:   "alembic",
	Short: "alembic command",
	Long:  `This runs the passed in alembic command. Valid alembic commands are upgrade, downgrade, history, current, heads, branches, show, stamp, edit`,
	Example: `tsent alembic history 
tsent alembic current
tsent alembic history --verbose 
tsent alembic history --verbose --last 4
tsent alembic history --verbose --rev_range rev1:current
	`,
	Args: cobra.ArbitraryArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}
		command := args[0]
		count, ok := validCmds[command]
		if !ok {
			return fmt.Errorf("invalid alembic command %s passed in", command)
		}

		if count+1 != len(args) && !variableArgs[command] {
			return fmt.Errorf("invalid number of args passed. expected %d", count+1)
		}

		if command == "history" {
			args[0] = "--history"
			return auto_schema.RunPythonCommand(cfg, args...)
		}

		return db.RunAlembicCommand(cfg, args[0], args[1:]...)
	},
}
