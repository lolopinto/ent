package cmd

import (
	"fmt"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/tsent/cmd/typeschema"
	"github.com/spf13/cobra"
)

// generate a schema
var generateSchemaCmd = &cobra.Command{
	Use:     "schema",
	Short:   "generate schema",
	Example: `tsent generate schema User name:string email:email`,
	Args:    cobra.MinimumNArgs(2),
	RunE: func(_ *cobra.Command, args []string) error {
		schema, err := parseSchema()
		if err != nil {
			return err
		}

		schemaName := base.GetCamelName(args[0])

		if schema.NodeNameExists(schemaName) {
			return fmt.Errorf("cannot generate a schema for %s since schema with name %s already exists", args[0], schemaName)
		}

		codePathInfo, err := codegen.NewCodePath("src/schema", "")
		if err != nil {
			return err
		}

		return typeschema.ParseAndGenerateSchema(codePathInfo, schemaName, args[1:])
	},
}
