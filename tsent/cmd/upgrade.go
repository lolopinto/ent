package cmd

import (
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "upgrade db",
	Long:  `This upgrades the database to the latest version`,
	Args: cobra.RangeArgs(0, 1),
	Run: func(cmd *cobra.Command, args []string) {
		// default to head if not passed in
		revision := "head"
		if len(args) == 1 {
			revision = args[0]
		}
		// another hardcoded place
		codePathInfo := codegen.NewCodePath("src/schema", "")

		db.UpgradeDB(codePathInfo, revision)
	},
}
