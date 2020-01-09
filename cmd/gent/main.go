package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/util"

	flag "github.com/ogier/pflag"
)

// flags
var (
	pathToConfig   string
	specificConfig string
	upgrade        bool
	downgrade      string
	step           string
)

func init() {
	flag.StringVarP(&pathToConfig, "path", "p", "", "Path of config files")
	flag.StringVarP(&specificConfig, "config", "c", "", "Specific EntConfig to codegen")
	flag.BoolVar(&upgrade, "upgrade", false, "upgrade db")
	flag.StringVarP(&downgrade, "downgrade", "d", "", "downgrade db")
	flag.StringVarP(&step, "step", "s", "", "limit to only run a particular step e.g. db, graphql, code")
}

func main() {
	flag.Parse()

	printUsageIfNecessary()

	if upgrade {
		db.UpgradeDB()
	} else if downgrade != "" {
		db.DowngradeDB(downgrade)
	} else {
		codePathInfo := getPathToCode(pathToConfig)
		parseSchemasAndGenerate(codePathInfo, specificConfig, step)
	}
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

func printUsageIfNecessary() {
	if flag.NFlag() == 0 {
		printOptions()
		os.Exit(1)
	} else if upgrade || downgrade != "" {
		return
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
