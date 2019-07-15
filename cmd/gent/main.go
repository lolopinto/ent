package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/internal/util"
	flag "github.com/ogier/pflag"
)

// flags
var (
	pathToConfig   string
	specificConfig string
)

func init() {
	flag.StringVarP(&pathToConfig, "path", "p", "", "Path of config files")
	flag.StringVarP(&specificConfig, "config", "c", "", "Specific EntConfig to codegen")
}

func main() {
	flag.Parse()

	printUsageIfNecessary()

	// absolute path
	// dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// fmt.Println(dir)

	codePathInfo := getPathToCode(pathToConfig)
	parseSchemasAndGenerate(pathToConfig, specificConfig, codePathInfo)
}

type codePath struct {
	PathToConfigs string
	PathToModels  string
}

func getPathToCode(pathToConfig string) *codePath {
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
	cp := strings.Join(pathParts[idx:], string(filepath.Separator))
	return &codePath{
		PathToConfigs: strconv.Quote(filepath.Join(cp, pathToConfig)),
		PathToModels:  strconv.Quote(filepath.Join(cp, "models")),
	}
}

func printUsageIfNecessary() {
	if flag.NFlag() == 0 {
		printOptions()
		os.Exit(1)
	} else if pathToConfig == "" {
		printOptions()
		fmt.Println("Need to pass in path to config files")
		os.Exit(1)
	}
}

func printOptions() {
	fmt.Printf("Usage: %s [options]\n", os.Args[0])
	fmt.Println("Options:")
	flag.PrintDefaults()
}
