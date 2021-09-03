package cmd

import (
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var fixEdgesCmd = &cobra.Command{
	Use:   "fix-edges",
	Short: "fix edges db",
	Long:  `this fixes the edges in the db`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := getPathToCode(getPathToConfig())
		if err != nil {
			return err
		}
		return db.FixEdges(cfg)
	},
}
