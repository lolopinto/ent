package cmd

import (
	"fmt"
	"os"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/prompt"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/spf13/cobra"
)

var deleteSchemaCmd = &cobra.Command{
	Use:   "delete_schema",
	Short: "deletes the given schema",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		schemaName := args[0]
		s, err := parseSchema()
		if err != nil {
			return err
		}

		nodeData, err := s.GetNodeDataForNode(schemaName)
		if err != nil {
			return fmt.Errorf("could not find schema %s", schemaName)
		}

		p := &prompt.YesNoQuestion{
			Question:  fmt.Sprintf("Are you sure you want to delete the '%s' schema. Note that this deletes all known files. If still referenced in the schema by another schema, there'll be an error later on. Y/N:", schemaName),
			NoHandler: prompt.ExitHandler,
		}

		if err := prompt.HandlePrompts([]prompt.Prompt{p}); err != nil {
			return err
		}

		if err := deleteFiles(nodeData); err != nil {
			return err
		}
		if err := deleteFolders(nodeData); err != nil {
			return err
		}

		s2, err := parseSchema()
		if err != nil {
			return err
		}
		var opts []codegen.ConstructOption
		if rootInfo.debug {
			opts = append(opts, codegen.DebugMode())
		}
		processor, err := codegen.NewCodegenProcessor(s2, "src/schema", opts...)
		if err != nil {
			return err
		}

		steps := []codegen.Step{
			new(db.Step),
			new(tscode.Step),
		}

		// db change and then run codegen again for just ent
		// do graphql later separately so that custom graphql isn't run yet
		// since it's done in the pre-process step and we want that only
		// to be run after the ent code is good
		if err := processor.Run(steps, ""); err != nil {
			return err
		}

		// run codegen for graphql now that ent code has been changed
		// can do custom graphql now
		steps2 := []codegen.Step{
			new(graphql.TSStep),
		}
		return processor.Run(steps2, "")
	},
}

func deleteFiles(nodeData *schema.NodeData) error {
	files := getFiles(nodeData)
	for _, file := range files {
		fi, err := os.Stat(file)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return err
		}
		if fi.IsDir() {
			return fmt.Errorf("%s is a directory, expected it to be a file. cannot delete", file)
		}
		if err := os.Remove(file); err != nil {
			return err
		}
	}
	return nil
}

func deleteFolders(nodeData *schema.NodeData) error {
	folders := getFolders(nodeData)
	for _, folder := range folders {
		fi, err := os.Stat(folder)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return err
		}
		if !fi.IsDir() {
			return fmt.Errorf("%s is not a directory, expected it to be one. cannot delete", folder)
		}
		if err := os.RemoveAll(folder); err != nil {
			return err
		}
	}
	return nil
}

func getFiles(nodeData *schema.NodeData) []string {
	packageName := nodeData.PackageName
	ret := []string{
		fmt.Sprintf("src/schema/%s.ts", packageName),
		fmt.Sprintf("src/ent/generated/%s_base.ts", packageName),
		fmt.Sprintf("src/ent/%s.ts", packageName),
		fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", packageName),
	}

	return ret
}

func getFolders(nodeData *schema.NodeData) []string {
	packageName := nodeData.PackageName
	ret := []string{
		fmt.Sprintf("src/ent/%s", packageName),
		fmt.Sprintf("src/graphql/resolvers/generated/%s", packageName),
		fmt.Sprintf("src/graphql/mutations/generated/%s", packageName),
	}

	return ret
}
