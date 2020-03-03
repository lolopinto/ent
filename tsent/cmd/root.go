package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// for now, have different commands for the different languages
// will eventually combine or figure it out
// using different language so as to not make things annoying to use
var rootCmd = &cobra.Command{
	Use:   "tsent",
	Short: "tsent CLI",
	Long:  "CLI for interacting with the ent framework for typescript",
}

func init() {
	rootCmd.AddCommand(codegenCmd)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
