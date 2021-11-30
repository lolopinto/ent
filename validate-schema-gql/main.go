package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/google/go-github/v41/github"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"golang.org/x/oauth2"
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

var paths = []string{
	"../examples/simple",
	"../examples/ent-rsvp/backend",
	"../examples/todo-sqlite",
}

func main() {
	var wg sync.WaitGroup
	wg.Add(len(paths))
	for i := range paths {
		go func(i int) {
			defer wg.Done()
			r := <-compareSchemas(paths[i])
			if r.equal {
				fmt.Println(r.rootPath, "equal")
			} else {
				fmt.Println(r.rootPath, "not equal")
				createGHIssue(r)
				//				fmt.Println(r.dmp.DiffPrettyText(r.diffs))
			}
		}(i)
	}
	wg.Wait()
}

type result struct {
	rootPath string
	equal    bool
	dmp      *diffmatchpatch.DiffMatchPatch
	diffs    []diffmatchpatch.Diff
}

func compareSchemas(rootPath string) <-chan result {
	r := make(chan result)
	go func() {
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
			r <- result{
				rootPath: rootPath,
				equal:    true,
			}
			return
		} else {

			dmp := diffmatchpatch.New()
			diffs := dmp.DiffMain(buf.String(), buf2.String(), false)

			r <- result{
				rootPath: rootPath,
				equal:    false,
				dmp:      dmp,
				diffs:    diffs,
			}
			return
		}
	}()
	return r
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

func createGHIssue(r result) {
	ctx := context.Background()
	sts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	oc := oauth2.NewClient(ctx, sts)
	client := github.NewClient(oc)

	title := fmt.Sprintf("schema.gql not consistent with graphql-js in example %s", filepath.Base(r.rootPath))
	body := fmt.Sprintf(
		"```diff\n" +
			r.dmp.DiffPrettyText(r.diffs) +
			"```")
	labels := []string{"graphql"}

	iss, _, err := client.Issues.Create(ctx, "lolopinto", "ent", &github.IssueRequest{
		Title:  &title,
		Body:   &body,
		Labels: &labels,
	})

	if err != nil {
		fmt.Printf("error creating new issue %v\n", err)
	} else {
		fmt.Printf("issue %v created\n", *iss.Number)
	}
}
