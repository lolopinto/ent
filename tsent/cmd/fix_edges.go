package cmd

import (
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var fixEdgesCmd = &cobra.Command{
	Use:   "fix-edges",
	Short: "fix edges db",
	Long:  `this fixes the edges in the db`,
	Run: func(cmd *cobra.Command, args []string) {
		// another hardcoded place
		codePathInfo := codegen.NewCodePath("src/schema", "")

		db.FixEdges(codePathInfo)
	},
}
