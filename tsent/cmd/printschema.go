package cmd

import (
	"fmt"
	"os"

	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/spf13/cobra"
)

var printSchemaCmd = &cobra.Command{
	Use:   "print-schema",
	Short: "prints the parsed schema. only exists for debugging purposes and not guaranteed to exist forever",
	RunE: func(cmd *cobra.Command, args []string) error {
		path, err := os.Getwd()
		if err != nil {
			return err
		}
		b, err := input.GetRawSchema(path, false)
		if err != nil {
			return err
		}
		fmt.Println(string(b))
		return nil
	},
}
