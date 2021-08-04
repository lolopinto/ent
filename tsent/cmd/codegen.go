package cmd

import (
	"os"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/spf13/cobra"
)

type codegenArgs struct {
	step  string
	debug bool
}

var codegenInfo codegenArgs

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	//	Args:  configRequired,
	RunE: func(cmd *cobra.Command, args []string) error {
		// assume we're running from base of directory
		path, err := os.Getwd()
		if err != nil {
			return err
		}

		inputSchema, err := input.ParseSchemaFromTSDir(path, false)
		if err != nil {
			return err
		}
		// need a codepath here...
		// instead of lang, we want Options
		// lang, pathToRoot, allowUserInput
		schema, err := schema.ParseFromInputSchema(inputSchema, base.TypeScript)
		if err != nil {
			return err
		}

		// nothing to do here
		if len(schema.Nodes) == 0 {
			return nil
		}

		// module path empty because not go
		// same as ParseSchemaFromTSDir. default to schema. we want a flag here eventually
		processor, err := codegen.NewCodegenProcessor(schema, "src/schema", "", codegenInfo.debug)
		if err != nil {
			return err
		}

		steps := []codegen.Step{
			new(db.Step),
			new(tscode.Step),
			new(graphql.TSStep),
		}

		return processor.Run(steps, codegenInfo.step)
	},
}
