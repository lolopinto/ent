package cmd

import (
	"errors"

	"github.com/lolopinto/ent/internal/code"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

// flags
var (
	specificConfig string
	step           string
)

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	Args:  configRequired,
	Run: func(cmd *cobra.Command, args []string) {
		codePathInfo := getPathToCode(pathToConfig)
		parseSchemasAndGenerate(codePathInfo, specificConfig, step)
	},
}

func parseAllSchemaFiles(rootPath string, specificConfigs ...string) *schema.Schema {
	p := &schemaparser.ConfigSchemaParser{
		AbsRootPath: rootPath,
	}

	return schema.Parse(p, specificConfigs...)
}

func parseSchemasAndGenerate(codePathInfo *codegen.CodePath, specificConfig, step string) {
	schema := parseAllSchemaFiles(codePathInfo.GetRootPathToConfigs(), specificConfig)

	if len(schema.Nodes) == 0 {
		return
	}

	// TOOD validate things here first.

	data := &codegen.Data{schema, codePathInfo}

	// TODO refactor these from being called sequentially to something that can be called in parallel
	// Right now, they're being called sequentially
	// I don't see any reason why some can't be done in parrallel
	// 0/ generate consts. has to block everything (not a plugin could be?) however blocking
	// 1/ db
	// 2/ create new nodes (blocked by db) since assoc_edge_config table may not exist yet
	// 3/ model files. should be able to run on its own
	// 4/ graphql should be able to run on its own

	steps := []codegen.Step{
		new(db.Step),
		new(code.Step),
		new(graphql.Step),
	}

	if step != "" {
		for _, s := range steps {
			if s.Name() == step {
				steps = []codegen.Step{s}
				break
			}
		}
		if len(steps) != 1 {
			util.Die(errors.New("invalid step passed"))
		}
	}

	for _, s := range steps {
		if err := s.ProcessData(data); err != nil {
			util.Die(err)
		}
	}
}
