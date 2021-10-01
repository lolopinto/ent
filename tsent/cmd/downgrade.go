package cmd

import (
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

type downgradeArgs struct {
	keepSchemaFiles bool
}

var downgradeInfo downgradeArgs

var downgradeCmd = &cobra.Command{
	Use:   "downgrade",
	Short: "downgrade db",
	Long:  `This downgrades the database to the specified version`,
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		return db.DowngradeDB(cfg, args[0], downgradeInfo.keepSchemaFiles)
	},
}
