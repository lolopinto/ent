package cmd

import (
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var downgradeCmd = &cobra.Command{
	Use:   "downgrade",
	Short: "downgrade db",
	Long:  `This downgrades the database to the specified version`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		codePathInfo := getPathToCode(getPathToConfig())
		db.DowngradeDB(codePathInfo, args[0])
	},
}
