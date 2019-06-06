package main

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
	EntConfig    string
	Edges        []edgeInfo
}

type field struct {
	FieldName string
	FieldType string
	FieldTag  string
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

func codegenPackage(packageName string, filePath string, specificConfig string) {
	fset := token.NewFileSet()
	var src interface{}
	file, err := parser.ParseFile(fset, filePath, src, parser.AllErrors)
	//spew.Dump(file)
	die(err)
	//fmt.Println(f)

	//ast.Print(fset, node)
	//ast.NewObj(fset, "file")
	//fmt.Println("Struct:")
	var nodeData nodeTemplate
	var edges []edgeInfo

	if !shouldCodegenPackage(file, specificConfig) {
		return
	}

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
			}

		}
		return true
	})

	// set edges and other fields gotten from parsing other things
	nodeData.Edges = edges

	//fmt.Println(specificConfig, structName)
	// what's the best way to check not-zero value? for now, this will have to do
	if len(nodeData.PackageName) > 0 {
		writeModelFile(nodeData)
		writeMutatorFile(nodeData)
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
func parseEdgesFunc(packageName string, fn *ast.FuncDecl) []edgeInfo {
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
		NodeTemplate:    getNodeTemplate(packageName, []field{}),
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
	var fields []field
	for _, f := range s.Fields.List {
		fieldName := f.Names[0].Name
		// use this to rename GraphQL, db fields, etc
		// otherwise by default it passes this down
		fmt.Printf("Field: %s Type: %s Tag: %v \n", fieldName, f.Type, f.Tag)

		tagStr := getTagString(fieldName, f.Tag)

		fields = append(fields, field{
			FieldName: fieldName,
			FieldType: getStringType(f, fset),
			FieldTag:  tagStr,
		})
	}

	return getNodeTemplate(packageName, fields)
}

func getTagString(fieldName string, tag *ast.BasicLit) string {
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
		tagsMap["db"] = "\"" + strcase.ToSnake(fieldName) + "\""
	}

	//fmt.Println(len(tagsMap))
	//fmt.Println(tagsMap)
	// convert the map back to the struct tag string format
	var tags []string
	for key, value := range tagsMap {
		tags = append(tags, key+":"+value)
	}
	return "`" + strings.Join(tags, " ") + "`"
}

func getNodeTemplate(packageName string, fields []field) nodeTemplate {
	// convert from pacakgename to camel case
	nodeName := strcase.ToCamel(packageName)

	return nodeTemplate{
		PackageName:  packageName,                  // contact
		Node:         nodeName,                     // Contact
		Nodes:        fmt.Sprintf("%ss", nodeName), // Contacts
		Fields:       fields,
		NodeResult:   fmt.Sprintf("%sResult", nodeName),            // ContactResult
		NodesResult:  fmt.Sprintf("%ssResult", nodeName),           // ContactsResult
		NodeInstance: strcase.ToLowerCamel(nodeName),               // contact
		NodesSlice:   fmt.Sprintf("[]*%s", nodeName),               // []*Contact
		NodeType:     fmt.Sprintf("%sType", nodeName),              // ContactType
		EntConfig:    fmt.Sprintf("&configs.%sConfig{}", nodeName), // &configs.ContactConfig{}
	}
}

type fileToWriteInfo struct {
	nodeData          nodeTemplate
	pathToTemplate    string
	templateName      string
	pathToFile        string
	createDirIfNeeded bool
}

func writeModelFile(nodeData nodeTemplate) {
	writeFile(
		fileToWriteInfo{
			nodeData:       nodeData,
			pathToTemplate: "cmd/gent/node.tmpl",
			templateName:   "node.tmpl",
			pathToFile:     fmt.Sprintf("models/%s.go", nodeData.PackageName),
		},
	)
}

func writeMutatorFile(nodeData nodeTemplate) {
	// this is not a real entmutator but this gets things working and
	// hopefully means no circular dependencies
	writeFile(
		fileToWriteInfo{
			nodeData:          nodeData,
			pathToTemplate:    "cmd/gent/mutator.tmpl",
			templateName:      "mutator.tmpl",
			pathToFile:        fmt.Sprintf("models/%s/mutator/%s_mutator.go", nodeData.PackageName, nodeData.PackageName),
			createDirIfNeeded: true,
		},
	)
}

func writeFile(file fileToWriteInfo) {
	path := []string{file.pathToTemplate}
	t, err := template.New(file.templateName).ParseFiles(path...)
	die(err)
	template.Must(t, err)
	die(err)

	var buffer bytes.Buffer

	// execute the template and store in buffer
	err = t.Execute(&buffer, file.nodeData)
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
		path := strings.Split(file.pathToFile, "/")
		// get directoryPath
		// e.g. take something like models/contact/mutator/contact_mutator.go and get models/contact/mutator/
		path = path[0 : len(path)-1]
		directoryPath := strings.Join(path, "/")

		_, err := os.Stat(directoryPath)

		if os.IsNotExist(err) {
			err = os.Mkdir(directoryPath, 0777)
			if err != nil {
				fmt.Println("created directory ", directoryPath)
			}
		}
		if !os.IsNotExist(err) {
			die(err)
		}
	}

	err = ioutil.WriteFile(file.pathToFile, bytes, 0666)
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
		panic(err)
	}
}
