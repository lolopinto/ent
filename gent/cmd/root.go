package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "gent",
	Short: "gent CLI",
	Long:  "CLI for interacting with the ent framework",
}

func init() {
	codegenCmd.Flags().StringVarP(&pathToConfig, "path", "p", "", "Path of config files")
	codegenCmd.Flags().StringVarP(&specificConfig, "config", "c", "", "Specific EntConfig to codegen")
	codegenCmd.Flags().StringVarP(&step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, codegen")

	rootCmd.AddCommand(upgradeCmd)
	rootCmd.AddCommand(downgradeCmd)
	rootCmd.AddCommand(codegenCmd)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
