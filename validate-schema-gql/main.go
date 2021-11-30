package main

import (
	"bytes"
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
)

func bye(s string) {
	fmt.Println(s)
	os.Exit(1)
}

func byeErr(err error) {
	if err != nil {
		spew.Dump(err)
		bye(err.Error())
	}
}

// compares hand-generated schema.gql with the one
// from graphql-js and verifies they're equivalent
//  DB_CONNECTION_STRING=sqlite:/// go run .
// TODO run this once a week or so and generate a task if not equal
func main() {
	compareSchemas("../examples/simple")
	compareSchemas("../examples/ent-rsvp/backend")
	compareSchemas("../examples/todo-sqlite")
}

func compareSchemas(rootPath string) {
	var err error
	rootPath, err = filepath.Abs(rootPath)
	byeErr(err)

	s1 := parseExistingSchema(rootPath)
	s2 := parseSchemaFromExample(rootPath)
	var buf bytes.Buffer
	var buf2 bytes.Buffer
	f := formatter.NewFormatter(&buf)
	f.FormatSchema(s1)
	f2 := formatter.NewFormatter(&buf2)
	f2.FormatSchema(s2)

	if buf.String() == buf2.String() {
		fmt.Println(rootPath, "equal")
	} else {
		fmt.Println(rootPath, "not equal")
		dmp := diffmatchpatch.New()
		diffs := dmp.DiffMain(buf.String(), buf2.String(), false)
		fmt.Println(dmp.DiffPrettyText(diffs))
	}
}

func parseExistingSchema(rootPath string) *ast.Schema {
	b, err := os.ReadFile(path.Join(rootPath, "src/graphql/generated/schema.gql"))
	byeErr(err)

	return parseSchemaFromInput(string(b))
}

func parseSchemaFromInput(input string) *ast.Schema {
	s, err := gqlparser.LoadSchema(&ast.Source{
		Input: input,
	})

	// have to do the comparison here...
	if err != nil {
		byeErr(err)

	}

	return s
}

type config struct {
	pathToRoot string
}

func (cfg *config) GeneratedHeader() string {
	return ""
}

func (cfg *config) DebugMode() bool {
	return true
}

func (cfg *config) GetAbsPathToRoot() string {
	return cfg.pathToRoot
}

func parseSchemaFromExample(rootPath string) *ast.Schema {
	cfg := &config{pathToRoot: rootPath}

	if err := graphql.GenerateFSBasedSchemaFile(cfg); err != nil {
		byeErr(err)
	}

	tempFile := path.Join(rootPath, "src/graphql/generated/temp_schema.gql")
	b, err := os.ReadFile(tempFile)
	defer os.Remove(tempFile)

	byeErr(err)

	return parseSchemaFromInput(string(b))
}
