package schemaparser

import (
	"errors"
	"fmt"
	"go/ast"
	"regexp"
	"strings"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/enttype"
	"golang.org/x/tools/go/packages"
)

// TODO rename?
type ParsedItem struct {
	NodeName     string // e.g. User/Contact etc
	GraphQLName  string // GraphQLName
	FunctionName string // FunctionName
	Type         enttype.FieldType
	Args         []Argument // input arguments
}

type Argument struct {
	Name string
	Type enttype.FieldType
}

type parsedList struct {
	m     sync.RWMutex
	items map[string][]ParsedItem
}

func (l *parsedList) AddItem(item ParsedItem) {
	l.m.Lock()
	defer l.m.Unlock()
	if l.items == nil {
		l.items = make(map[string][]ParsedItem)
	}
	l.items[item.NodeName] = append(l.items[item.NodeName], item)
}

func ParseCustomGraphQLDefinitions(parser Parser, validTypes map[string]bool) (map[string][]ParsedItem, error) {
	// LoadPackage enforces only 1 package returned and that files are the same.
	// if that changes in the future, we need to change this
	pkg := LoadPackage(parser)

	l := &parsedList{}
	var wg sync.WaitGroup

	r := regexp.MustCompile(`(\w+)_gen.go`)
	var errr error

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
			err := checkForCustom(filename, pkg, pkg.Syntax[idx], validTypes, l)
			if err != nil {
				errr = err
			}
		}()
	}

	wg.Wait()
	if errr != nil {
		return nil, errr
	}
	return l.items, nil
}

func checkForCustom(
	filename string,
	pkg *packages.Package,
	file *ast.File,
	validTypes map[string]bool,
	l *parsedList,
) error {
	expectedFnNames := map[string]bool{
		"GetPrivacyPolicy": true,
	}

	var graphqlComments []*ast.CommentGroup
	for _, cg := range file.Comments {
		splits := strings.Split(cg.Text(), "\n")
		for _, s := range splits {
			if strings.HasPrefix(s, "@graphql") {
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

		graphqlNode := ""
		for _, field := range fn.Recv.List {
			info := astparser.GetFieldTypeInfo(field)
			if !validTypes[info.Name] {
				return fmt.Errorf("invalid type %s should not have @graphql decoration", info.Name)
			}

			graphqlNode = info.Name
			break
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
				// fn is not a method, return an error
				if fn.Recv == nil {
					return fmt.Errorf("graphql function %s is not on a valid receiver", fn.Name.Name)
				}

				if err := addItem(fn, pkg, cg, l, graphqlNode); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}

func addItem(
	fn *ast.FuncDecl,
	pkg *packages.Package,
	cg *ast.CommentGroup,
	l *parsedList,
	graphqlNode string,
) error {
	results := fn.Type.Results.List
	if len(results) != 1 {
		return errors.New("TODO: need to handle objects with more than one result")
	}
	fnName := fn.Name.Name

	resultType := pkg.TypesInfo.TypeOf(results[0].Type)
	item := ParsedItem{
		NodeName:     graphqlNode,
		FunctionName: fnName,
		// remove Get prefix if it exists
		GraphQLName: strcase.ToLowerCamel(strings.TrimPrefix(fnName, "Get")),
		Type:        enttype.GetType(resultType),
	}

	for _, param := range fn.Type.Params.List {
		if len(param.Names) != 1 {
			return errors.New("invalid number of names for param")
		}
		paramType := pkg.TypesInfo.TypeOf(param.Type)
		arg := Argument{
			Name: param.Names[0].Name,
			Type: enttype.GetType(paramType),
		}
		item.Args = append(item.Args, arg)
	}
	l.AddItem(item)
	return nil
}
