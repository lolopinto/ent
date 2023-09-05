package cmd

import (
	"github.com/lolopinto/ent/internal/auto_schema"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/spf13/cobra"
)

type migrateArgs struct {
	message string
}

var migrateInfo migrateArgs

var migrationCmd = &cobra.Command{
	Use:   "migration",
	Short: "creates a new migration for custom user-defined migrations",
	Long: `creates a custom migration file that can then be edited to run custom sql.
After the migration is created, you should edit it in 2 places:
def upgrade():
	pass

def downgrade():
	pass

In an example migration as above: change the 'pass' in the upgrade and downgrade functions to the sql you want to run, calling the op.execute_sql python function for example:

def upgrade():
	op.execute_sql("CREATE TYPE rainbow as ENUM ('red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet')")

def downgrade():
	op.execute_sql("DROP TYPE rainbow")

And then run, npm run codegen or npm run upgrade to upgrade the database to run the migration you just created.

Note that if there are things ent automatically does, doing them here would lead to ent eventually reverting your change
since the schema isn't aware of it.
	`,
	Example: `tsent migration --message "do something"
	`,
	Args: cobra.ArbitraryArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		pythonArgs := []string{"--revision", "--message", migrateInfo.message}

		return auto_schema.RunPythonCommand(cfg, pythonArgs...)
	},
}
