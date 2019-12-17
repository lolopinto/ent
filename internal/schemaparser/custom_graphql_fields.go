package schemaparser

import (
	"errors"
	"fmt"
	"go/ast"
	"strings"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/enttype"
	"golang.org/x/tools/go/packages"
)

// Function represents a function that's parsed and needs to be represented in GraphQL
type Function struct {
	// e.g. User/Contact etc
	NodeName string
	// GraphQLName is the name of the Field in GraphQL
	GraphQLName string
	// FunctionName is the function that should be called in codegen. It includes the package if not in the "graphql"
	FunctionName string
	// Type represents the Type of the result when there's one return item. If it's nil, see Results for list of results
	Type enttype.FieldType
	// Args are the arguments to the function
	Args []*Field
	// Results shows the list of return values of the function. It should either have 2 or more items or be an empty slice. See Type
	Results []*Field
	// ImportPath, when null indicates path that needs to be imported for this to work
	ImportPath string
}

// Field represents an item in an argument list or return list for a function
type Field struct {
	// Name of the field in argument or return list
	Name string
	Type enttype.FieldType
}

// FunctionMap is a Map of GraphQL Type to list of Functions that need to be added to GQL
type FunctionMap map[string][]*Function

// ParseCustomGQLResult is the result object of parsing the code path given
type ParseCustomGQLResult struct {
	ParsedItems FunctionMap
	Error       error
}

// this is used to make concurrent changes to the map
type parsedList struct {
	m   sync.RWMutex
	fns FunctionMap
}

func (l *parsedList) AddFunction(fn *Function) {
	l.m.Lock()
	defer l.m.Unlock()
	if l.fns == nil {
		l.fns = make(FunctionMap)
	}
	l.fns[fn.NodeName] = append(l.fns[fn.NodeName], fn)
}

// CustomCodeParser is used to configure the parsing process
type CustomCodeParser interface {
	// ReceiverRequired validates if the receiver of a function is required or not
	// e.g. can the function be a standalone function or does it have to be a method?
	// To further process if the method is of a valid struct, see CustomCodeParserWithReceiver
	// where we can evaluate to see that only methods of acceptable structs are parsed
	// A return value of true indicates it's a method and not a function
	ReceiverRequired() bool

	// ProcessFileName is used to indicate if the filename should be evaluated.
	// eg.. don't process these generated files since there wouldn't be any custom functions there
	// A return value of true indicates the file will be processed
	ProcessFileName(string) bool
}

// CustomCodeParserWithReceiver is for extra validation of the method
// see CustomCodeParser.ReceiverRequired
type CustomCodeParserWithReceiver interface {
	CustomCodeParser
	ValidateFnReceiver(name string) error
}

// ParseCustomGraphQLDefinitions takes a file Parser and a custom code Parser and returns
// a channel to the result
func ParseCustomGraphQLDefinitions(parser Parser, codeParser CustomCodeParser) chan ParseCustomGQLResult {
	result := make(chan ParseCustomGQLResult)
	go parseCustomGQL(parser, codeParser, result)
	return result
}

func parseCustomGQL(parser Parser, codeParser CustomCodeParser, out chan ParseCustomGQLResult) {
	pkgs := LoadPackages(parser)

	l := &parsedList{}
	var wg sync.WaitGroup

	var errr error

	for idx := range pkgs {
		idx := idx
		pkg := pkgs[idx]
		for idx := range pkg.CompiledGoFiles {
			idx := idx
			filename := pkg.CompiledGoFiles[idx]
			if !codeParser.ProcessFileName(filename) {
				continue
			}

			wg.Add(1)
			go func() {
				defer wg.Done()
				err := checkForCustom(parser, filename, pkg, pkg.Syntax[idx], codeParser, l)
				if err != nil {
					errr = err
				}
			}()
		}
	}

	wg.Wait()
	var result ParseCustomGQLResult
	if errr != nil {
		result.Error = errr
	} else {
		result.ParsedItems = l.fns
	}
	out <- result
}

func checkForCustom(
	parser Parser,
	filename string,
	pkg *packages.Package,
	file *ast.File,
	codeParser CustomCodeParser,
	l *parsedList,
) error {
	// TODO this shouldn't be here. should be in CustomCodeParser
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

				if err := addFunction(parser, fn, pkg, cg, l, graphqlNode); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}

func addFunction(
	parser Parser,
	fn *ast.FuncDecl,
	pkg *packages.Package,
	cg *ast.CommentGroup,
	l *parsedList,
	graphqlNode string,
) error {
	fnName := fn.Name.Name

	parsedFn := &Function{
		NodeName:     graphqlNode,
		FunctionName: fnName,
		// remove Get prefix if it exists
		GraphQLName: strcase.ToLowerCamel(strings.TrimPrefix(fnName, "Get")),
	}

	if parser.GetPackageName() != pkg.Name {
		parsedFn.FunctionName = pkg.Name + "." + parsedFn.FunctionName

		parsedFn.ImportPath = pkg.PkgPath
	}

	if err := modifyFunctionFromCG(cg, parsedFn); err != nil {
		return err
	}

	results := fn.Type.Results.List
	// TODO need to handle objects with no result...

	if len(results) == 1 {
		resultType := pkg.TypesInfo.TypeOf(results[0].Type)
		parsedFn.Type = enttype.GetType(resultType)
	} else {

		fields, err := getFields(pkg, results)
		if err != nil {
			return err
		}
		parsedFn.Results = fields
	}

	fields, err := getFields(pkg, fn.Type.Params.List)
	if err != nil {
		return err
	}
	parsedFn.Args = fields
	l.AddFunction(parsedFn)
	return nil
}

func getFields(pkg *packages.Package, list []*ast.Field) ([]*Field, error) {
	fields := make([]*Field, len(list))
	for idx, item := range list {
		// name required for now. TODO...

		if len(item.Names) != 1 {
			return nil, errors.New("invalid number of names for param")
		}
		paramType := pkg.TypesInfo.TypeOf(item.Type)
		fields[idx] = &Field{
			Name: item.Names[0].Name,
			Type: enttype.GetType(paramType),
		}
	}
	return fields, nil
}

func modifyFunctionFromCG(cg *ast.CommentGroup, fn *Function) error {
	splits := strings.Split(cg.Text(), "\n")
	for _, s := range splits {
		if strings.HasPrefix(s, "@graphql") {
			parts := strings.Split(s, " ")
			if len(parts) == 1 {
				// nothing to do here
				return nil
			}
			// override the name we should use
			fn.GraphQLName = parts[1]

			if len(parts) > 2 {
				if parts[2] != "Query" && parts[2] != "Mutation" {
					return errors.New("invalid query/Mutation syntax")
				}
				fn.NodeName = parts[2]
			} else if fn.NodeName == "" {
				// default to Query over mutation
				fn.NodeName = "Query"
			}
			return nil
		}
	}
	return nil
}
