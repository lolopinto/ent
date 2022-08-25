package parsehelper

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"golang.org/x/tools/go/packages"
)

// files to parse...
type PartsToParse uint

const (
	ParseStruct PartsToParse = 1 << iota
	ParseEdges
	ParseActions
)

type FileConfigData struct {
	StructMap map[string]*ast.StructType
	funcMap   map[string]map[string]*ast.FuncDecl
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
	parseFuncFlags      PartsToParse
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

func ParseFuncs(parseFuncFlags PartsToParse) func(*Config) {
	return func(cfg *Config) {
		cfg.parseFuncFlags = parseFuncFlags
	}
}

// save for reuse in tests
var cachedConfigs map[string]*FileConfigData

func init() {
	cachedConfigs = make(map[string]*FileConfigData)
}

func getKey(cfg *Config) string {
	parseFlags := fmt.Sprintf("%v", cfg.parseFuncFlags)
	if cfg.uniqueKeyForSources != "" {
		return cfg.uniqueKeyForSources + parseFlags
	}
	if cfg.rootPath != "" {
		path, err := filepath.Abs(cfg.rootPath)
		if err != nil {
			util.GoSchemaKill(err)
		}
		return path + parseFlags
	}
	util.GoSchemaKill("invalid configuration")
	// panics but need a return value
	return ""
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
		absRootPath, err := filepath.Abs(cfg.rootPath)
		if err != nil {
			util.GoSchemaKill(err)
		}
		p = &schemaparser.ConfigSchemaParser{
			AbsRootPath: absRootPath,
			//		DisableSyntax: cfg.disableSyntax,
		}
	}

	pkg := schemaparser.LoadPackageX(p)

	structMap := make(map[string]*ast.StructType)
	funcMap := make(map[string]map[string]*ast.FuncDecl)
	fileMap := make(map[string]*ast.File)

	var files []*ast.File

	for idx, filePath := range pkg.GoFiles {
		file := pkg.Syntax[idx]

		fileMap[filePath] = file
		files = append(files, file)
	}

	ret := &FileConfigData{
		StructMap: structMap,
		funcMap:   funcMap,
		Fset:      pkg.Fset,
		Info:      pkg.TypesInfo,
		Pkg:       pkg,
		files:     files,
		fileMap:   fileMap,
	}
	// parse edges, actions etc once and cache it so that we don't always
	// have to parse it
	// TODO rewrite this to go through every file once instead of what we're currently doing
	if cfg.parseFuncFlags != 0 {
		if cfg.parseFuncFlags&ParseStruct != 0 {
			ret.parseStructs(t)
		}
		if cfg.parseFuncFlags&ParseEdges != 0 {
			ret.parseEdgesFunc(t)
		}
		if cfg.parseFuncFlags&ParseActions != 0 {
			ret.parseActionsFunc(t)
		}
	}
	cachedConfigs[key] = ret
	return ret
}

func (c *FileConfigData) parseStructs(t *testing.T) {
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

		assert.True(t, st != nil && structName != "", "could not parse a struct type for config file %s", file.Name.Name)
		c.StructMap[structName] = st
	}
}

func (c *FileConfigData) parseEdgesFunc(t *testing.T) {
	c.parseFuncByName(t, "GetEdges", false)
}

func (c *FileConfigData) GetEdgesFn(packageName string) *ast.FuncDecl {
	return c.funcMap[packageName]["GetEdges"]
}

func (c *FileConfigData) parseActionsFunc(t *testing.T) {
	c.parseFuncByName(t, "GetActions", false)
}

func (c *FileConfigData) GetActionsFn(packageName string) *ast.FuncDecl {
	return c.funcMap[packageName]["GetActions"]
}

func (c *FileConfigData) parseFuncByName(t *testing.T, fnName string, required bool) {
	r := regexp.MustCompile(`(\w+)_config.go`)

	for path, file := range c.fileMap {
		var matchedFn *ast.FuncDecl
		ast.Inspect(file, func(node ast.Node) bool {

			if fn, ok := node.(*ast.FuncDecl); ok && fn.Name.Name == fnName {
				matchedFn = fn
			}
			return true
		})

		match := r.FindStringSubmatch(path)
		assert.Equal(
			t,
			2,
			len(match),
			"file name of file wasn't correctly structured. expected foo_config.go, got %s",
			filepath.Base(path),
		)

		nodeType := match[1]

		if required {
			assert.NotNil(
				t,
				matchedFn,
				"couldn't find %s func for config file %s",
				fnName,
				nodeType,
			)
		}

		if matchedFn != nil {
			if c.funcMap[nodeType] == nil {
				c.funcMap[nodeType] = make(map[string]*ast.FuncDecl)
			}
			c.funcMap[match[1]][fnName] = matchedFn
		}
	}
}
