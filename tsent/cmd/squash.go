package cmd

import (
	"strconv"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/prompt"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

type squashArgs struct {
	message string
}

var squashInfo squashArgs

var squashCmd = &cobra.Command{
	Use:     "squash",
	Short:   "squash last N revs of the db into one or squash all revs into one to clean up migration files",
	Example: `tsent squash 2\n tsent squash all --message "squash all"`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		if args[0] == "all" {

			p := &prompt.YesNoQuestion{
				// idk what the best color is here but we don't do it too often so it's fine for now...
				Question: util.WrapBrightGreen(
					"Note that you'll be left with just one migration file if you do this and won't be able to downgrade anymore.\n" +
						"You should only do this if the current development environment matches production AND you don't have branches in your migration history.\n" +
						"If you're not sure about branches, you should run `docker-compose -f docker-compose.dev.yml run --rm app tsent alembic heads` or `tsent alembic heads` to confirm.\n" +
						"Are you sure you want to squash all migrations into one? Y/N:"),
				NoHandler: prompt.ExitHandler,
			}

			if err := prompt.HandlePrompts([]prompt.Prompt{p}); err != nil {
				return err
			}

			return db.SquashAll(cfg, squashInfo.message)
		}

		i, err := strconv.Atoi(args[0])
		if err != nil {
			return err
		}

		// prompt all
		return db.SquashN(cfg, i)
	},
}
