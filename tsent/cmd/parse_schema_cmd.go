package cmd

import (
	"os"

	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/spf13/cobra"
)

var parseSchemaCmd = &cobra.Command{
	Use:   "parse_schema",
	Short: "parses the schema without printing it. only exists for debugging purposes and not guaranteed to exist forever",
	RunE: func(cmd *cobra.Command, args []string) error {
		path, err := os.Getwd()
		if err != nil {
			return err
		}
		_, err = input.GetRawSchema(path, false)
		return err
	},
}
