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
	rootCmd.AddCommand(downgradeCmd)
	rootCmd.AddCommand(upgradeCmd)
	rootCmd.AddCommand(fixEdgesCmd)
	rootCmd.AddCommand(alembicCmd)
	rootCmd.AddCommand(generateCmd)

	generateCmd.AddCommand(generateSchemaCmd)
	generateCmd.AddCommand(generateEnumSchemaCmd)
	generateCmd.AddCommand(generateSchemasCmd)

	codegenCmd.Flags().StringVarP(&codegenInfo.step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, codegen")
	codegenCmd.Flags().BoolVar(&codegenInfo.debug, "debug", false, "debug mode. add debug information to codegen e.g. files written etc")

	generateSchemasCmd.Flags().StringVar(&schemasInfo.file, "file", "", "file to get data from. also supports piping it through")
	generateSchemasCmd.Flags().BoolVar(&schemasInfo.force, "force", false, "if force is true, it overwrites existing schema, otherwise throws error")
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
