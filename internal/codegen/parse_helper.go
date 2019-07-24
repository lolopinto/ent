package codegen

import (
	"go/ast"
	"go/token"
	"go/types"
	"regexp"
	"testing"

	"golang.org/x/tools/go/packages"
	//	"github.com/davecgh/go-spew/spew"
)

type FileConfigData struct {
	StructMap map[string]*ast.StructType
	FuncMap   map[string]*ast.FuncDecl
	Fset      *token.FileSet
	Info      *types.Info
	files     []*ast.File
	fileMap   map[string]*ast.File
}

// parse and save for reuse in tests
var savedRes *FileConfigData // TODO this doesn't work when field_test and edge_test are run at the same time...

func ParseFilesForTest(t *testing.T, needTypes ...bool) *FileConfigData {
	if savedRes != nil {
		return savedRes
	}
	structMap := make(map[string]*ast.StructType)
	funcMap := make(map[string]*ast.FuncDecl)
	fileMap := make(map[string]*ast.File)

	var mode packages.LoadMode
	if len(needTypes) == 0 {
		mode = packages.LoadSyntax
	} else {
		mode = packages.LoadTypes | packages.LoadSyntax
	}
	cfg := &packages.Config{
		//Fset: fset,
		// the more I load, the slower this is...
		// this is a lot slower than the old thing. what am I doing wrong or differently?
		Mode: mode,
	}
	pkgs, err := packages.Load(cfg, "../testdata/models/configs")
	if err != nil {
		t.Errorf("was unable to check the package as needed. error: %s", err)
	}

	if len(pkgs) != 1 {
		t.Errorf("expected 1 package, got %d instead", len(pkgs))
	}
	pkg := pkgs[0]

	var files []*ast.File

	if len(pkg.GoFiles) != len(pkg.Syntax) {
		t.Errorf("don't have the same number of named files and parsed files")
	}

	for idx, filePath := range pkg.GoFiles {
		file := pkg.Syntax[idx]

		fileMap[filePath] = file
		files = append(files, file)
	}

	savedRes = &FileConfigData{
		StructMap: structMap,
		FuncMap:   funcMap,
		Fset:      pkg.Fset,
		Info:      pkg.TypesInfo,
		files:     files,
		fileMap:   fileMap,
	}
	return savedRes
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
