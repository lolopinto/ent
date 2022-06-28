package cmd

import (
	"github.com/lolopinto/ent/internal/build_info"
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
	Long: `This downgrades the database to the specified version. It also deletes the generated schema files. 
	
To keep the generated schema files, pass the --keep_schema_files argument.

When there's a branch and there's multiple heads and you wanna downgrade one branch, the command is as follows:
tsent downgrade rev@branchrev
For example, 
if a change is made in one branch: rev1 -> rev2a 
and in another branch: rev1 -> rev2b 
and you're in main and both have been upgraded and you want downgrade just rev2a: the command is tsent downgrade rev2a@rev1

If you're trying to downgrade a single revision e.g. downgrade -- -1 and get "Ambiguous walk" and you end up with a situation where there's only one head and multiple down revs, try running tsent downgrade current@one_down_rev and see if that fixes it
`,
	Example: `tsent downgrade --keep_schema_files -- -1
tsent downgrade --keep_schema_files revision
tsent downgrade -- -1
tsent downgrade revision
tsent downgrade rev2a@rev1`,
	Args: cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		if err := db.DowngradeDB(cfg, args[0], downgradeInfo.keepSchemaFiles); err != nil {
			return err
		}
		return build_info.FlagNextBuildInfoAsWriteAll(cfg, cfg)
	},
}
