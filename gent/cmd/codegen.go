package cmd

import (
	"github.com/lolopinto/ent/internal/code"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/spf13/cobra"
)

type codegenArgs struct {
	specificConfig string
	step           string
}

var codegenInfo codegenArgs

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	Args:  configRequired,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := getPathToCode(pathToConfig)
		if err != nil {
			return err
		}
		return parseSchemasAndGenerate(cfg, codegenInfo.specificConfig, codegenInfo.step)
	},
}

func parseAllSchemaFiles(rootPath string, specificConfigs ...string) (*schema.Schema, error) {
	p := &schemaparser.ConfigSchemaParser{
		AbsRootPath: rootPath,
	}

	return schema.Parse(p, specificConfigs...)
}

// TODO break this up into something that takes steps and knows what to do with them
// or shared code that's language specific?
func parseSchemasAndGenerate(cfg *codegen.Config, specificConfig, step string) error {
	schema, err := parseAllSchemaFiles(cfg.GetRootPathToConfigs(), specificConfig)
	if err != nil {
		return err
	}

	if len(schema.Nodes) == 0 {
		return nil
	}

	processor := &codegen.Processor{
		Schema: schema,
		Config: cfg,
	}

	steps := []codegen.Step{
		new(db.Step),
		new(code.Step),
		new(graphql.Step),
	}

	return processor.Run(steps, step, codegen.DisablePrompts())
}
