package cmd

import (
	"os"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
)

func parseSchema() (*schema.Schema, error) {
	// assume we're running from base of directory
	path, err := os.Getwd()
	if err != nil {
		return nil, err
	}

	inputSchema, err := input.ParseSchemaFromTSDir(path, false)
	if err != nil {
		return nil, err
	}
	// need a codepath here...
	// instead of lang, we want Options
	// lang, pathToRoot, allowUserInput
	return schema.ParseFromInputSchema(inputSchema, base.TypeScript)
}
