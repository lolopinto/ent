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
	})

	addCommands(generateCmd, []*cobra.Command{
		generateSchemaCmd,
		generateEnumSchemaCmd,
		generateSchemasCmd,
	})

	rootCmd.PersistentFlags().BoolVar(&rootInfo.debug, "debug", false, "debug mode. add debug information to codegen e.g. files written etc")

	codegenCmd.Flags().StringVarP(&codegenInfo.step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, codegen")

	generateSchemasCmd.Flags().StringVar(&schemasInfo.file, "file", "", "file to get data from. also supports piping it through")
	generateSchemasCmd.Flags().BoolVar(&schemasInfo.force, "force", false, "if force is true, it overwrites existing schema, otherwise throws error")

	downgradeCmd.Flags().BoolVar(&downgradeInfo.keepSchemaFiles, "keep_schema_files", false, "keep schema files instead of deleting")
	upgradeCmd.Flags().BoolVar(&upgradeInfo.mergeBranches, "merge_branches", false, "merge branches found while upgrading")
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
