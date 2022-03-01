package cmd

import (
	"os"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/build"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
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
		currentSchema, err := parseSchema()
		if err != nil {
			return err
		}

		spew.Dump(build.NewBuildInfo(&build.Option{
			Time:          Time,
			DockerVersion: DockerVersion,
			User:          User,
		}))

		// nothing to do here
		if len(currentSchema.Nodes) == 0 {
			return nil
		}

		// module path empty because not go
		// same as ParseSchemaFromTSDir. default to schema. we want a flag here eventually
		processor, err := codegen.NewCodegenProcessor(currentSchema, "src/schema", "", rootInfo.debug)
		if err != nil {
			return err
		}

		// move this to processor so we have map to look at and pass along
		existingSchema := parseExistingSchema(processor.Config)
		spew.Dump(schema.CompareSchemas(existingSchema, currentSchema))

		// TODO changes. compare with existing schema instead of input
		//		input.CompareSchemas(existingSchema, schema.GetInputSchema())

		steps := []codegen.Step{
			// new(db.Step),
			// new(tscode.Step),
			// new(graphql.TSStep),
		}

		return processor.Run(steps, codegenInfo.step)
	},
}

func parseExistingSchema(cfg *codegen.Config) *schema.Schema {
	filepath := cfg.GetPathToSchemaFile()
	fi, _ := os.Stat(filepath)
	if fi == nil {
		return nil
	}
	b, err := os.ReadFile(filepath)
	if err != nil {
		return nil
	}

	existingSchema, err := input.ParseSchema(b)
	if err != nil {
		return nil
	}
	s, _ := schema.ParseFromInputSchema(existingSchema, base.TypeScript)
	return s
}
