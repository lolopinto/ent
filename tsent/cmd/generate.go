package cmd

import (
	"github.com/spf13/cobra"
)

// etc
var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "generate something",
	Long:  `generates schema given things. TODO`,
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		// codePathInfo, err := codegen.NewCodePath("src/schema", "")
		// if err != nil {
		// 	return err
		// }

		// return db.DowngradeDB(codePathInfo, args[0])
		return nil
	},
}
