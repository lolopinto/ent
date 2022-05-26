package cmd

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/fns"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/spf13/cobra"
)

type detectDanglingArgs struct {
	deleteFiles bool
}

var detectDanglingInfo detectDanglingArgs

var paths = []string{
	"src/ent/generated",
	"src/graphql/generated",
}

// list or delete
var detectDanglingFilesCmd = &cobra.Command{
	Use:   "detect_dangling",
	Short: "detects any dangling schema files",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}
		cfg.SetDummyWrite(true)

		s, err := parseSchemaFromConfig(cfg)
		if err != nil {
			return err
		}

		opts := []codegen.ConstructOption{
			codegen.ProcessorConfig(cfg),
			codegen.WriteAll(),
		}

		processor, err := codegen.NewCodegenProcessor(s, "src/schema", opts...)
		if err != nil {
			return err
		}

		steps := []codegen.Step{
			new(tscode.Step),
			new(graphql.TSStep),
		}
		if err := processor.Run(steps, ""); err != nil {
			return err
		}

		changed := make(map[string]bool)

		root := cfg.GetAbsPathToRoot()
		generated := getGeneratedPaths()
		for _, f := range cfg.GetChangedTSFiles() {
			rel, err := filepath.Rel(root, f)
			if err != nil {
				return err
			}
			for _, p := range generated {
				if strings.HasPrefix(rel, p) {
					changed[rel] = true
					break
				}
			}
		}

		dangling := []string{}
		for _, p := range generated {
			fmt.Println(p)
			if err := detectDangling(p, changed, &dangling); err != nil {
				return err
			}
		}

		if len(dangling) == 0 {
			fmt.Printf("no dangling files\n")
			return nil
		}

		fmt.Print("list of dangling files: \n")
		for _, f := range dangling {
			fmt.Printf("%s\n", f)
		}

		if !detectDanglingInfo.deleteFiles {
			return nil
		}

		var funcs fns.FunctionList
		for _, f := range dangling {
			funcs = append(funcs, file.GetDeleteFileFunction(cfg, f))
		}
		if err := fns.RunParallel(funcs); err != nil {
			return err
		}
		fmt.Println("successfully deleted!")
		return nil
	},
}

func detectDangling(root string, changed map[string]bool, dangling *[]string) error {
	return filepath.WalkDir(root, func(path string, info fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".ts" {
			return nil
		}
		if !changed[path] {
			*dangling = append(*dangling, path)
		}
		return nil
	})
}

func getGeneratedPaths() []string {
	if os.IsPathSeparator('/') {
		return paths
	}

	ret := make([]string, len(paths))
	for i, p := range paths {
		parts := strings.Split(p, "/")
		ret[i] = strings.Join(parts, string(os.PathSeparator))
	}
	return ret
}
