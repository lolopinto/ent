package cmd

import (
	"github.com/spf13/cobra"
)

var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "generate a schema or other object",
	Example: `tsent generate schema User name:string
	`,
	Args: cobra.MinimumNArgs(1),
	// no Run or RunE. child commands do the work
}
