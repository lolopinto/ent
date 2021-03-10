package cmd

import (
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var fixEdgesCmd = &cobra.Command{
	Use:   "fix-edges",
	Short: "fix edges db",
	Long:  `this fixes the edges in the db`,
	Run: func(cmd *cobra.Command, args []string) {
		codePathInfo := getPathToCode(getPathToConfig())
		db.FixEdges(codePathInfo)
	},
}
