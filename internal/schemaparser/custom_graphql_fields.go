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
	// TODO rename Argument to Field or something similar to Ast
	Results []Argument // results when there's more than one result // Type should be null at that point...
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

type CustomCodeParser interface {
	ReceiverRequired() bool
}

type CustomCodeParserWithReceiver interface {
	CustomCodeParser
	ValidateFnReceiver(name string) error
}

type ParseCustomGQLResult struct {
	// TODO add a type def for this
	ParsedItems map[string][]ParsedItem
	Error       error
}

func ParseCustomGraphQLDefinitions(parser Parser, codeParser CustomCodeParser) chan ParseCustomGQLResult {
	result := make(chan ParseCustomGQLResult)
	go parseCustomGQL(parser, codeParser, result)
	return result
}

func parseCustomGQL(parser Parser, codeParser CustomCodeParser, out chan ParseCustomGQLResult) {
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
			err := checkForCustom(filename, pkg, pkg.Syntax[idx], codeParser, l)
			if err != nil {
				errr = err
			}
		}()
	}

	wg.Wait()
	var result ParseCustomGQLResult
	if errr != nil {
		result.Error = errr
	} else {
		result.ParsedItems = l.items
	}
	out <- result
}

func checkForCustom(
	filename string,
	pkg *packages.Package,
	file *ast.File,
	codeParser CustomCodeParser,
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

		validateFnParser, ok := codeParser.(CustomCodeParserWithReceiver)
		if ok {
			for _, field := range fn.Recv.List {
				info := astparser.GetFieldTypeInfo(field)
				if err := validateFnParser.ValidateFnReceiver(info.Name); err != nil {
					return err
				}

				graphqlNode = info.Name
				break
			}
		}

		// hmm GetPrivacyPolicy and other overriden methods here
		// where should this logic be?
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

				// fn is not a method and this is required return an error
				// TODO this is conflating multiple things as of right now.
				// Let's see how this changes and if we can come up with a generic term for this
				if codeParser.ReceiverRequired() {
					if fn.Recv == nil {
						return fmt.Errorf("graphql function %s is not on a valid receiver", fn.Name.Name)
					}

					if !fn.Name.IsExported() {
						return fmt.Errorf("graphql function %s is not exported", fn.Name.Name)
					}
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
	fnName := fn.Name.Name

	// TODO: or mutation
	if graphqlNode == "" {
		graphqlNode = "Query"
	}

	item := ParsedItem{
		NodeName:     graphqlNode,
		FunctionName: fnName,
		// remove Get prefix if it exists
		GraphQLName: strcase.ToLowerCamel(strings.TrimPrefix(fnName, "Get")),
	}

	if err := modifyItemFromCG(cg, &item); err != nil {
		return err
	}

	results := fn.Type.Results.List
	// TODO need to handle objects with no result...

	if len(results) == 1 {
		resultType := pkg.TypesInfo.TypeOf(results[0].Type)
		item.Type = enttype.GetType(resultType)
	} else {

		args, err := getArgs(pkg, results)
		if err != nil {
			return err
		}
		item.Results = args
	}
	// next step, awareness of context in argument, last result including error?
	// or that's a different layer?

	args, err := getArgs(pkg, fn.Type.Params.List)
	if err != nil {
		return err
	}
	item.Args = args
	l.AddItem(item)
	return nil
}

func getArgs(pkg *packages.Package, list []*ast.Field) ([]Argument, error) {
	args := make([]Argument, len(list))
	for idx, item := range list {
		// name required for now. TODO...

		if len(item.Names) != 1 {
			return nil, errors.New("invalid number of names for param")
		}
		paramType := pkg.TypesInfo.TypeOf(item.Type)
		arg := Argument{
			Name: item.Names[0].Name,
			Type: enttype.GetType(paramType),
		}
		args[idx] = arg
	}
	return args, nil
}

func modifyItemFromCG(cg *ast.CommentGroup, item *ParsedItem) error {
	splits := strings.Split(cg.Text(), "\n")
	for _, s := range splits {
		if strings.HasPrefix(s, "@graphql") {
			parts := strings.Split(s, " ")
			if len(parts) == 1 {
				// nothing to do here
				return nil
			}
			// override the name we should use
			item.GraphQLName = parts[1]

			if len(parts) > 2 {
				if parts[2] != "Query" && parts[2] != "Mutation" {
					return errors.New("invalid query/Mutation syntax")
				}
				item.NodeName = parts[2]
			}
			return nil
		}
	}
	return nil
}
