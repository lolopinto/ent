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
	var configValue reflect.Value
	//var configType reflect.Type

	ast.Inspect(file, func(node ast.Node) bool {
		// get struct
		// TODO get the name from *ast.TypeSpec to verify a few things
		// for now, we're assuming one struct which maps to what we want which isn't necessarily true

		if s, ok := node.(*ast.StructType); ok {
			nodeData = parseConfig(s, packageName, fset)

			//fmt.Println("reflect: ", reflect.ValueOf(node))
			//configValue = reflect.ValueOf(node)
		}

		if decl, ok := node.(*ast.GenDecl); ok {
			if decl.Tok == token.TYPE {
				//configValue = getConfigReflectValue(packageName, decl)
			}
		}

		// TODO handle the name do things about it
		if fn, ok := node.(*ast.FuncDecl); ok {
			//fmt.Println(fn.Body)
			fmt.Println(fn.Name)
			fmt.Println(fn.Name.IsExported())
			//parser.ParseExpr()
			// TODO how to parse the method and get info out of it
			//ast.Print(fset, fn.Body)
			parseFunc(fn)

		}
		return true
	})

	//getEdges(configValue)

	if configValue.IsValid() && !configValue.IsNil() {
		//		getEdges(configType, configValue)
	} else {
		//	panic("invalid type passed")

	}
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

// todo rename
func getConfigReflectValue(packageName string, decl *ast.GenDecl) reflect.Value {
	for _, decl := range decl.Specs {
		if decl, ok := decl.(*ast.TypeSpec); ok {
			name := decl.Name
			configName := fmt.Sprintf("%s.%s", packageName, name)
			fmt.Println("configName:", configName)
			return makeConfigInstance(configName)
			// //fmt.Println("type:", name)
			// configType := reflect.TypeOf(name)
			// //configType.Elem().Set()
			// // TODO need to initialize this somehow?
			// return configType
		}
	}

	panic("could not create an instance of reflect Value for instance. Need to call RegisterEntConfig")
}

func getEdges(configValue reflect.Value) {
	// TODO make this better
	//instead of trying to parse everything. we should only parse the struct,
	//and then call the methods directly

	// get a zero value of the type
	//configValue = reflect.New(configType)
	//configValue := reflect.Zero(configType)

	// todo handle this somewhere else
	// if !configValue.IsValid() || configValue.IsNil() {
	// 	panic("invalid type passed")
	// }

	//configValue = reflect.ValueOf(configValue)

	// if configValue.Kind() == reflect.Ptr {
	// 	configValue = configValue.Elem()
	// }
	//
	fmt.Println("type: %T", configValue, reflect.TypeOf(configValue.Elem().Interface()))
	fmt.Println(configValue.Kind())

	fmt.Println(configValue)
	fmt.Println(configValue.Interface())
	fmt.Println(reflect.Indirect(configValue).Kind())
	// rawValue := reflect.ValueOf(configValue.Interface())
	// fmt.Println(rawValue)
	//	getEdgesMethod := reflect.Indirect(reflect.Indirect(configValue)).MethodByName("GetEdges")
	//	getEdgesMethod2 := reflect.Indirect(configValue.Interface()).MethodByName("GetEdges")
	getEdgesMethod3 := reflect.ValueOf(configValue).MethodByName("GetEdges")

	//in := make([]reflect.Value, 0)
	//fmt.Println(getEdgesMethod.IsValid())
	//fmt.Println(getEdgesMethod2.IsValid())
	fmt.Println(getEdgesMethod3.IsValid())

	edgesList := getEdgesMethod3.Call(nil)

	fmt.Println(edgesList)

	edges := edgesList[0].Interface()

	edgesMap, ok := edges.(map[string]interface{})
	if !ok {
		panic("sad, getEdges() doesn't return the right format")
	}

	for key, _ := range edgesMap {
		fmt.Println(key)
	}

}

// parses a function in edges file
func parseFunc(fn *ast.FuncDecl) {
	switch fn.Name.String() {
	case "GetEdges":
		parseEdgesFunc(fn)
	case "init":
		break
	default:
		panic("invalid function name")
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
func parseEdgesFunc(fn *ast.FuncDecl) {
	// fn.Body is an instance of *ast.BlockStmt
	lastStmt := getLastStatement(fn.Body.List)

	//fmt.Println(length)
	// to handle the case where we have variables used to return something
	returnStmt, ok := lastStmt.(*ast.ReturnStmt)
	if !ok {
		panic("last statement in function was not a return statement. ")
	}

	fmt.Println(len(returnStmt.Results))
	// for _, stmt := range returnStmt.Results {

	// }

	lastExpr := getLastExpr(returnStmt.Results)
	compositeListStmt, ok := lastExpr.(*ast.CompositeLit)
	if !(ok && len(returnStmt.Results) == 1) {
		panic("invalid number or format of return statement")
	}

	for _, expr := range compositeListStmt.Elts {
		if keyValueExpr, ok := expr.(*ast.KeyValueExpr); ok {
			parseEdgeItem(keyValueExpr)
		} else {
			panic("invalid expression in map returned from GetEdges")
		}
	}

	//fmt.Println(len(fn.Body.List))
	// for _, stmt := range fn.Body.List {
	// 	// if exprStmt, ok := stmt.(*ast.ExprStmt); ok {

	// 	// }
	// }

}

type edge struct {
	edgeName string
}

func parseEdgeItem(keyValueExpr *ast.KeyValueExpr) edge {
	key, ok := keyValueExpr.Key.(*ast.BasicLit)
	if !ok || key.Kind != token.STRING {
		panic("invalid key for edge item")
	}
	var edgeName = key.Value

	//value, ok := keyValueExpr.Value.(*ast.CompositeLit)
	if !ok {
		panic("invalid value for edge item")
	}
	return edge{
		edgeName: edgeName,
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
		TableName:    "contacts", //fmt.Sprintf("%ss", nodeName),
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
