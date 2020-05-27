package cmd

import (
	"os"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/spf13/cobra"
)

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
		// assume we're running from base of directory
		path, err := os.Getwd()
		if err != nil {
			return err
		}
		// TODO init generates schema, db, tsconfig etc

		inputSchema, err := input.ParseSchemaFromTSDir(path, false)
		if err != nil {
			return err
		}
		schema, err := schema.ParseFromInputSchema(inputSchema)
		if err != nil {
			return err
		}

		// nothing to do here
		if len(schema.Nodes) == 0 {
			return nil
		}

		// module path empty because not go
		// same as ParseSchemaFromTSDir. default to schema. we want a flag here eventually
		codePathInfo := codegen.NewCodePath("src/schema", "")

		data := &codegen.Data{
			Schema:   schema,
			CodePath: codePathInfo,
		}

		steps := []codegen.Step{
			// new(db.Step),
			// new(tscode.Step),
			// we only want graphql for now
			new(graphql.TSStep),
		}
		return codegen.RunSteps(data, steps, codegenInfo.step)
	},
}
