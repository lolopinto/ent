package codegen

import (
	"go/ast"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"path/filepath"
	"regexp"
	"testing"
)

type FileConfigData struct {
	StructMap map[string]*ast.StructType
	FuncMap   map[string]*ast.FuncDecl
	Fset      *token.FileSet
	Info      types.Info
	files     []*ast.File
	fileMap   map[string]*ast.File
}

func ParseFilesForTest(t *testing.T) *FileConfigData {
	structMap := make(map[string]*ast.StructType)
	funcMap := make(map[string]*ast.FuncDecl)
	fileMap := make(map[string]*ast.File)

	filePaths := []string{
		"../testdata/models/configs/account_config.go",
		"../testdata/models/configs/todo_config.go",
	}
	fset := token.NewFileSet()

	var files []*ast.File
	for _, path := range filePaths {
		file, err := parser.ParseFile(fset, path, nil, parser.AllErrors)
		if err != nil {
			t.Errorf("could not parse config file at path %s", path)
		}
		_, filePath := filepath.Split(path)
		fileMap[filePath] = file
		files = append(files, file)
	}

	info := types.Info{
		Types: make(map[ast.Expr]types.TypeAndValue),
		Defs:  make(map[*ast.Ident]types.Object),
		Uses:  make(map[*ast.Ident]types.Object),
	}
	conf := types.Config{
		Importer: importer.Default(),
	}
	_, err := conf.Check("models/configs", fset, files, &info)
	if err != nil {
		t.Errorf("was unable to chek the file as needed. error: %s", err)
	}

	return &FileConfigData{
		StructMap: structMap,
		FuncMap:   funcMap,
		Fset:      fset,
		Info:      info,
		files:     files,
		fileMap:   fileMap,
	}
}

func (c *FileConfigData) ParseStructs(t *testing.T) {
	for _, file := range c.files {
		var st *ast.StructType
		var structName string
		ast.Inspect(file, func(node ast.Node) bool {
			if s, ok := node.(*ast.StructType); ok {
				st = s
			}

			if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
				structName = t.Name.Name
			}
			return true
		})

		if st == nil || structName == "" {
			t.Errorf("count not parse a struct type for config file %s", file.Name.Name)
		}
		c.StructMap[structName] = st
	}
}

func (c *FileConfigData) ParseEdgesFunc(t *testing.T) {
	r := regexp.MustCompile(`(\w+)_config.go`)

	for path, file := range c.fileMap {
		var edgesFn *ast.FuncDecl
		ast.Inspect(file, func(node ast.Node) bool {

			if fn, ok := node.(*ast.FuncDecl); ok && fn.Name.Name == "GetEdges" {
				edgesFn = fn
			}
			return true
		})
		//		file.Unresolved

		fileName := file.Name.Name
		if edgesFn == nil {
			t.Errorf("couldn't find GetEdges func for config file %s", fileName)
		}

		match := r.FindStringSubmatch(path)
		if len(match) != 2 {
			t.Errorf("file name of file wasn't correctly structured. expected foo_config.go, got %s", fileName)
		}
		c.FuncMap[match[1]] = edgesFn
	}
}
