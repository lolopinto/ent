package schemaparser

import (
	"errors"
	"fmt"
	"go/ast"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
)

type Parser interface {
	GetConfig() (*packages.Config, string, error)
}

type ParserNeedsCleanup interface {
	Parser
	Cleanup()
}

type ConfigSchemaParser struct {
	AbsRootPath   string
	FilesToIgnore []string
}

func (p *ConfigSchemaParser) getRootPath() (string, string) {
	dir, packageName := filepath.Split(p.AbsRootPath)
	packageName = strings.TrimSuffix(packageName, "...")
	rootPath := filepath.Join(dir, packageName)
	return rootPath, packageName
}

func (p *ConfigSchemaParser) GetConfig() (*packages.Config, string, error) {
	mode := packages.LoadTypes | packages.LoadSyntax

	cfg := &packages.Config{
		// the more I load, the slower this is...
		// this is a lot slower than the old thing. what am I doing wrong or differently?
		Mode: mode,
	}

	// override with overlay not working...
	if len(p.FilesToIgnore) != 0 {
		overlay := make(map[string][]byte)

		rootPath, packageName := p.getRootPath()
		for _, path := range p.FilesToIgnore {
			fullPath := filepath.Join(rootPath, path)

			overlay[fullPath] = []byte(fmt.Sprintf("package %s \n\n", packageName))
		}

		cfg.Overlay = overlay
	}
	return cfg, p.AbsRootPath, nil
}

type SourceSchemaParser struct {
	Sources     map[string]string
	PackageName string // defaults to configs if not passed
	tempDir     string
}

func (p *SourceSchemaParser) GetConfig() (*packages.Config, string, error) {
	overlay := make(map[string][]byte)

	var err error
	var tempDir string
	// TODO handle all these testdata things...
	path, err := filepath.Abs("../testdata/")
	if err != nil {
		return nil, "", err
	}
	p.tempDir, err = ioutil.TempDir(path, "test")
	if err != nil {
		return nil, "", err
	}
	tempDir = p.tempDir

	if p.PackageName == "" {
		p.PackageName = "configs"
	}
	configDir := filepath.Join(tempDir, p.PackageName)
	err = os.MkdirAll(configDir, 0755)
	if err != nil {
		return nil, "", err
	}

	for key, source := range p.Sources {
		// create overlays of path to source for data to be read from disk
		path := filepath.Join(configDir, key)
		overlay[path] = []byte(source)
	}

	cfg := &packages.Config{
		//Fset: fset,
		// the more I load, the slower this is...
		// this is a lot slower than the old thing. what am I doing wrong or differently?
		Mode:    packages.LoadTypes | packages.LoadSyntax,
		Overlay: overlay,
	}
	return cfg, configDir, err
}

func (p *SourceSchemaParser) Cleanup() {
	util.Die(os.RemoveAll(p.tempDir))
}

func LoadPackage(p Parser) *packages.Package {
	pkgs := LoadPackages(p)
	if len(pkgs) != 1 {
		panic("invalid number of packages. TODO ola figure out why there's more than one package in a folder")
	}
	return pkgs[0]
}

func LoadPackages(p Parser) []*packages.Package {
	if p == nil {
		return []*packages.Package{}
	}
	cfg, dir, err := p.GetConfig()

	parserWithCleanup, ok := p.(ParserNeedsCleanup)
	if ok {
		defer parserWithCleanup.Cleanup()
	}
	util.Die(err)

	pkgs, err := packages.Load(cfg, dir)
	util.Die(err)

	for _, pkg := range pkgs {
		if len(pkg.Errors) > 0 {
			// If we run into issues with this in the future, inspect err.Pos
			// some strings.Split tells us what we're doing...
			util.ErrSlice(pkg.Errors)
		}

		if len(pkg.GoFiles) != len(pkg.Syntax) {
			panic(
				fmt.Errorf(
					"don't have the same number of named files and parsed files. %d filenames %d files",
					len(pkg.GoFiles),
					len(pkg.Syntax),
				),
			)
		}
	}
	return pkgs
}

type FunctionSearch struct {
	PkgName  string
	FnName   string
	FileName string
}

func FindFunction(code, pkgName, fnName string) (*packages.Package, *ast.FuncDecl, error) {
	overlay := make(map[string]string)
	overlay["code.go"] = code

	parser := &SourceSchemaParser{
		Sources:     overlay,
		PackageName: pkgName,
	}
	fns := FunctionSearch{
		PkgName: pkgName,
		FnName:  fnName,
	}
	return FindFunctionFromParser(parser, fns)
}

func FindFunctionFromParser(parser Parser, fns FunctionSearch) (*packages.Package, *ast.FuncDecl, error) {
	pkg := LoadPackage(parser)
	if len(pkg.Errors) != 0 {
		return nil, nil, util.CoalesceErrSlice(pkg.Errors)
	}

	var file *ast.File
	if fns.FileName == "" {
		if len(pkg.GoFiles) != 1 {
			return nil, nil, errors.New("expected 1 go file")
		}
		file = pkg.Syntax[0]
	} else {
		for idx, filename := range pkg.GoFiles {
			if strings.HasSuffix(filename, fns.FileName) {
				file = pkg.Syntax[idx]
				break
			}
		}
	}
	if file == nil {
		return nil, nil, errors.New("couldn't find any file")
	}

	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok &&
			fn.Name.Name == fns.FnName {
			return pkg, fn, nil
		}
	}

	return nil, nil, fmt.Errorf("couldn't find function named %s", fns.FnName)
}
