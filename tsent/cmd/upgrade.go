package cmd

import (
	"os"
	"path/filepath"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

type upgradeArgs struct {
	sql bool
}

var upgradeInfo upgradeArgs
var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "upgrade db",
	Long:  `This upgrades the database to the latest version`,
	Example: `tsent upgrade 
tsent upgrade revision
tsent upgrade r1:r2 --sql`,
	Args: cobra.RangeArgs(0, 1),
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

		// if schema.py doesn't exist, don't do anything
		// checking this here beause codegen calls this
		// may eventually make sense to do this in auto_schema.RunPythonCommandWriter maybe
		schemaPath := filepath.Join(cfg.GetRootPathToConfigs(), "schema.py")
		_, err = os.Stat(schemaPath)
		if os.IsNotExist(err) {
			return nil
		}
		if err != nil {
			return err
		}

		return db.UpgradeDB(cfg, revision, upgradeInfo.sql)
	},
}
