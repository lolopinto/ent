package cmd

import (
	"os"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/build"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/spf13/cobra"
)

// DockerVersion encompasses go or auto_schema
var DockerVersion string

// whose computer e.g. local or root
var User string

// if build time is same time...
var Time string

type codegenArgs struct {
	step string
}

var codegenInfo codegenArgs

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	//	Args:  configRequired,
	RunE: func(cmd *cobra.Command, args []string) error {
		schema, err := parseSchema()
		if err != nil {
			return err
		}

		spew.Dump(build.NewBuildInfo(&build.Option{
			Time:          Time,
			DockerVersion: DockerVersion,
			User:          User,
		}))

		// nothing to do here
		if len(schema.Nodes) == 0 {
			return nil
		}

		// module path empty because not go
		// same as ParseSchemaFromTSDir. default to schema. we want a flag here eventually
		processor, err := codegen.NewCodegenProcessor(schema, "src/schema", "", rootInfo.debug)
		if err != nil {
			return err
		}

		existingSchema := parseExistingSchema(processor.Config)
		// TODO changes...
		input.CompareSchemas(existingSchema, schema.GetInputSchema())

		steps := []codegen.Step{
			// new(db.Step),
			// new(tscode.Step),
			// new(graphql.TSStep),
		}

		return processor.Run(steps, codegenInfo.step)
	},
}

func parseExistingSchema(cfg *codegen.Config) *input.Schema {
	filepath := cfg.GetPathToSchemaFile()
	fi, _ := os.Stat(filepath)
	if fi == nil {
		return nil
	}
	b, err := os.ReadFile(filepath)
	if err != nil {
		return nil
	}

	existingSchema, _ := input.ParseSchema(b)
	return existingSchema
}
