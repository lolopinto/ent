package cmd

import (
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var downgradeCmd = &cobra.Command{
	Use:   "downgrade",
	Short: "downgrade db",
	Long:  `This downgrades the database to the specified version`,
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		codePathInfo, err := codegen.NewCodePath("src/schema", "")
		if err != nil {
			return err
		}

		return db.DowngradeDB(codePathInfo, args[0])
	},
}
