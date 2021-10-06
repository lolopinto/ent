package cmd

import (
	"strconv"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/spf13/cobra"
)

var squashCmd = &cobra.Command{
	Use:     "squash",
	Short:   "squash last N revs of the db into one",
	Example: `tsent squash 2`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		i, err := strconv.Atoi(args[0])
		if err != nil {
			return err
		}
		return db.Squash(cfg, i)
	},
}
