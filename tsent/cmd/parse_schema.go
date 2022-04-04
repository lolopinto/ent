package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
)

func parseSchemaImpl(cfg *codegen.Config) (*schema.Schema, error) {
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
	return schema.ParseFromInputSchema(cfg, inputSchema, base.TypeScript)
}

func parseSchemaFromConfig(cfg *codegen.Config) (*schema.Schema, error) {
	if !rootInfo.debug {
		return parseSchemaImpl(cfg)
	}
	t1 := time.Now()
	s, err := parseSchemaImpl(cfg)
	t2 := time.Now()
	diff := t2.Sub(t1)
	fmt.Println("parse schema took", diff)
	return s, err
}

func parseSchemaNoConfig() (*schema.Schema, error) {
	cfg, err := codegen.NewConfig("src/schema", "")
	if err != nil {
		return nil, err
	}
	return parseSchemaFromConfig(cfg)
}
