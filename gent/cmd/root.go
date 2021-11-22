package cmd

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/filehelper"
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
	// needed across multiple commands
	rootCmd.PersistentFlags().StringVarP(&pathToConfig, "path", "p", "", "Path of config files")

	codegenCmd.Flags().StringVarP(&codegenInfo.specificConfig, "config", "c", "", "Specific EntConfig to codegen")
	codegenCmd.Flags().StringVarP(&codegenInfo.step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, codegen")

	initPhoneAuthCmd.Flags().StringVarP(&phoneAuth.node, "node", "n", "", "Required. Name of Node e.g. `User`")
	initPhoneAuthCmd.Flags().StringVarP(&phoneAuth.field, "field", "f", "", "Required. Name of Field e.g. `PhoneNumber`")
	initPhoneAuthCmd.Flags().StringVarP(&phoneAuth.viewerFunc, "viewerFunc", "v", "", "Optional. (Local) path to function which takes a viewer ID and returns a (ViewerContext, error) tuple. This is generated via `gent initViewer ...`.")
	initPhoneAuthCmd.Flags().BoolVar(&phoneAuth.forceOverwrite, "force", false, "to force file rewriting existing file. Note that it regenerates the existing key so be careful of this...")

	initViewerCmd.Flags().StringVarP(&viewerInfo.app, "app", "a", "", "Name of App e.g. `jarvis`")
	initViewerCmd.Flags().StringVarP(&viewerInfo.node, "node", "n", "", "Name of object which maps to user e.g. `User` or `Account`")
	initViewerCmd.Flags().BoolVar(&viewerInfo.forceViewerOverwrite, "force", false, "to force file rewriting existing file")

	initEmailAuthCmd.Flags().StringVarP(&emailAuth.node, "node", "n", "", "Required. Name of Node e.g. `User`")
	initEmailAuthCmd.Flags().StringVarP(&emailAuth.field, "field", "f", "", "Required. Name of Field e.g. `EmailAddress`")
	initEmailAuthCmd.Flags().StringVarP(&emailAuth.viewerFunc, "viewerFunc", "v", "", "Optional. (Local) path to function which takes a viewer ID and returns a (ViewerContext, error) tuple. This is generated via `gent initViewer ...`.")
	initEmailAuthCmd.Flags().BoolVar(&emailAuth.forceOverwrite, "force", false, "to force file rewriting existing file. Note that it regenerates the existing key so be careful of this...")

	rootCmd.AddCommand(upgradeCmd)
	rootCmd.AddCommand(downgradeCmd)
	rootCmd.AddCommand(codegenCmd)
	rootCmd.AddCommand(initPhoneAuthCmd)
	rootCmd.AddCommand(initViewerCmd)
	rootCmd.AddCommand(initEmailAuthCmd)
	rootCmd.AddCommand(fixEdgesCmd)
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

// for places where this isn't required...
func getPathToConfig() string {
	if pathToConfig == "" {
		return "models/configs"
	}
	return pathToConfig
}

func getPathToCode(pathToConfig string) (*codegen.Config, error) {
	dir, err := filepath.Abs(".")
	if err != nil {
		util.GoSchemaKill(err)
	}
	dir = filepath.ToSlash(dir)

	r := regexp.MustCompile(`module (.*)\n`)

	// walk up the tree until we find a go.mod file
	// and build the suffix that needs to be added to the end of the module found in a go.mod file
	result := filehelper.FindAndRead(dir, "go.mod")
	b := result.Bytes
	err = result.Error
	suffix := result.Suffix
	if err != nil {
		return nil, err
	}
	if b != nil {
		contents := string(b)

		match := r.FindStringSubmatch(contents)
		return codegen.NewConfig(pathToConfig, match[1]+suffix)
	}

	// no go.mod in the path
	// I can't even remember the exact logic I was doing here.
	// probably manually going up to find paths in gopaths that had . e.g. "github.com/lolopinto"
	// TODO fix this for non-module users
	abs, err := filepath.Abs(".")
	if err != nil {
		return nil, err
	}
	pathPastSymlinks, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return nil, err
	}
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
	return codegen.NewConfig(pathToConfig, path)
}
