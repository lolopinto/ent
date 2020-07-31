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
	Run: func(cmd *cobra.Command, args []string) {
		// another hardcoded place
		codePathInfo := codegen.NewCodePath("src/schema", "")

		db.UpgradeDB(codePathInfo)
	},
}
