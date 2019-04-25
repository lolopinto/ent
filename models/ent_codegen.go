package models

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/printer"
	"go/token"
	"io/ioutil"
	"log"
	"os"
	"reflect"
	"regexp"
	"strings"
	"text/template"

	"github.com/iancoleman/strcase"
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

type FieldEdge struct {
	FieldName string
	EntConfig interface{} // zero-value of the struct...
}

type nodeTemplate struct {
	PackageName  string
	Node         string
	Nodes        string
	Fields       []field
	NodeResult   string
	NodesResult  string
	NodeInstance string
	NodesSlice   string
	NodeType     string
	TableName    string
	Edges        []edgeInfo
}

type field struct {
	FieldName string
	FieldType string
	FieldTag  string
}

var typeRegistry = make(map[string]reflect.Type)

// RegisterType registers a type so we know how to create it in the future
// This is because Go is a hard language to use for this.
// See https://stackoverflow.com/questions/23030884/is-there-a-way-to-create-an-instance-of-a-struct-from-a-string
// Until I figure out how to do this from AST, I'll have to make every Config do this
// This is so that I don't have to parse every single function and eval it...
func RegisterEntConfig(typedNil interface{}) {
	fmt.Println("RegisterEntconfig")

	t := reflect.TypeOf(typedNil).Elem()
	typeRegistry[t.PkgPath()+"."+t.Name()] = t
}

func makeConfigInstance(configName string) reflect.Value {
	fmt.Println("makeConfigInstance")
	for k := range typeRegistry {
		fmt.Println(k)
	}
	return reflect.New(typeRegistry[configName]).Elem()

	//.Interface()
}

// CodeGenMain method does stuff TODO
// TODO temporary for now until we build a generic thing used by everyone
func CodeGenMain() {
	// have to use an "absolute" filepath for now
	// TODO eventually use ParseDir... and *config.go
	//parser.Parse
	//os.Fi
	// get root path, find directories in there
	rootPath := "models"
	fileInfos, err := ioutil.ReadDir(rootPath)
	//ioutil.re
	die(err)
	var directories []string
	for _, fileInfo := range fileInfos {
		if fileInfo.IsDir() {
			directories = append(directories, fileInfo.Name())
			codegenPackage(fileInfo.Name(), rootPath+"/"+fileInfo.Name())
		}
		//fmt.Printf("IsDir %v Name %v \n", fileInfo.IsDir(), fileInfo.Name())
	}

	//	fmt.Println(files, err)
}

// codegenPackage codegens a given package
func codegenPackage(packageName string, directoryPath string) {
	fileInfos, err := ioutil.ReadDir(directoryPath)
	die(err)
	regex, err := regexp.Compile("config.go")
	die(err)
	var files []string
	for _, fileInfo := range fileInfos {
		match := regex.MatchString(fileInfo.Name())
		if match {
			fmt.Printf("config file Name %v \n", fileInfo.Name())
			files = append(files, fileInfo.Name())
		}
	}

	filePath := directoryPath + "/" + files[0]

	// var conf loader.Config
	// conf.CreateFromFilenames(packageName, filePath)

	// prog, err := conf.Load()
	// die(err)
	// fmt.Println(prog)

	if len(files) > 1 {
		die(fmt.Errorf("There was more than one config file in this directory %s", directoryPath))
	} else if len(files) == 1 {
		codegenImpl(packageName, filePath)
	}

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

func codegenImpl(packageName string, filePath string) {
	fset := token.NewFileSet()
	var src interface{}
	file, err := parser.ParseFile(fset, filePath, src, parser.AllErrors)
	//	spew.Dump(file)
	die(err)
	//fmt.Println(f)

	//ast.Print(fset, node)
	//ast.NewObj(fset, "file")
	//fmt.Println("Struct:")
	var nodeData nodeTemplate
	var edges []edgeInfo

	ast.Inspect(file, func(node ast.Node) bool {
		// get struct
		// TODO get the name from *ast.TypeSpec to verify a few things
		// for now, we're assuming one struct which maps to what we want which isn't necessarily true

		if s, ok := node.(*ast.StructType); ok {
			nodeData = parseConfig(s, packageName, fset)
		}

		// TODO handle the name do things about it
		if fn, ok := node.(*ast.FuncDecl); ok {
			fmt.Println(fn.Name)

			switch fn.Name.Name {
			case "GetEdges":
				edges = parseEdgesFunc(fn)
				// TODO: validate edges. can only have one of each type etc
			}

		}
		return true
	})

	// set edges and other fields gotten from parsing other things
	nodeData.Edges = edges

	// what's the best way to check not-zero value? for now, this will have to do
	if len(nodeData.PackageName) > 0 {
		// TODO only do contact for now.
		if nodeData.PackageName == "contact" {
			//getEdges()
			writeModelFile(nodeData)
			writeConstFile(nodeData)
		}
	}
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

// http://goast.yuroyoro.net/ is really helpful to see the tree
func parseEdgesFunc(fn *ast.FuncDecl) []edgeInfo {
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

	lastExpr := getLastExpr(returnStmt.Results)
	compositeListStmt := getExprToCompositeLit(lastExpr)
	if len(returnStmt.Results) != 1 {
		panic("invalid number or format of return statement")
	}

	// get the
	edges := make([]edgeInfo, len(compositeListStmt.Elts))
	for idx, expr := range compositeListStmt.Elts {
		keyValueExpr := getExprToKeyValueExpr(expr)
		fmt.Println(keyValueExpr)
		// get the edge as needed
		edgeItem := parseEdgeItem(keyValueExpr)
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

type edgeInfo struct {
	EdgeName     string
	FieldEdge    fieldEdgeInfo
	NodeTemplate nodeTemplate
}

func parseEdgeItem(keyValueExpr *ast.KeyValueExpr) edgeInfo {
	key, ok := keyValueExpr.Key.(*ast.BasicLit)
	if !ok || key.Kind != token.STRING {
		panic("invalid key for edge item")
	}
	var edgeName = key.Value
	splitString := strings.Split(edgeName, "\"")
	fmt.Println(splitString)
	// verify that the first and last part are empty string?
	if len(splitString) != 3 {
		panic(fmt.Sprintf("edge %s is formatted weirdly as a string literal", edgeName))
	}
	edgeName = splitString[1]
	fmt.Println(edgeName)

	value := getExprToCompositeLit(keyValueExpr.Value)
	typ := getExprToSelectorExpr(value.Type)
	// ignore typ.X because for now it should always be models.FieldEdge or ent.FieldEdge...

	edgeType := typ.Sel.Name
	if edgeType != "FieldEdge" {
		panic("unsupported edge type")
	}
	fieldEdgeItem := parseFieldEdgeItem(value)
	return edgeInfo{
		EdgeName:     edgeName,
		FieldEdge:    fieldEdgeItem,
		NodeTemplate: getNodeTemplate(fieldEdgeItem.EntConfig.PackageName, []field{}),
	}
}

func parseFieldEdgeItem(lit *ast.CompositeLit) fieldEdgeInfo {
	var fieldName string
	var entConfig entConfigInfo
	for _, expr := range lit.Elts {
		keyValueExpr := getExprToKeyValueExpr(expr)
		ident := getExprToIdent(keyValueExpr.Key)

		switch ident.Name {
		case "FieldName":
			// TODO: this validates it's a string literal.
			// does not format it.
			// TODO make this
			_, ok := expr.(*ast.Ident)
			if ok {
				panic("invalid FieldName value. Should not use an expression. Should be a string literal")
			}
			basicLit := getExprToBasicLit(keyValueExpr.Value)
			fieldName = basicLit.Value

		case "EntConfig":
			value := getExprToCompositeLit(keyValueExpr.Value)
			typ := getExprToSelectorExpr(value.Type)
			entIdent := getExprToIdent(typ.X)

			entConfig = entConfigInfo{
				PackageName: entIdent.Name,
				ConfigName:  typ.Sel.Name,
			}

		default:
			panic("invalid identifier for field config")
		}
	}

	return fieldEdgeInfo{
		FieldName: fieldName,
		EntConfig: entConfig,
	}
}

func parseConfig(s *ast.StructType, packageName string, fset *token.FileSet) nodeTemplate {
	var fields []field
	for _, f := range s.Fields.List {
		// use this to rename GraphQL, db fields, etc
		// otherwise by default it passes this down
		fmt.Printf("Field: %s Type: %s Tag: %v \n", f.Names[0].Name, f.Type, f.Tag)
		var tag string
		if t := f.Tag; t != nil {
			tag = t.Value
		}

		fields = append(fields, field{
			FieldName: f.Names[0].Name,
			FieldType: getStringType(f, fset),
			FieldTag:  tag,
		})
	}

	return getNodeTemplate(packageName, fields)
}

func getNodeTemplate(packageName string, fields []field) nodeTemplate {
	// convert from pacakgename to camel case and add V2 till we convert
	nodeName := strcase.ToCamel(packageName) + "V2"
	//		nodeName := "ContactV2"

	return nodeTemplate{
		// TODO this shouldn't be hardcoded.
		// take from directory name?
		PackageName:  packageName,
		Node:         nodeName,
		Nodes:        fmt.Sprintf("%ss", nodeName),
		Fields:       fields,
		NodeResult:   fmt.Sprintf("%sResult", nodeName),
		NodesResult:  fmt.Sprintf("%ssResult", nodeName),
		NodeInstance: strcase.ToLowerCamel(nodeName),
		NodesSlice:   fmt.Sprintf("[]%s", nodeName),
		NodeType:     fmt.Sprintf("%sType", nodeName),
		TableName:    fmt.Sprintf("%ss", packageName),
	}
}

func writeModelFile(nodeData nodeTemplate) {
	writeFile(
		nodeData,
		"models/node.tmpl",
		"node.tmpl",
		fmt.Sprintf("models/%s/%s.go", nodeData.PackageName, nodeData.PackageName),
	)
}

func writeConstFile(nodeData nodeTemplate) {
	writeFile(
		nodeData,
		"models/constants.tmpl",
		"constants.tmpl",
		fmt.Sprintf("models/%s/constants.go", nodeData.PackageName),
	)
}

func writeFile(nodeData nodeTemplate, pathToTemplate string, templateName string, pathToFile string) {
	path := []string{pathToTemplate}
	t, err := template.New(templateName).ParseFiles(path...)
	fmt.Println("sss")
	die(err)
	fmt.Println("ddd")

	var buffer bytes.Buffer

	// execute the template and store in buffer
	err = t.Execute(&buffer, nodeData)
	die(err)
	//err = t.Execute(os.Stdout, nodeData)
	//fmt.Println(buffer)
	//fmt.Println(buffer.String())
	// gofmt the buffer
	bytes, err := format.Source(buffer.Bytes())
	die(err)

	//codeForFile := string(bytes)

	// write to stdout. this is just for debug purposes
	//io.WriteString(os.Stdout, codeForFile)

	// write to file
	// TODO. this needs to be a lot better.
	// add autgen things at top
	// add signature that we can use in testing
	// etc

	// TODO figure out flags. I had os.O_CREATE but doesn't work for existing files
	file, err := os.OpenFile(pathToFile, os.O_RDWR|os.O_EXCL, 0666)
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

	_, err = file.Write(bytes)
	die(err)
	err = file.Close()
	fmt.Println("wrote to file ", pathToFile)

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
		panic(err)
	}
}
