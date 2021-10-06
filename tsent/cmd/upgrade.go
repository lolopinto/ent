package cmd

import (
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

type upgradeArgs struct {
	mergeBranches bool
}

var upgradeInfo upgradeArgs

var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "upgrade db",
	Long:  `This upgrades the database to the latest version`,
	Example: `tsent upgrade 
tsent upgrade --merge_branches 
tsent upgrade --merge_branches head
tsent upgrade --merge_branches revision
tsent upgrade revision`,
	Args: cobra.RangeArgs(0, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		// default to head if not passed in
		revision := "head"
		if len(args) == 1 {
			revision = args[0]
		}
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		return db.UpgradeDB(cfg, revision, upgradeInfo.mergeBranches)
	},
}
