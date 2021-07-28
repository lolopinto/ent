package schemaparser

import (
	"errors"
	"fmt"
	"go/ast"
	"go/types"
	"strings"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/util"
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
	// Args are the arguments to the function
	Args []*Field
	// Results shows the list of return values of the function.
	Results []*Field
	// PackagePath is the package path as used by the go/types package.
	PackagePath string

	// CommentGroup return the comments associated with this function
	CommentGroup *GraphQLCommentGroup
}

// Field represents an item in an argument list or return list for a function
type Field struct {
	// Name of the field in argument or return list
	Name   string
	Type   enttype.Type
	goType types.Type
}

// FunctionMap is a Map of GraphQL Type to list of Functions that need to be added to GQL
type FunctionMap map[string][]*Function

// ParseCustomGQLResult is the result object of parsing the code path given
type ParseCustomGQLResult struct {
	Functions FunctionMap
	Error     error
	Objects   []*Object
}

type Object struct {
	Name        string
	GraphQLName string
	PackagePath string
	Fields      []*Field
}

// this is used to make concurrent changes to the map
// TODO rename this...
type parsedList struct {
	m    sync.RWMutex
	fns  FunctionMap
	objs []*Object
}

func (l *parsedList) addFunction(fn *Function) {
	l.m.Lock()
	defer l.m.Unlock()
	if l.fns == nil {
		l.fns = make(FunctionMap)
	}
	l.fns[fn.NodeName] = append(l.fns[fn.NodeName], fn)
}

func (l *parsedList) addObject(obj *Object) {
	l.m.Lock()
	defer l.m.Unlock()
	l.objs = append(l.objs, obj)
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

	// TODO document
	CreatesComplexTypeForSingleResult() bool
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
	pkgs := LoadPackagesX(parser)

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
		result.Functions = l.fns
		result.Objects = l.objs
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

	var graphqlComments []*ast.CommentGroup
	for _, cg := range file.Comments {
		if doc := graphQLDoc(cg); doc != nil {
			graphqlComments = append(graphqlComments, cg)
		}
	}

	if len(graphqlComments) == 0 {
		return nil
	}

	var inspectErr error
	ast.Inspect(file, func(node ast.Node) bool {

		// this gets custom types. logic for getting custom functions in those types is the same
		// This gets struct, and public/exported fields
		// For now, we only go find things in the "current" package path
		// so graphql/* and models/
		// Eventually, need to support traversing the import path and finding new structs as we see them
		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			s, ok := t.Type.(*ast.StructType)
			if ok {
				inspectStruct(l, t, s, graphqlComments, pkg)
			}
		}

		if fn, ok := node.(*ast.FuncDecl); ok {
			if err := inspectFunc(
				fn, parser, pkg, file, codeParser, l, graphqlComments,
			); err != nil {
				inspectErr = err
			}
		}
		return true
	})

	return inspectErr
}

func inspectStruct(
	l *parsedList,
	t *ast.TypeSpec,
	s *ast.StructType,
	graphqlComments []*ast.CommentGroup,
	pkg *packages.Package,
) {
	if cg := commentAssociatedWithType(graphqlComments, t); cg != nil {
		doc := graphQLDoc(cg)
		if doc == nil {
			util.GoSchemaKill("should not get here")
		}

		obj := &Object{
			Name:        t.Name.Name,
			GraphQLName: doc.GetGraphQLType(),
			PackagePath: pkg.PkgPath,
		}
		for _, f := range s.Fields.List {
			fieldName := f.Names[0]
			if !fieldName.IsExported() {
				continue
			}

			// not a graphql comment bye
			doc := graphQLDoc(f.Doc)
			if doc == nil {
				continue
			}
			field := &Field{
				Name: strcase.ToLowerCamel(f.Names[0].Name),
			}
			val := doc.customValueFromLine()
			// get overriden name if there's one
			if val.name != "" {
				field.Name = val.name
			}
			// set type
			field.goType = pkg.TypesInfo.TypeOf(f.Type)
			field.Type = enttype.GetNonNullableType(field.goType, val.forceRequired)

			obj.Fields = append(obj.Fields, field)
		}
		l.addObject(obj)
	}
}

func inspectFunc(
	fn *ast.FuncDecl,
	parser Parser,
	pkg *packages.Package,
	file *ast.File,
	codeParser CustomCodeParser,
	l *parsedList,
	graphqlComments []*ast.CommentGroup,
) error {
	graphqlNode := ""

	validateFnParser, ok := codeParser.(CustomCodeParserWithReceiver)
	if fn.Recv != nil {
		for _, field := range fn.Recv.List {
			info, err := astparser.ParseFieldType(field)
			if err != nil {
				return err
			}

			graphqlNode = info.IdentName
			// TODO validate that this is not allowed if the type isn't valid...
			if ok {
				if err := validateFnParser.ValidateFnReceiver(info.IdentName); err != nil {
					return err
				}
			}
			break
		}
	}

	// TODO this shouldn't be here. should be in CustomCodeParser
	expectedFnNames := map[string]bool{
		"GetPrivacyPolicy": true,
	}

	// hmm GetPrivacyPolicy and other overriden methods here
	// where should this logic be?
	if expectedFnNames[fn.Name.Name] {
		return nil
	}

	if cg := commentAssociatedWithFn(graphqlComments, fn); cg != nil {

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

		if err := addFunction(parser, codeParser, fn, pkg, cg, l, graphqlNode); err != nil {
			return err
		}
	}
	return nil
}

func addFunction(
	parser Parser,
	codeParser CustomCodeParser,
	fn *ast.FuncDecl,
	pkg *packages.Package,
	cg *ast.CommentGroup,
	l *parsedList,
	graphqlNode string,
) error {
	fnName := fn.Name.Name

	doc := graphQLDoc(cg)
	parsedFn := &Function{
		NodeName:     graphqlNode,
		FunctionName: fnName,
		// remove Get prefix if it exists
		GraphQLName:  strcase.ToLowerCamel(strings.TrimPrefix(fnName, "Get")),
		CommentGroup: doc,
	}

	parsedFn.PackagePath = pkg.PkgPath

	if err := modifyFunctionFromDoc(doc, parsedFn); err != nil {
		return err
	}

	results := fn.Type.Results
	if results != nil {
		returnValues, err := doc.returnValues()
		if err != nil {
			return err
		}
		c := &configureResults{
			returnValues: returnValues,
			codeParser:   codeParser,
		}

		fields, err := getFields(pkg, results.List, c)
		if err != nil {
			return err
		}
		parsedFn.Results = fields
	}

	fieldOverrides, err := doc.fieldOverrides()
	if err != nil {
		return err
	}
	fields, err := getFields(pkg, fn.Type.Params.List, &configureArgs{fieldOverrides: fieldOverrides})
	if err != nil {
		return err
	}
	parsedFn.Args = fields
	l.addFunction(parsedFn)
	return nil
}

type configureFields interface {
	nameRequired() bool
	fieldOverride(name string) string
}

type configureFieldsWithReturnValues interface {
	fieldValues() []*customReturnValue
}

type configureArgs struct {
	fieldOverrides map[string]string
}

func (c *configureArgs) nameRequired() bool {
	return true
}

func (c *configureArgs) fieldOverride(name string) string {
	return c.fieldOverrides[name]
}

type configureResults struct {
	returnValues []*customReturnValue
	codeParser   CustomCodeParser
}

func (c *configureResults) fieldOverride(name string) string {
	return ""
}

func (c *configureResults) nameRequired() bool {
	// name required if we're creating a complex type for the return value e.g. an ent object that returns one item, don't need this
	// if we're creating a complex type, e.g. an ent function that returns multiple items or a top level custom function, we need a name
	return c.codeParser.CreatesComplexTypeForSingleResult()
}

func (c *configureResults) fieldValues() []*customReturnValue {
	return c.returnValues
}

func fieldName(c configureFields, name string) string {
	if c == nil {
		return name
	}
	if n := c.fieldOverride(name); n != "" {
		return n
	}
	return name
}

// returns a function that gets the next field name
func getNextCustomField(c configureFields) func() (*customReturnValue, error) {
	cWithValues, ok := c.(configureFieldsWithReturnValues)
	if !ok {
		return nil
	}
	values := cWithValues.fieldValues()
	if len(values) == 0 {
		return nil
	}
	var i int
	return func() (*customReturnValue, error) {
		if i == len(values) {
			return nil, errors.New("not enough @graphqlreturn names specified")
		}
		i++
		return values[i-1], nil
	}
}

func getFields(pkg *packages.Package, list []*ast.Field, c configureFields) ([]*Field, error) {
	var fields []*Field

	nextField := getNextCustomField(c)

	for idx, item := range list {

		paramType := pkg.TypesInfo.TypeOf(item.Type)

		if len(item.Names) == 0 {
			entType := enttype.GetType(paramType)

			f := &Field{Type: entType, goType: paramType}

			var name string
			var expectedErrorType bool

			if idx+1 == len(list) && enttype.IsErrorType(entType) {
				expectedErrorType = true
			}

			// first see if we have a @graphqlreturn name (expected in the right order)
			// don't do for last item since we don't send it to GraphQL and it shouldn't be exepcted to be there
			if nextField != nil && !expectedErrorType {
				val, err := nextField()
				if err != nil {
					return nil, err
				}
				name = val.name
				if val.forceRequired {
					f.Type = enttype.GetNonNullableType(paramType, val.forceRequired)
				}
			}

			// then check default names
			if name == "" {
				defaultTyp, ok := entType.(enttype.DefaulFieldNameType)
				if ok {
					name = defaultTyp.DefaultGraphQLFieldName()
				}
			}

			// only field with no name allowed is error type when last item in list
			if name == "" && c.nameRequired() && !expectedErrorType {
				return nil, fmt.Errorf("found field %T with no name", entType)
			}

			// append fields
			f.Name = fieldName(c, name)
			fields = append(fields, f)
		} else {
			if nextField != nil {
				return nil, errors.New("cannot use both named return types and graphql comments")
			}

			// same type, we need to break this up as different fields if there's more than one
			for _, name := range item.Names {
				fields = append(fields, &Field{
					Name:   fieldName(c, name.Name),
					Type:   enttype.GetType(paramType),
					goType: paramType,
				})
			}
		}
	}
	return fields, nil
}

type GraphQLCommentGroup struct {
	cg    *ast.CommentGroup
	lines []string
	line  string // line that the graphql comment is on
}

func (doc *GraphQLCommentGroup) GetGraphQLType() string {
	parts := strings.Split(doc.line, " ")
	if len(parts) != 2 {
		return ""
	}
	if parts[0] != "@graphqltype" {
		return ""
	}
	return parts[1]
}

// parseLines takes a prefix and a function that's called with line that matches prefix and lines separated by space
// function should returns a boolean to indicate if we should continue looking for more
func (doc *GraphQLCommentGroup) parseLines(prefix string, fn func(string, []string) (bool, error)) error {
	var errs []error
	for _, line := range doc.lines {
		if strings.HasPrefix(line, prefix) {
			parts := strings.Split(line, " ")
			ret, err := fn(line, parts)
			if err != nil {
				errs = append(errs, err)
			}
			if !ret {
				break
			}
		}
	}
	return util.CoalesceErr(errs...)
}

func (doc *GraphQLCommentGroup) DisableGraphQLInputType() bool {
	var ret bool
	doc.parseLines("@graphqlinputtype", func(line string, parts []string) (bool, error) {
		// disable input type if line is "@graphqlinputtype false"
		if len(parts) == 2 && parts[1] == "false" {
			ret = true
		}
		// assume there's only one line ¯\_(ツ)_/¯
		return false, nil
	})
	return ret
}

func (doc *GraphQLCommentGroup) fieldOverrides() (map[string]string, error) {
	m := make(map[string]string)
	err := doc.parseLines("@graphqlparam", func(line string, parts []string) (bool, error) {
		var err error
		if len(parts) != 3 {
			err = fmt.Errorf("invalid @graphqlparam line %s", line)
		} else {
			m[parts[1]] = parts[2]
		}
		// we want all of them!
		return true, err
	})
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (doc *GraphQLCommentGroup) customValueFromLine() *customReturnValue {
	parts := strings.Split(doc.line, " ")

	ret := &customReturnValue{}
	if len(parts) == 1 {
		return ret
	}

	for _, part := range parts {
		if part == "@required" {
			ret.forceRequired = true
			break
		}
	}
	// @graphql name @required
	if (ret.forceRequired && len(parts) > 2) ||
		// @graphql name
		(!ret.forceRequired && len(parts) == 2) {
		ret.name = parts[1]
	}
	return ret
}

type customReturnValue struct {
	name          string
	forceRequired bool
}

func (doc *GraphQLCommentGroup) returnValues() ([]*customReturnValue, error) {
	var results []*customReturnValue
	err := doc.parseLines("@graphqlreturn", func(line string, parts []string) (bool, error) {
		var err error
		if len(parts) < 2 {
			err = fmt.Errorf("invalid @graphqlreturn line %s", line)
		} else {
			val := &customReturnValue{
				name: parts[1],
			}
			if len(parts) == 3 && parts[2] == "@required" {
				val.forceRequired = true
			}
			results = append(results, val)
		}
		return true, err
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

func graphQLDoc(cg *ast.CommentGroup) *GraphQLCommentGroup {
	splits := strings.Split(cg.Text(), "\n")

	for _, s := range splits {
		if strings.HasPrefix(s, "@graphql") {
			return &GraphQLCommentGroup{
				cg:    cg,
				lines: splits,
				line:  s,
			}
		}
	}
	return nil
}

func commentAssociatedWithFn(graphqlComments []*ast.CommentGroup, fn *ast.FuncDecl) *ast.CommentGroup {
	// allow one blank line there
	// this is not the most efficient since we're doing a for loop
	// TODO: optimize this and go through each comment one at a time?
	// Decls not guaranteed to be sorted so we should sort both and go through each in order...
	for _, cg := range graphqlComments {
		diff := cg.End() + 2 - fn.Pos()
		if diff >= 0 && diff <= 1 {
			return cg
		}
	}
	return nil
}

func commentAssociatedWithType(graphqlComments []*ast.CommentGroup, t *ast.TypeSpec) *ast.CommentGroup {
	// TODO same issues as commentAssociatedWithFn
	// TODO these comment issues may be why I need dst again.
	for _, cg := range graphqlComments {
		if cg.End()+6 == t.Pos() {
			return cg
		}
	}
	return nil
}

func modifyFunctionFromDoc(doc *GraphQLCommentGroup, fn *Function) error {
	parts := strings.Split(doc.line, " ")
	if len(parts) == 1 {
		// nothing to do here
		return nil
	}
	// override the name we should use
	fn.GraphQLName = strcase.ToLowerCamel(parts[1])

	if len(parts) > 2 {
		if parts[2] != "Query" && parts[2] != "Mutation" {
			return fmt.Errorf("invalid query/Mutation syntax %s", parts[2])
		}
		fn.NodeName = parts[2]
	} else if fn.NodeName == "" {
		// default to Query over mutation
		fn.NodeName = "Query"
	}
	return nil
}
