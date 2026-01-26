package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/devschema"
	"github.com/spf13/cobra"
)

type pruneSchemasArgs struct {
	days   int
	prefix string
	dryRun bool
	force  bool
}

var pruneSchemasInfo pruneSchemasArgs

var pruneSchemasCmd = &cobra.Command{
	Use:   "prune_schemas",
	Short: "prune dev branch schemas in postgres",
	Long:  "prune dev branch schemas based on last_used_at tracked in the registry table",
	Args:  cobra.ArbitraryArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		if strings.EqualFold(os.Getenv("NODE_ENV"), "production") {
			return fmt.Errorf("dev branch schema pruning is disabled in production")
		}

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		prefix := pruneSchemasInfo.prefix
		if prefix == "" {
			prefix = devschema.DefaultPrefix
		}

		days := pruneSchemasInfo.days
		if days <= 0 {
			days = devschema.DefaultPruneDays
			if cfg.DevSchema() != nil && cfg.DevSchema().Prune != nil && cfg.DevSchema().Prune.Days > 0 {
				days = cfg.DevSchema().Prune.Days
			}
		}

		dryRun := pruneSchemasInfo.dryRun
		if pruneSchemasInfo.force {
			dryRun = false
		}

		if strings.EqualFold(config.Get().DB.Dialect, "sqlite") {
			return fmt.Errorf("dev branch schema pruning is only supported for postgres")
		}

		db, err := config.Get().DB.Init()
		if err != nil {
			return err
		}
		defer db.Close()

		dropped, err := devschema.PruneSchemas(db, devschema.PruneOptions{
			Prefix: prefix,
			Days:   days,
			DryRun: dryRun,
		})
		if err != nil {
			return err
		}

		mode := "dry-run"
		if !dryRun {
			mode = "deleted"
		}
		fmt.Printf("prune_schemas %s: %d schema(s)\n", mode, len(dropped))
		for _, name := range dropped {
			fmt.Printf(" - %s\n", name)
		}
		return nil
	},
}
