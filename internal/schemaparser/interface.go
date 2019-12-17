package schemaparser

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
)

type Parser interface {
	GetConfig() (*packages.Config, string, error)
	GetPackageName() string
}

type ParserNeedsCleanup interface {
	Parser
	Cleanup()
}

type ConfigSchemaParser struct {
	AbsRootPath   string
	FilesToIgnore []string
	packageName   string
	rootPath      string
}

func (p *ConfigSchemaParser) GetPackageName() string {
	if p.packageName == "" {
		dir, packageName := filepath.Split(p.AbsRootPath)
		p.packageName = strings.TrimSuffix(packageName, "...")
		p.rootPath = filepath.Join(dir, p.packageName)
	}
	return p.packageName
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

		// init this using p.GetPackageName()
		if p.rootPath == "" {
			p.GetPackageName()
		}
		for _, path := range p.FilesToIgnore {
			fullPath := filepath.Join(p.rootPath, path)

			overlay[fullPath] = []byte(fmt.Sprintf("package %s \n\n", p.GetPackageName()))
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

func (p *SourceSchemaParser) GetPackageName() string {
	if p.PackageName == "" {
		return "configs"
	}
	return p.PackageName
}

func (p *SourceSchemaParser) GetConfig() (*packages.Config, string, error) {
	overlay := make(map[string][]byte)

	var err error
	// TODO handle all these testdata things...
	path, err := filepath.Abs("../testdata/")
	util.Die(err)
	p.tempDir, err = ioutil.TempDir(path, "test")
	util.Die(err)

	configDir := filepath.Join(p.tempDir, p.GetPackageName())
	err = os.MkdirAll(configDir, 0666)
	util.Die(err)

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
	os.RemoveAll(p.tempDir)
}

func LoadPackage(p Parser) *packages.Package {
	pkgs := LoadPackages(p)
	if len(pkgs) != 1 {
		panic("invalid number of packages. TODO ola figure out why there's more than one package in a folder")
	}
	return pkgs[0]
}

func LoadPackages(p Parser) []*packages.Package {
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
