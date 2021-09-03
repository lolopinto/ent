package cmd

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/tsent/cmd/generateschema"
	"github.com/spf13/cobra"
)

// generate enum schema
var generateEnumSchemaCmd = &cobra.Command{
	Use:   "enum_schema",
	Short: "generate enum schema",
	Long: `generate an enum in the schema with a backed table.
Takes 3 arguments:
1. enumSchema name
2. enum column
3. csv of enum values
e.g. tsent generate enum_schema RequestStatus status open,pending,closed`,
	Example: `tsent generate enum_schema RequestStatus status open,pending,closed`,

	// RequestStatus status open,pending,closed
	Args: cobra.ExactArgs(3),
	RunE: func(_ *cobra.Command, args []string) error {
		schema, err := parseSchema()
		if err != nil {
			return err
		}

		schemaName := base.GetCamelName(args[0])

		if schema.NameExists(schemaName) {
			return fmt.Errorf("cannot generate a schema for %s since schema with name already exists", schemaName)
		}

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		return generateschema.GenerateSingleSchema(
			cfg,
			generateschema.NewEnumCodegenData(cfg, schemaName, args[1], strings.Split(args[2], ",")),
			schemaName,
		)
	},
}
