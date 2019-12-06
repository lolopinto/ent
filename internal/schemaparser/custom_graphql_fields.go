package schemaparser

import (
	"errors"
	"fmt"
	"go/ast"
	"regexp"
	"strings"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"golang.org/x/tools/go/packages"
)

// TODO rename?
type ParsedItem struct {
	NodeName     string     // e.g. User/Contact etc
	GraphQLName  string     // GraphQLName
	FunctionName string     // FunctionName
	Type         string     // GraphQL return type
	Args         []Argument // input arguments
}

type Argument struct {
	Name string
	Type string // for now we should only support scalar arguments
}

type parsedList struct {
	m     sync.RWMutex
	items []ParsedItem
}

func (l *parsedList) AddItem(item ParsedItem) {
	l.m.Lock()
	defer l.m.Unlock()
	l.items = append(l.items, item)
}

func ParseCustomGraphQLDefinitions(path string, validTypes map[string]bool) ([]ParsedItem, error) {
	r := regexp.MustCompile(`(\w+)_gen.go`)

	mode := packages.LoadTypes | packages.LoadSyntax
	cfg := &packages.Config{Mode: mode}

	pkgs, err := packages.Load(cfg, path)
	if err != nil {
		return nil, err
	}

	// TODO error list type again...
	hasErrors := false
	for _, pkg := range pkgs {
		if len(pkg.Errors) > 0 {
			for _, err := range pkg.Errors {
				spew.Dump("err: ", err)
				hasErrors = true
			}
		}
	}

	if hasErrors {
		return nil, errors.New("error parsing package")
	}

	l := &parsedList{}
	var wg sync.WaitGroup

	var errr error
	for _, pkg := range pkgs {

		for idx := range pkg.CompiledGoFiles {
			idx := idx
			filename := pkg.CompiledGoFiles[idx]
			match := r.FindStringSubmatch(filename)
			// we don't want generated files
			if len(match) == 2 {
				continue
			}

			wg.Add(1)
			go func() {
				defer wg.Done()
				err := checkForCustom(filename, pkg.Syntax[idx], validTypes, l)
				if err != nil {
					errr = err
				}
			}()
		}
	}
	wg.Wait()
	if errr != nil {
		return nil, errr
	}
	return l.items, nil
}

func checkForCustom(filename string, file *ast.File, validTypes map[string]bool, l *parsedList) error {
	expectedFnNames := map[string]bool{
		"GetPrivacyPolicy": true,
	}

	var graphqlComments []*ast.CommentGroup
	for _, cg := range file.Comments {
		splits := strings.Split(cg.Text(), "\n")
		for _, s := range splits {
			if strings.HasPrefix(s, "@graphql") {
				//				spew.Dump(cg.Text(), cg.Pos(), cg.End())
				graphqlComments = append(graphqlComments, cg)
				break
			}
		}
	}

	if len(graphqlComments) == 0 {
		return nil
	}
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)

		if !ok {
			continue
		}
		// fn is not a method we don't care
		if fn.Recv == nil {
			return fmt.Errorf("graphql function %s is not on a valid receiver", fn.Name.Name)
		}

		graphqlNode := ""
		for _, field := range fn.Recv.List {
			name := astparser.GetFieldTypeName(field)
			// TODO Bar not valid and we should eventually throw an error here
			if validTypes[name] {
				graphqlNode = name
				break
			}
		}
		if graphqlNode == "" {
			continue
		}

		if expectedFnNames[fn.Name.Name] {
			continue
		}
		// allow one blank line there
		// this is not the most efficient since we're doing a for loop
		// TODO: optimize this and go through each comment one at a time?
		// Decls not guaranteed to be sorted so we should sort both and go through each in order...
		for _, cg := range graphqlComments {
			diff := cg.End() + 2 - fn.Pos()
			if diff >= 0 && diff <= 1 {

				if !fn.Name.IsExported() {
					return fmt.Errorf("graphql function %s is not exported", fn.Name.Name)
				}
				if err := addItem(fn, cg, l, graphqlNode); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}

func addItem(fn *ast.FuncDecl, cg *ast.CommentGroup, l *parsedList, graphqlNode string) error {
	results := fn.Type.Results.List
	if len(results) != 1 {
		return errors.New("TODO: need to handle objects with more than one result")
	}
	fnName := fn.Name.Name

	item := ParsedItem{
		NodeName:     graphqlNode,
		FunctionName: fnName,
		// remove Get prefix if it exists
		GraphQLName: strcase.ToLowerCamel(strings.TrimPrefix(fnName, "Get")),
		Type:        astparser.GetFieldTypeName(results[0]),
	}

	for _, param := range fn.Type.Params.List {
		if len(param.Names) != 1 {
			return errors.New("invalid number of names for param")
		}
		arg := Argument{
			Name: param.Names[0].Name,
			Type: astparser.GetFieldTypeName(param),
		}
		item.Args = append(item.Args, arg)
	}
	l.AddItem(item)
	return nil
}
