package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
)

// for now, have different commands for the different languages
// will eventually combine or figure it out
// using different language so as to not make things annoying to use
var rootCmd = &cobra.Command{
	Use:   "tsent",
	Short: "tsent CLI",
	Long:  "CLI for interacting with the ent framework for typescript",
	// handled ourselves
	SilenceErrors: true,
	SilenceUsage:  true,
}

type rootArgs struct {
	debug bool
}

var rootInfo rootArgs

func newRunE(fn func(cmd *cobra.Command, args []string) error) func(cmd *cobra.Command, args []string) error {
	return func(cmd *cobra.Command, args []string) error {
		if !rootInfo.debug {
			return fn(cmd, args)
		}
		t1 := time.Now()
		err := fn(cmd, args)
		t2 := time.Now()
		diff := t2.Sub(t1)
		fmt.Println("total time elapsed", diff)
		return err
	}
}

func newRun(fn func(cmd *cobra.Command, args []string)) func(cmd *cobra.Command, args []string) {
	return func(cmd *cobra.Command, args []string) {
		if !rootInfo.debug {
			fn(cmd, args)
			return
		}
		t1 := time.Now()
		fn(cmd, args)
		t2 := time.Now()
		diff := t2.Sub(t1)
		fmt.Println("total time elapsed", diff)
	}
}

func addCommands(parent *cobra.Command, children []*cobra.Command) {
	for _, command := range children {
		if command.RunE != nil {
			old := command.RunE
			command.RunE = newRunE(old)
		}
		if command.Run != nil {
			old := command.Run
			command.Run = newRun(old)
		}
		parent.AddCommand(command)
	}
}

func init() {
	addCommands(rootCmd, []*cobra.Command{
		codegenCmd,
		downgradeCmd,
		upgradeCmd,
		fixEdgesCmd,
		alembicCmd,
		generateCmd,
		squashCmd,
		printSchemaCmd,
		printCustomSchemaCmd,
		deleteSchemaCmd,
		detectDanglingFilesCmd,
	})

	addCommands(generateCmd, []*cobra.Command{
		generateSchemaCmd,
		generateEnumSchemaCmd,
		generateSchemasCmd,
	})

	rootCmd.PersistentFlags().BoolVar(&rootInfo.debug, "debug", false, "debug mode. add debug information to codegen e.g. files written etc")

	codegenCmd.Flags().StringVarP(&codegenInfo.step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, codegen")
	codegenCmd.Flags().BoolVar(&codegenInfo.writeAll, "write-all", false, "to force writing all files and skip the logic we have for only selectively writing some files")
	codegenCmd.Flags().BoolVar(&codegenInfo.disableCustomGraphQL, "disable-custom-graphql", false, "to disable custom graphql during codegen. used when we need to rebuild everything and minimize parsing code")

	generateSchemasCmd.Flags().StringVar(&schemasInfo.file, "file", "", "file to get data from. also supports piping it through")
	generateSchemasCmd.Flags().BoolVar(&schemasInfo.force, "force", false, "if force is true, it overwrites existing schema, otherwise throws error")

	downgradeCmd.Flags().BoolVar(&downgradeInfo.keepSchemaFiles, "keep_schema_files", false, "keep schema files instead of deleting")

	upgradeCmd.Flags().BoolVar(&upgradeInfo.sql, "sql", false, "--sql to generate sql for offline mode")

	alembicCmd.DisableFlagParsing = true

	detectDanglingFilesCmd.Flags().BoolVar(&detectDanglingInfo.deleteFiles, "delete", false, "--delete to indicate that we should delete detected dangling files")
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Printf("\033[31mError:\033[0m \n  %s\n", err.Error())
		fmt.Println(rootCmd.UsageString())
		os.Exit(1)
	}
}
