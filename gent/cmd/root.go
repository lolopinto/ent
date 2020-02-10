package cmd

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "gent",
	Short: "gent CLI",
	Long:  "CLI for interacting with the ent framework",
}

var pathToConfig string

func init() {
	// needed across multiple command
	rootCmd.PersistentFlags().StringVarP(&pathToConfig, "path", "p", "", "Path of config files")

	codegenCmd.Flags().StringVarP(&specificConfig, "config", "c", "", "Specific EntConfig to codegen")
	codegenCmd.Flags().StringVarP(&step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, codegen")

	initPhoneAuthCmd.Flags().StringVarP(&node, "node", "n", "", "Required. Name of Node e.g. `User`")
	initPhoneAuthCmd.Flags().StringVarP(&field, "field", "f", "", "Required. Name of Field e.g. `PhoneNumber`")
	initPhoneAuthCmd.Flags().StringVarP(&viewerFunc, "viewerFunc", "v", "", "Optional. (Local) path to function which takes a viewer ID and returns a (ViewerContext, error) tuple. This is generated via `gent initViewer ...`.")
	initPhoneAuthCmd.Flags().BoolVar(&forceOverwrite, "force", false, "to force file rewriting existing file")

	rootCmd.AddCommand(upgradeCmd)
	rootCmd.AddCommand(downgradeCmd)
	rootCmd.AddCommand(codegenCmd)
	rootCmd.AddCommand(initPhoneAuthCmd)

}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func configRequired(cmd *cobra.Command, args []string) error {
	if pathToConfig == "" {
		return errors.New("path required")
	}
	return nil
}

func getPathToCode(pathToConfig string) *codegen.CodePath {
	dir, err := filepath.Abs(".")
	util.Die(err)
	dir = filepath.ToSlash(dir)

	r := regexp.MustCompile(`module (.*)\n`)

	// walk up the tree until we find a go.mod file
	// and build the suffix that needs to be added to the end of the module found in a go.mod file
	curDir := dir
	suffix := ""

	for {
		b, err := ioutil.ReadFile(filepath.Join(curDir, "/", "go.mod"))
		if err == nil {
			contents := string(b)

			match := r.FindStringSubmatch(contents)
			return codegen.NewCodePath(pathToConfig, match[1]+suffix)
		}

		suffix = "/" + filepath.Base(curDir) + suffix
		// go up one directory
		curDir, err = filepath.Abs(filepath.Join(curDir, ".."))
		util.Die(err)

		// got all the way to the top. bye felicia
		if curDir == "/" {
			break
		}
	}

	// no go.mod in the path
	// I can't even remember the exact logic I was doing here.
	// probably manually going up to find paths in gopaths that had . e.g. "github.com/lolopinto"
	// TODO fix this for non-module users
	abs, err := filepath.Abs(".")
	util.Die(err)
	pathPastSymlinks, err := filepath.EvalSymlinks(abs)
	// TODO: probably better to put this in some yml file but we're not there yet so reading from the filesystem instead...
	pathParts := strings.Split(pathPastSymlinks, string(filepath.Separator))

	var idx int
	for i := len(pathParts) - 1; i > 0; i-- {
		part := pathParts[i]
		if len(strings.Split(part, ".")) > 1 {
			idx = i
			break
		}
	}
	path := strings.Join(pathParts[idx:], string(filepath.Separator))
	return codegen.NewCodePath(pathToConfig, path)
}
