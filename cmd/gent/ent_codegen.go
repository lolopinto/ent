package main

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/printer"
	"go/scanner"
	"go/token"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"text/template"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"

	// need to use dst because of this issue:
	// https://github.com/golang/go/issues/20744
	// goast doesn't do a keep job of keeping track of comments and it becomes
	// annoying to keep track of everything that's going on without this library
	// As of right now, AST is used for everything else but modifying the AST in place
	"github.com/dave/dst"
	"github.com/dave/dst/decorator"
)

type EdgeConfigType string

const (
	// FieldEdge represents a field edge which is an edge whose data is gotten from
	// a field in the object
	FieldEdgeType EdgeConfigType = "FIELD_EDGE"
)

type Edgeconfig struct {
	EdgeType EdgeConfigType
}

type nodeTemplate struct {
	PackageName   string
	Node          string
	Nodes         string
	Fields        []fieldInfo
	NodeResult    string
	NodesResult   string
	NodeInstance  string
	NodesSlice    string
	NodeType      string
	EntConfig     string
	EntConfigName string
	Edges         []edgeInfo
	TableName     string
}

type fieldInfo struct {
	FieldName string
	FieldType string
	FieldTag  string
	TagMap    map[string]string
}

func (f *fieldInfo) getDbColName() string {
	colName, err := strconv.Unquote(f.TagMap["db"])
	die(err)

	return colName
}

func (f *fieldInfo) getQuotedDBColName() string {
	return f.TagMap["db"]
}

// gets the string representation of the type
func getStringType(f *ast.Field, fset *token.FileSet) string {
	var typeNameBuf bytes.Buffer
	err := printer.Fprint(&typeNameBuf, fset, f.Type)
	if err != nil {
		log.Fatalf("failed getting the type of field %s", err)
	}
	return typeNameBuf.String()
}

func shouldCodegenPackage(file *ast.File, specificConfig string) bool {
	// nothing to do here
	if specificConfig == "" {
		return true
	}

	var returnVal bool

	ast.Inspect(file, func(node ast.Node) bool {
		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			structName := t.Name.Name

			returnVal = specificConfig == structName
			return false
		}
		return true
	})
	return returnVal
}

type codegenNodeTemplateInfo struct {
	nodeData      *nodeTemplate
	shouldCodegen bool
}

func parseAllSchemaFiles(rootPath string, specificConfig string, codePathInfo *codePath) map[string]*codegenNodeTemplateInfo {
	// have to use an "absolute" filepath for now
	// TODO eventually use ParseDir... and *config.go
	//parser.Parse
	// get root path, find config files in there
	fileInfos, err := ioutil.ReadDir(rootPath)
	die(err)
	r, err := regexp.Compile(`(\w+)_config.go`)
	die(err)

	allNodes := make(map[string]*codegenNodeTemplateInfo)

	for _, fileInfo := range fileInfos {
		match := r.FindStringSubmatch(fileInfo.Name())

		fmt.Println("match", match)

		if len(match) == 2 {

			packageName := match[1]
			filePath := rootPath + "/" + fileInfo.Name()

			fmt.Println(packageName, filePath)

			// TODO break this into concurrent jobs
			nodeData, shouldCodegen := parseNodeTemplate(packageName, filePath, nil, specificConfig)
			allNodes[nodeData.EntConfigName] = &codegenNodeTemplateInfo{
				nodeData:      nodeData,
				shouldCodegen: shouldCodegen,
			}
		}
		//fmt.Printf("IsDir %v Name %v \n", fileInfo.IsDir(), fileInfo.Name())
	}
	return allNodes
}

// parseSchemasFromSource is mostly used by tests to test quick one-off scenarios
func parseSchemasFromSource(sources map[string]string, specificConfig string) map[string]*codegenNodeTemplateInfo {
	allNodes := make(map[string]*codegenNodeTemplateInfo)

	for packageName, src := range sources {
		// TODO break this into concurrent jobs, same as parseAllSchemaFiles above
		// also make it smarter and have the accumulation happen in a helper function once it's more complicated
		nodeData, shouldCodegen := parseNodeTemplate(packageName, "", src, specificConfig)
		allNodes[nodeData.EntConfigName] = &codegenNodeTemplateInfo{
			nodeData:      nodeData,
			shouldCodegen: shouldCodegen,
		}
	}
	return allNodes
}

func parseSchemasAndGenerate(rootPath string, specificConfig string, codePathInfo *codePath) {
	allNodes := parseAllSchemaFiles(rootPath, specificConfig, codePathInfo)

	if len(allNodes) == 0 {
		return
	}

	fmt.Println("schema", len(allNodes))

	// TOOD validate things here first.

	// generate python schema file first and then make changes to underlying db
	//generateSchemaFile(nodes)
	schema := newSchema(allNodes)
	schema.generateSchema()

	for _, info := range allNodes {
		if !info.shouldCodegen {
			continue
		}
		nodeData := info.nodeData
		//fmt.Println(specificConfig, structName)
		// what's the best way to check not-zero value? for now, this will have to do
		if len(nodeData.PackageName) > 0 {
			writeModelFile(nodeData, codePathInfo)
			writeMutatorFile(nodeData, codePathInfo)
			writePrivacyFile(nodeData)
		}
	}
}

func parseNodeTemplate(packageName string, filePath string, src interface{}, specificConfig string) (*nodeTemplate, bool) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filePath, src, parser.AllErrors)
	//spew.Dump(file)
	die(err)
	//fmt.Println(f)

	//ast.Print(fset, node)
	//ast.NewObj(fset, "file")
	//fmt.Println("Struct:")
	var nodeData nodeTemplate
	var edges []edgeInfo
	var tableName string

	ast.Inspect(file, func(node ast.Node) bool {
		// get struct
		// TODO get the name from *ast.TypeSpec to verify a few things
		// for now, we're assuming one struct which maps to what we want which isn't necessarily true

		// pass the structtype to get the config
		if s, ok := node.(*ast.StructType); ok {
			nodeData = parseConfig(s, packageName, fset)
		}

		if fn, ok := node.(*ast.FuncDecl); ok {
			fmt.Println("Method: ", fn.Name)

			switch fn.Name.Name {
			case "GetEdges":
				edges = parseEdgesFunc(packageName, fn)
				// TODO: validate edges. can only have one of each type etc

			case "GetTableName":
				tableName = getTableName(fn)
			}

		}
		return true
	})

	// set edges and other fields gotten from parsing other things
	nodeData.Edges = edges
	nodeData.TableName = tableName

	return &nodeData, shouldCodegenPackage(file, specificConfig)
}

func getLastReturnStmtExpr(fn *ast.FuncDecl) ast.Expr {
	// fn.Body is an instance of *ast.BlockStmt
	lastStmt := getLastStatement(fn.Body.List)

	//fmt.Println(length)
	// to handle the case where we have variables used to return something
	// not really a valid case but handle it anyways
	returnStmt, ok := lastStmt.(*ast.ReturnStmt)
	if !ok {
		panic("last statement in function was not a return statement. ")
	}

	fmt.Println(len(returnStmt.Results))

	if len(returnStmt.Results) != 1 {
		panic("invalid number or format of return statement")
	}

	return getLastExpr(returnStmt.Results)
}

func getCompositeStmtsInFunc(fn *ast.FuncDecl) *ast.CompositeLit {
	lastExpr := getLastReturnStmtExpr(fn)
	compositeListStmt := getExprToCompositeLit(lastExpr)
	return compositeListStmt
}

// given a function node, it gets the list of elts in the func
// works for both edges in GetEdges() func and list of privacy rules in Rules
func getEltsInFunc(fn *ast.FuncDecl) []ast.Expr {
	return getCompositeStmtsInFunc(fn).Elts
}

// astConfig returns the config of a file before it was re-generated to keep
// useful information that'll be needed when we need to regenerate the manual sections
// later
type astConfig struct {
	fset *token.FileSet //stores the fset

	commentMap map[string]*commentGroupPair
	// stores the expressions in the method we care about...
	exprMap map[string][]ast.Expr
	file    *ast.File
}

// get the manual expression in the function
// this assumes the first and last are automated
// needs to eventually handle the cases where that's not true
// other places also assume this e.g. in rewriteAstWithConfig
func (config *astConfig) getManualExprs(fnName string) []ast.Expr {
	allExprs := config.exprMap[fnName]
	// returns a slice of the exprs excluding the first and last elements
	// when we make this more complicated, need to compare against position of MANUAL comments as needed
	return allExprs[1 : len(allExprs)-1]
}

// getLastExpr returns the last expression in the function for the given function name
func (config *astConfig) getLastExpr(fnName string) ast.Expr {
	allExprs := config.exprMap[fnName]
	return getLastExpr(allExprs)
}

// this is for keeping track of commentgroup pairs that have a BEGIN of...
// and END of... where manual declarations would be put in a function or something
type commentGroupPair struct {
	BeginCommentGroup *ast.CommentGroup
	EndCommentGroup   *ast.CommentGroup
}

// parseFileForManualCode checks the path of the file we're about to generate,
// checks to see if it exists and then annotates it with the information
// needed to regenerate the MANUAL sections later
func parseFileForManualCode(path string) *astConfig {
	_, err := os.Stat(path)
	fmt.Println("sss", path)
	// file doesn't exist or can't read file, nothing to do here...
	if err != nil {
		return nil
	}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	die(err)

	comments := []*commentGroupPair{}

	var begin *ast.CommentGroup

	for idx := 0; idx < len(file.Comments); idx++ {
		cg := file.Comments[idx]
		//fmt.Println(cg.Text())

		if begin == nil {
			if strings.HasPrefix(cg.Text(), "BEGIN MANUAL SECTION") {
				begin = cg
			}
		} else {
			// this doesn't work when this has something in front of it...
			splits := strings.Split(cg.Text(), "\n")
			for _, s := range splits {
				if strings.HasPrefix(s, "END MANUAL SECTION") {
					comments = append(comments, &commentGroupPair{
						BeginCommentGroup: begin,
						EndCommentGroup:   cg,
					})
					begin = nil
				}
			}
		}
	}

	// nothing to do here since no manual thing in between that we care about
	if len(comments) == 0 {
		return nil
	}

	commentMap := make(map[string]*commentGroupPair)
	exprMap := make(map[string][]ast.Expr)

	//comments := []*ast.Comment{}
	ast.Inspect(file, func(node ast.Node) bool {
		//spew.Dump(node)
		// collect comments
		if fn, ok := node.(*ast.FuncDecl); ok {
			// we only care about the Rules method for now but we can make this work for other methods in the future...

			fnName := fn.Name.Name

			if fnName == "Rules" {

				for _, cgPair := range comments {
					begin := cgPair.BeginCommentGroup.List[0]
					end := cgPair.EndCommentGroup.List[0]

					// the comments map to what we're looking for
					if !(fn.Pos() < begin.Pos() && end.Pos() < fn.End()) {
						continue
					}
					//fmt.Println("yay!...")

					commentMap[fnName] = cgPair
					//exprMap[fnName] = manualStmts
					// store the entire elts in func...
					exprMap[fnName] = getEltsInFunc(fn)
				}
			}
		}

		return true
	})

	return &astConfig{
		fset:       fset,
		commentMap: commentMap,
		exprMap:    exprMap,
		file:       file,
	}
}

// rewriteAstWithConfig takes the ast that was generated and rewrites it
// so that we respect the user-generated MANUAL code
func rewriteAstWithConfig(config *astConfig, b []byte) []byte {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "", b, parser.ParseComments)
	die(err)

	comments := []*ast.CommentGroup{}

	// get the commentgroups in this file that map to what we care about...
	for _, cg := range file.Comments {
		// in the new AST we need a comment group with exactly 2 items
		// the BEGIN and END
		if len(cg.List) != 2 {
			continue
		}
		// not the right cg so bounce
		if !strings.HasPrefix(cg.Text(), "BEGIN MANUAL SECTION") {
			continue
		}
		comments = append(comments, cg)
	}

	// something weird happened, bad...
	if len(comments) == 0 {
		die(errors.New("did not find comments to be rewritten in generated file"))
	}

	// create decorator for file before it was changed
	oldDec := decorator.NewDecorator(config.fset)
	_, err = oldDec.DecorateFile(config.file)
	die(err)

	// Create a new decorator, which will track the mapping between ast and dst nodes
	dec := decorator.NewDecorator(fset)
	dstFile, err := dec.DecorateFile(file)
	die(err)

	// inspect the methods we care about
	dst.Inspect(dstFile, func(node dst.Node) bool {
		fn, ok := node.(*dst.FuncDecl)
		if !ok {
			return true
		}

		fnName := fn.Name.Name
		// same as in parseFileForManualCode. only care about Rules method for now...
		// should eventually make sure this works for everything.
		if fnName != "Rules" {
			return true
		}

		manualExprs := config.getManualExprs(fnName)

		// take the DST func, convert to DST so we can use helper methods we have here
		// and then convert back to DST so that we can
		astFunc := dec.Ast.Nodes[fn].(*ast.FuncDecl)
		compositeLit := getCompositeStmtsInFunc(astFunc)

		compositeLitDst := dec.Dst.Nodes[compositeLit].(*dst.CompositeLit)
		elts := compositeLitDst.Elts

		manualDstExprs := make([]dst.Expr, len(manualExprs))
		for idx, stmt := range manualExprs {
			expr := oldDec.Dst.Nodes[stmt].(dst.Expr)
			//spew.Dump(expr, ok)
			// take each of the manual stmts from the old file and add them to the new elts
			clonedExpr := dst.Clone(expr).(dst.Expr)
			manualDstExprs[idx] = clonedExpr
		}

		// append list at position
		// TODO create a library for helpers like these...
		elts = append(elts[:1], append(manualDstExprs, elts[1:]...)...)
		compositeLitDst.Elts = elts

		// ensure that whatever comments were in the last node of the manual
		// section are copied over to the new last node.
		// Does a few things of note:
		// * removes duplicate BEGIN MANUAL SECTION which was	associated with last node
		// when there were only 2 statements before the manual sections were considered
		// * ensures that any comments at the end of the manual section that the developer
		// had written were remembered.
		lastExpr := config.getLastExpr(fnName)
		lastDstExpr := oldDec.Dst.Nodes[lastExpr].(dst.Expr)

		lastElt := elts[len(elts)-1]
		//spew.Dump("lastElt", lastElt.Decorations())
		// replace the string with what was in the manual version...
		lastElt.Decorations().Start.Replace(lastDstExpr.Decorations().Start.All()...)

		return true
	})

	//decorator.Print(dstFile)
	restoredFset, restoredFile, err := decorator.RestoreFile(dstFile)

	var buf bytes.Buffer
	format.Node(&buf, restoredFset, restoredFile)
	die(err)

	return buf.Bytes()
}

func getLastStatement(stmts []ast.Stmt) ast.Stmt {
	length := len(stmts)
	lastStmt := stmts[length-1]
	return lastStmt
}

func getLastExpr(exprs []ast.Expr) ast.Expr {
	length := len(exprs)
	lastExpr := exprs[length-1]
	return lastExpr
}

// getTableName returns the name of the table the node should be stored in
func getTableName(fn *ast.FuncDecl) string {
	expr := getLastReturnStmtExpr(fn)
	basicLit := getExprToBasicLit(expr)
	fmt.Println("table name", basicLit.Value)
	return basicLit.Value
}

// http://goast.yuroyoro.net/ is really helpful to see the tree
func parseEdgesFunc(packageName string, fn *ast.FuncDecl) []edgeInfo {
	elts := getEltsInFunc(fn)

	// get the edges in teh function
	edges := make([]edgeInfo, len(elts))
	for idx, expr := range elts {
		keyValueExpr := getExprToKeyValueExpr(expr)
		fmt.Println(keyValueExpr)
		// get the edge as needed
		edgeItem := parseEdgeItem(packageName, keyValueExpr)
		edges[idx] = edgeItem
	}

	//fmt.Println(edges)

	return edges
}

func getExprToCompositeLit(expr ast.Expr) *ast.CompositeLit {
	value, ok := expr.(*ast.CompositeLit)
	if !ok {
		panic("invalid value for Expr. Expr was not of type CompositeLit")
	}
	return value
}

func getExprToBasicLit(expr ast.Expr) *ast.BasicLit {
	value, ok := expr.(*ast.BasicLit)
	if !ok {
		panic("invalid value for Expr. Expr was not of type BasicLit")
	}
	return value
}

func getExprToSelectorExpr(expr ast.Expr) *ast.SelectorExpr {
	value, ok := expr.(*ast.SelectorExpr)
	if !ok {
		panic("invalid value for Expr. Expr was not of type SelectorExpr")
	}
	return value
}

func getExprToKeyValueExpr(expr ast.Expr) *ast.KeyValueExpr {
	value, ok := expr.(*ast.KeyValueExpr)
	if !ok {
		panic("invalid value for Expr. Expr was not of type KeyValueExpr")
	}
	return value
}

func getExprToIdent(expr ast.Expr) *ast.Ident {
	value, ok := expr.(*ast.Ident)
	if !ok {
		panic("invalid value for Expr. Expr was not of type Ident")
	}
	return value
}

type entConfigInfo struct {
	PackageName string
	ConfigName  string
}

type fieldEdgeInfo struct {
	FieldName string
	EntConfig entConfigInfo
}

// TODO we need a FieldName in ent.ForeignKeyEdge and a sensible way to pass the field
// down. Right now, it's depending on the fact that it aligns with the "package name"
type foreignKeyEdgeInfo struct {
	EntConfig entConfigInfo
}

type associationEdgeInfo struct {
	EntConfig entConfigInfo
	EdgeConst string
}

type edgeInfo struct {
	EdgeName        string
	FieldEdge       *fieldEdgeInfo
	ForeignKeyEdge  *foreignKeyEdgeInfo
	AssociationEdge *associationEdgeInfo
	NodeTemplate    nodeTemplate
}

// Takes an Expr and converts it to the underlying string without quotes
// For example: in the GetEdges method below,
// return map[string]interface{}{
// 	"User": ent.FieldEdge{
// 		FieldName: "UserID",
// 		EntConfig: UserConfig{},
// 	},
// }
// Calling this with the "User" Expr returns User and calling it with
// the "UserID" Expr returns UserID
func getUnderylingStringFromLiteralExpr(expr ast.Expr) string {
	key, ok := expr.(*ast.BasicLit)
	if !ok || key.Kind != token.STRING {
		panic("invalid key for edge item")
	}
	splitString := strings.Split(key.Value, "\"")
	// verify that the first and last part are empty string?
	if len(splitString) != 3 {
		panic(fmt.Sprintf("%s is formatted weirdly as a string literal", key.Value))
	}
	return splitString[1]
}

func parseEdgeItem(containingPackageName string, keyValueExpr *ast.KeyValueExpr) edgeInfo {
	edgeName := getUnderylingStringFromLiteralExpr(keyValueExpr.Key)
	fmt.Println("EdgeName: ", edgeName)

	value := getExprToCompositeLit(keyValueExpr.Value)
	typ := getExprToSelectorExpr(value.Type)
	// ignore typ.X because for now it should always be models.FieldEdge or ent.FieldEdge...

	edgeType := typ.Sel.Name

	var fieldEdgeItem *fieldEdgeInfo
	var foreignKeyEdgeItem *foreignKeyEdgeInfo
	var associationEdgeItem *associationEdgeInfo
	var packageName string

	switch edgeType {
	case "FieldEdge":
		fieldEdgeItem = parseFieldEdgeItem(value)
		packageName = fieldEdgeItem.EntConfig.PackageName

	case "ForeignKeyEdge":
		foreignKeyEdgeItem = parseForeignKeyEdgeItem(value)
		packageName = foreignKeyEdgeItem.EntConfig.PackageName

	case "AssociationEdge":
		associationEdgeItem = parseAssociationEdgeItem(containingPackageName, edgeName, value)
		packageName = associationEdgeItem.EntConfig.PackageName

	default:
		panic("unsupported edge type")

	}
	return edgeInfo{
		EdgeName:        edgeName,
		FieldEdge:       fieldEdgeItem,
		ForeignKeyEdge:  foreignKeyEdgeItem,
		AssociationEdge: associationEdgeItem,
		NodeTemplate:    getNodeTemplate(packageName, []fieldInfo{}),
	}
}

func parseFieldEdgeItem(lit *ast.CompositeLit) *fieldEdgeInfo {
	done := make(chan bool)
	var fieldName string
	var entConfig entConfigInfo

	closure := func(identName string, keyValueExprValue ast.Expr, expr ast.Expr) {
		switch identName {
		case "FieldName":
			// TODO: this validates it's a string literal.
			// does not format it.
			// TODO make this
			_, ok := expr.(*ast.Ident)
			if ok {
				panic("invalid FieldName value. Should not use an expression. Should be a string literal")
			}
			fieldName = getUnderylingStringFromLiteralExpr(keyValueExprValue)
			fmt.Println("Field name:", fieldName)

		case "EntConfig":
			entConfig = getEntConfigFromExpr(keyValueExprValue)

		default:
			panic("invalid identifier for field config")
		}
	}

	go parseEdgeItemHelper(lit, closure, done)
	<-done

	return &fieldEdgeInfo{
		FieldName: fieldName,
		EntConfig: entConfig,
	}
}

func parseForeignKeyEdgeItem(lit *ast.CompositeLit) *foreignKeyEdgeInfo {
	entConfig := parseEntConfigOnlyFromEdgeItemHelper(lit)

	return &foreignKeyEdgeInfo{
		EntConfig: entConfig,
	}
}

func parseAssociationEdgeItem(containingPackageName, edgeName string, lit *ast.CompositeLit) *associationEdgeInfo {
	entConfig := parseEntConfigOnlyFromEdgeItemHelper(lit)

	edgeConst := strcase.ToCamel(containingPackageName) + "To" + edgeName + "Edge"

	return &associationEdgeInfo{
		EntConfig: entConfig,
		EdgeConst: edgeConst,
	}
}

func parseEntConfigOnlyFromEdgeItemHelper(lit *ast.CompositeLit) entConfigInfo {
	done := make(chan bool)
	var entConfig entConfigInfo

	closure := func(identName string, keyValueExprValue ast.Expr, _ ast.Expr) {
		switch identName {
		case "EntConfig":
			entConfig = getEntConfigFromExpr(keyValueExprValue)

		default:
			panic("invalid identifier for field config")
		}
	}

	go parseEdgeItemHelper(lit, closure, done)
	<-done
	return entConfig
}

func parseEdgeItemHelper(lit *ast.CompositeLit, valueFunc func(identName string, keyValueExprValue ast.Expr, expr ast.Expr), done chan<- bool) {
	for _, expr := range lit.Elts {
		keyValueExpr := getExprToKeyValueExpr(expr)
		ident := getExprToIdent(keyValueExpr.Key)

		valueFunc(ident.Name, keyValueExpr.Value, expr)
	}
	done <- true
}

func getNodeNameFromEntConfig(configName string) (string, error) {
	r, err := regexp.Compile("([A-Za-z]+)Config")
	die(err)
	match := r.FindStringSubmatch(configName)
	if len(match) == 2 {
		return match[1], nil
	}
	return "", fmt.Errorf("couldn't match EntConfig name")
}

func getEntConfigFromExpr(expr ast.Expr) entConfigInfo {
	lit := getExprToCompositeLit(expr)
	// inlining getExprToSelectorExpr...
	typ, ok := lit.Type.(*ast.SelectorExpr)
	// This is when the EntConfig is of the form user.UserConfig
	// don't actually support this case right now since all the configs are local
	if ok {
		entIdent := getExprToIdent(typ.X)
		return entConfigInfo{
			PackageName: entIdent.Name,
			ConfigName:  typ.Sel.Name,
		}
	}

	// inlining getExprToIdent...
	// TODO figure out what we wanna do here
	// This supports when the EntConfig is local to the module
	entIdent, ok := lit.Type.(*ast.Ident)
	if ok {
		configName, err := getNodeNameFromEntConfig(entIdent.Name)
		die(err)
		return entConfigInfo{
			// return a fake packageName e.g. user, contact to be used
			// TODO fix places using this to return Node instead of fake packageName
			PackageName: configName,
			ConfigName:  entIdent.Name,
		}
	}
	panic("Invalid value for Expr. Could not get EntConfig from Expr")
}

func parseConfig(s *ast.StructType, packageName string, fset *token.FileSet) nodeTemplate {
	var fields []fieldInfo
	for _, f := range s.Fields.List {
		fieldName := f.Names[0].Name
		// use this to rename GraphQL, db fields, etc
		// otherwise by default it passes this down
		fmt.Printf("Field: %s Type: %s Tag: %v \n", fieldName, f.Type, f.Tag)

		tagStr, tagMap := getTagInfo(fieldName, f.Tag)

		fields = append(fields, fieldInfo{
			FieldName: fieldName,
			FieldType: getStringType(f, fset),
			FieldTag:  tagStr,
			TagMap:    tagMap,
		})
	}
	//spew.Dump(fields)

	return getNodeTemplate(packageName, fields)
}

func getTagInfo(fieldName string, tag *ast.BasicLit) (string, map[string]string) {
	tagsMap := make(map[string]string)
	if t := tag; t != nil {
		// struct tag format should be something like `graphql:"firstName" db:"first_name"`
		tags := strings.Split(t.Value, "`")
		if len(tags) != 3 {
			panic("invalid struct tag format. handle better. struct tag not enclosed by backticks")
		}

		// each tag is separated by a space
		tags = strings.Split(tags[1], " ")
		for _, tagInfo := range tags {
			// TODO maybe eventually use a fancier struct tag library. for now, handle here
			// get each tag and create a map
			singleTag := strings.Split(tagInfo, ":")
			if len(singleTag) != 2 {
				panic("invalid struct tag format. handle better")
			}
			tagsMap[singleTag[0]] = singleTag[1]
		}
	}

	// add the db tag it it doesn't exist
	_, ok := tagsMap["db"]
	if !ok {
		tagsMap["db"] = strconv.Quote(strcase.ToSnake(fieldName))
	}

	//fmt.Println(len(tagsMap))
	//fmt.Println(tagsMap)
	// convert the map back to the struct tag string format
	var tags []string
	for key, value := range tagsMap {
		// TODO: abstract this out better. only specific tags should we written to the ent
		if key == "db" || key == "graphql" {
			tags = append(tags, key+":"+value)
		}
	}
	return "`" + strings.Join(tags, " ") + "`", tagsMap
}

func getNodeTemplate(packageName string, fields []fieldInfo) nodeTemplate {
	// convert from pacakgename to camel case
	nodeName := strcase.ToCamel(packageName)

	return nodeTemplate{
		PackageName:   packageName,                  // contact
		Node:          nodeName,                     // Contact
		Nodes:         fmt.Sprintf("%ss", nodeName), // Contacts
		Fields:        fields,
		NodeResult:    fmt.Sprintf("%sResult", nodeName),            // ContactResult
		NodesResult:   fmt.Sprintf("%ssResult", nodeName),           // ContactsResult
		NodeInstance:  strcase.ToLowerCamel(nodeName),               // contact
		NodesSlice:    fmt.Sprintf("[]*%s", nodeName),               // []*Contact
		NodeType:      fmt.Sprintf("%sType", nodeName),              // ContactType
		EntConfig:     fmt.Sprintf("&configs.%sConfig{}", nodeName), // &configs.ContactConfig{}
		EntConfigName: fmt.Sprintf("%sConfig", nodeName),            // ContactConfig
	}
}

type fileToWriteInfo struct {
	data               interface{}
	pathToTemplate     string
	templateName       string
	pathToFile         string
	createDirIfNeeded  bool
	checkForManualCode bool
	formatSource       bool
}

type nodeTemplateCodePath struct {
	NodeData *nodeTemplate
	CodePath *codePath
}

func writeModelFile(nodeData *nodeTemplate, codePathInfo *codePath) {
	writeFile(
		fileToWriteInfo{
			data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			pathToTemplate: "templates/node.tmpl",
			templateName:   "node.tmpl",
			pathToFile:     fmt.Sprintf("models/%s.go", nodeData.PackageName),
			formatSource:   true,
		},
	)
}

func writeMutatorFile(nodeData *nodeTemplate, codePathInfo *codePath) {
	// this is not a real entmutator but this gets things working and
	// hopefully means no circular dependencies
	writeFile(
		fileToWriteInfo{
			data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			pathToTemplate:    "templates/mutator.tmpl",
			templateName:      "mutator.tmpl",
			pathToFile:        fmt.Sprintf("models/%s/mutator/%s_mutator.go", nodeData.PackageName, nodeData.PackageName),
			createDirIfNeeded: true,
			formatSource:      true,
		},
	)
}

func writePrivacyFile(nodeData *nodeTemplate) {
	pathToFile := fmt.Sprintf("models/%s_privacy.go", nodeData.PackageName)

	writeFile(
		fileToWriteInfo{
			data:               nodeData,
			pathToTemplate:     "templates/privacy.tmpl",
			templateName:       "privacy.tmpl",
			pathToFile:         pathToFile,
			checkForManualCode: true,
			formatSource:       true,
		},
	)
}

func getAbsolutePath(filePath string) string {
	_, filename, _, ok := runtime.Caller(1)
	if !ok {
		die(errors.New("could not get path of template file"))
	}
	return path.Join(path.Dir(filename), filePath)
}

// generate new AST for the given file from the template
func generateNewAst(file fileToWriteInfo) []byte {
	templateAbsPath := getAbsolutePath(file.pathToTemplate)

	path := []string{templateAbsPath}
	t, err := template.New(file.templateName).ParseFiles(path...)
	die(err)

	var buffer bytes.Buffer

	// execute the template and store in buffer
	err = t.Execute(&buffer, file.data)
	die(err)
	//err = t.Execute(os.Stdout, nodeData)
	//fmt.Println(buffer)
	//fmt.Println(buffer.String())
	// gofmt the buffer
	if file.formatSource {
		bytes, err := format.Source(buffer.Bytes())
		die(err)
		return bytes
	}
	return buffer.Bytes()
}

func writeFile(file fileToWriteInfo) {
	// parse existing file to see what we need to keep in the rewrite
	var config *astConfig

	// no real reason this only applies for just privacy.tmpl
	// but it's the only one where we care about this for now so limiting to just that
	// in the future, this should apply for all
	if file.checkForManualCode {
		config = parseFileForManualCode(file.pathToFile)
	}

	// generate the new AST we want for the file
	bytes := generateNewAst(file)

	if config != nil {
		bytes = rewriteAstWithConfig(config, bytes)
	}

	//codeForFile := string(bytes)

	// write to stdout. this is just for debug purposes
	//io.WriteString(os.Stdout, codeForFile)

	// write to file
	// TODO. this needs to be a lot better.
	// add autgen things at top
	// add signature that we can use in testing
	// etc

	// TODO figure out flags. I had os.O_CREATE but doesn't work for existing files
	/*file, err := os.OpenFile(pathToFile, os.O_WRONLY|os.O_SYNC, 0666)
	if err == nil {
		// nothing to do here
		fmt.Println("existing file ", pathToFile)
	} else if os.IsNotExist(err) {
		fmt.Println("new file ", pathToFile)
		file, err = os.Create(pathToFile)
		die(err)
	} else {
		// different type of error
		die(err)
	}
	*/

	// replace manual writes with ioutil.WriteFile as that seems to (small sample size) fix the
	// weird issues I was sometimes seeing with overwriting an existing file
	// and random characters appearing.

	if file.createDirIfNeeded {
		fullPath := filepath.Join(".", file.pathToFile)
		directoryPath := path.Dir(fullPath)

		_, err := os.Stat(directoryPath)

		if os.IsNotExist(err) {
			err = os.MkdirAll(directoryPath, os.ModePerm)
			if err == nil {
				fmt.Println("created directory ", directoryPath)
			}
		}
		if os.IsNotExist(err) {
			die(err)
		}
	}

	err := ioutil.WriteFile(file.pathToFile, bytes, 0666)
	//	_, err = file.Write(bytes)
	die(err)
	//err = file.Close()
	fmt.Println("wrote to file ", file.pathToFile)

	//fmt.Printf("%s\n", bytes)
	// b, err := format.Source(&buffer)

	// fmt.Println(buffer.String())
	// die(err)
	// fmt.Println("gg")

	//t = t
	//fmt.Println(fields)
}

func die(err error) {
	if err != nil {
		err2, ok := err.(scanner.ErrorList)
		if ok {
			for _, err3 := range err2 {
				spew.Dump(err3)
			}
		}
		panic(err)
	}
}
