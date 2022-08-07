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
	debug          bool
	disablePrompts bool
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
		migratev1Cmd,
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
	codegenCmd.Flags().BoolVar(&codegenInfo.disablePrompts, "disable_prompts", false, "disable prompts")
	codegenCmd.Flags().BoolVar(&codegenInfo.disableUpgrade, "disable_upgrade", false, "disable upgrade when running codegen. codegen automatically checks that the db is upgraded before making any changes. if you want to disable that for any reason, use this flag")

	generateSchemasCmd.Flags().StringVar(&schemasInfo.file, "file", "", "file to get data from. also supports piping it through")
	generateSchemasCmd.Flags().BoolVar(&schemasInfo.force, "force", false, "if force is true, it overwrites existing schema, otherwise throws error")

	downgradeCmd.Flags().BoolVar(&downgradeInfo.keepSchemaFiles, "keep_schema_files", false, "keep schema files instead of deleting")

	upgradeCmd.Flags().BoolVar(&upgradeInfo.sql, "sql", false, "--sql to generate sql for offline mode")

	deleteSchemaCmd.Flags().BoolVar(&deleteSchemaInfo.disablePrompts, "disable_prompts", false, "--disable_prompts to disable prompt verifying delete schema")

	alembicCmd.DisableFlagParsing = true

	detectDanglingFilesCmd.Flags().BoolVar(&detectDanglingInfo.deleteFiles, "delete", false, "--delete to indicate that we should delete detected dangling files")

	migratev1Cmd.Flags().StringVar(&migrateInfo.newSchemaClass, "new_schema_class", "", "new base schema class instead of EntSchema")
	migratev1Cmd.Flags().StringVar(&migrateInfo.oldBaseClass, "old_base_class", "", "old base schema class instead of BaseEntSchema")
	migratev1Cmd.Flags().StringVar(&migrateInfo.transformPath, "transform_path", "", "path for new base class")
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Printf("\u001b[31mError:\u001b[0m \n  %s\n", err.Error())
		fmt.Println(rootCmd.UsageString())
		os.Exit(1)
	}
}
