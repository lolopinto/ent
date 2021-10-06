package cmd

import (
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "upgrade db",
	Long:  `This upgrades the database to the latest version`,
	Args:  cobra.RangeArgs(0, 1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// default to head if not passed in
		revision := "head"
		if len(args) == 1 {
			revision = args[0]
		}
		cfg, err := getPathToCode(getPathToConfig())
		if err != nil {
			return err
		}
		return db.UpgradeDB(cfg, revision, false)
	},
}
