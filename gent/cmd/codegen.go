package cmd

import (
	"errors"
	"io/ioutil"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lolopinto/ent/internal/code"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

// flags
var (
	pathToConfig   string
	specificConfig string
	step           string
)

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	Args: func(cmd *cobra.Command, args []string) error {
		if pathToConfig == "" {
			return errors.New("path required")
		}
		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		codePathInfo := getPathToCode(pathToConfig)
		parseSchemasAndGenerate(codePathInfo, specificConfig, step)
	},
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

func parseAllSchemaFiles(rootPath string, specificConfigs ...string) *schema.Schema {
	p := &schemaparser.ConfigSchemaParser{
		AbsRootPath: rootPath,
	}

	return schema.Parse(p, specificConfigs...)
}

func parseSchemasAndGenerate(codePathInfo *codegen.CodePath, specificConfig, step string) {
	schema := parseAllSchemaFiles(codePathInfo.GetRootPathToConfigs(), specificConfig)

	if len(schema.Nodes) == 0 {
		return
	}

	// TOOD validate things here first.

	data := &codegen.Data{schema, codePathInfo}

	// TODO refactor these from being called sequentially to something that can be called in parallel
	// Right now, they're being called sequentially
	// I don't see any reason why some can't be done in parrallel
	// 0/ generate consts. has to block everything (not a plugin could be?) however blocking
	// 1/ db
	// 2/ create new nodes (blocked by db) since assoc_edge_config table may not exist yet
	// 3/ model files. should be able to run on its own
	// 4/ graphql should be able to run on its own

	steps := []codegen.Step{
		new(db.Step),
		new(code.Step),
		new(graphql.Step),
	}

	if step != "" {
		for _, s := range steps {
			if s.Name() == step {
				steps = []codegen.Step{s}
				break
			}
		}
		if len(steps) != 1 {
			util.Die(errors.New("invalid step passed"))
		}
	}

	for _, s := range steps {
		if err := s.ProcessData(data); err != nil {
			util.Die(err)
		}
	}
}
