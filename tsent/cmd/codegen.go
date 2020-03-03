package cmd

import (
	"os"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/spf13/cobra"
)

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

		schema, err := input.ParseSchemaFromTSDir(path)
		if err != nil {
			return err
		}
		spew.Dump(schema)

		return nil
	},
}
