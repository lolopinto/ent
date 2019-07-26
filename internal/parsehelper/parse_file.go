package parsehelper

import (
	"go/ast"
	"go/token"
	"go/types"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
	//	"github.com/davecgh/go-spew/spew"
)

type FileConfigData struct {
	StructMap map[string]*ast.StructType
	FuncMap   map[string]*ast.FuncDecl
	Fset      *token.FileSet
	Info      *types.Info
	Pkg       *packages.Package
	files     []*ast.File
	fileMap   map[string]*ast.File
}

type Config struct {
	//disableSyntax bool
	rootPath            string
	sources             map[string]string
	uniqueKeyForSources string
}

// func DisableSyntax() func(*Config) {
// 	return func(cfg *Config) {
// 		cfg.disableSyntax = true
// 	}
// }

func RootPath(rootPath string) func(*Config) {
	return func(cfg *Config) {
		cfg.rootPath = rootPath
	}
}

func Sources(uniqueKeyForSources string, sources map[string]string) func(*Config) {
	return func(cfg *Config) {
		cfg.sources = sources
		cfg.uniqueKeyForSources = uniqueKeyForSources
	}
}

// save for reuse in tests
var cachedConfigs map[string]*FileConfigData

func init() {
	cachedConfigs = make(map[string]*FileConfigData)
}

func getKey(cfg *Config) string {
	if cfg.uniqueKeyForSources != "" {
		return cfg.uniqueKeyForSources
	}
	if cfg.rootPath != "" {
		path, err := filepath.Abs(cfg.rootPath)
		util.Die(err)
		return path
	}
	panic("invalid configuration")
}

func ParseFilesForTest(t *testing.T, options ...func(*Config)) *FileConfigData {
	// default value
	cfg := &Config{
		rootPath: "../testdata/models/configs",
	}
	// configure based on options
	for _, opt := range options {
		opt(cfg)
	}
	key := getKey(cfg)
	if cachedConfigs[key] != nil {
		return cachedConfigs[key]
	}

	var p schemaparser.Parser
	if cfg.sources != nil {
		p = &schemaparser.SourceSchemaParser{
			Sources: cfg.sources,
		}
	} else {
		p = &schemaparser.ConfigSchemaParser{
			RootPath: cfg.rootPath,
			//		DisableSyntax: cfg.disableSyntax,
		}
	}

	pkg := schemaparser.LoadPackage(p)

	structMap := make(map[string]*ast.StructType)
	funcMap := make(map[string]*ast.FuncDecl)
	fileMap := make(map[string]*ast.File)

	var files []*ast.File

	for idx, filePath := range pkg.GoFiles {
		file := pkg.Syntax[idx]

		fileMap[filePath] = file
		files = append(files, file)
	}

	ret := &FileConfigData{
		StructMap: structMap,
		FuncMap:   funcMap,
		Fset:      pkg.Fset,
		Info:      pkg.TypesInfo,
		Pkg:       pkg,
		files:     files,
		fileMap:   fileMap,
	}
	cachedConfigs[key] = ret
	return ret
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
