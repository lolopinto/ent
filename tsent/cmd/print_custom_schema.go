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
		currentSchema, err := parseSchemaNoConfig()
		if err != nil {
			return err
		}
		processor, err := codegen.NewCodegenProcessor(currentSchema, "src/schema")
		if err != nil {
			return err
		}

		b, b2, err := graphql.ParseRawCustomData(processor, false)
		if err != nil {
			return err
		}
		fmt.Println(string(b))
		if b2 != nil {
			fmt.Println()
			fmt.Println("dynamic custom data")
			fmt.Println(string(b2))
		}
		return nil
	},
}
