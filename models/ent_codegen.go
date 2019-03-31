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
	"regexp"
	"text/template"

	"github.com/iancoleman/strcase"
)

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

	if len(files) > 1 {
		die(fmt.Errorf("There was more than one config file in this directory %s", directoryPath))
	} else if len(files) == 1 {
		codegenImpl(packageName, directoryPath+"/"+files[0])
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
	die(err)
	//fmt.Println(f)

	//ast.Print(fset, node)
	//ast.NewObj(fset, "file")
	//fmt.Println("Struct:")
	ast.Inspect(file, func(node ast.Node) bool {
		// get struct
		s, ok := node.(*ast.StructType)
		if !ok {
			return true
		}
		//s.
		//ast.Print(fset, s)

		//var fields = make([]field, s.Fields.NumFields())
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

		nodeData := nodeTemplate{
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

		writeModelFile(nodeData)
		writeConstFile(nodeData)

		return false
	})
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
