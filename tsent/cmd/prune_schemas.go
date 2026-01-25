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

		var dsCfg *devschema.Config
		if cfg.DevSchema() != nil {
			ds := cfg.DevSchema()
			var pruneEnabled *bool
			var pruneDays int
			if ds.Prune != nil {
				pruneEnabled = &ds.Prune.Enabled
				pruneDays = ds.Prune.Days
			}
			dsCfg = &devschema.Config{
				Enabled:       ds.Enabled,
				Prefix:        ds.Prefix,
				IncludePublic: ds.IncludePublic,
				SchemaName:    ds.SchemaName,
				BranchName:    ds.BranchName,
				Suffix:        ds.Suffix,
				PruneEnabled:  pruneEnabled,
				PruneDays:     pruneDays,
			}
		}
		res, _ := devschema.Resolve(dsCfg, devschema.Options{RepoRoot: cfg.GetAbsPathToRoot()})

		prefix := pruneSchemasInfo.prefix
		if prefix == "" && res != nil {
			prefix = res.Prefix
		}
		if prefix == "" {
			prefix = devschema.DefaultPrefix
		}

		days := pruneSchemasInfo.days
		if days <= 0 {
			days = devschema.ParsePruneDays()
		}

		dryRun := pruneSchemasInfo.dryRun
		if pruneSchemasInfo.force {
			dryRun = false
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
