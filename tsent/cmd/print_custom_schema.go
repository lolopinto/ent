package cmd

import (
	"fmt"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/spf13/cobra"
)

var printCustomSchemaCmd = &cobra.Command{
	Use:   "print_custom_schema",
	Short: "prints the parsed custom graphql schema. only exists for debugging purposes and not guaranteed to exist forever",
	RunE: func(cmd *cobra.Command, args []string) error {
		currentSchema, err := parseSchema()
		if err != nil {
			return err
		}
		processor, err := codegen.NewCodegenProcessor(currentSchema, "src/schema")
		if err != nil {
			return err
		}

		b, err := graphql.ParseRawCustomData(processor, false)
		if err != nil {
			return err
		}
		fmt.Println(string(b))
		return nil
	},
}
