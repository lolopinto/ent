package schemaparser

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

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
	AbsRootPath string
	//DisableSyntax bool
}

func (p *ConfigSchemaParser) GetConfig() (*packages.Config, string, error) {
	mode := packages.LoadTypes | packages.LoadSyntax
	// if p.DisableSyntax {
	// 	mode = packages.LoadTypes
	// }

	cfg := &packages.Config{
		// the more I load, the slower this is...
		// this is a lot slower than the old thing. what am I doing wrong or differently?
		Mode: mode,
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
	// TODO handle all these testdata things...
	path, err := filepath.Abs("../testdata/")
	util.Die(err)
	p.tempDir, err = ioutil.TempDir(path, "test")
	util.Die(err)

	if p.PackageName == "" {
		p.PackageName = "configs"
	}
	configDir := filepath.Join(p.tempDir, p.PackageName)
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
	cfg, dir, err := p.GetConfig()

	parserWithCleanup, ok := p.(ParserNeedsCleanup)
	if ok {
		defer parserWithCleanup.Cleanup()
	}
	util.Die(err)

	pkgs, err := packages.Load(cfg, dir)
	util.Die(err)

	if len(pkgs) != 1 {
		panic("invalid number of packages. TODO ola figure out why there's more than one package in a folder")
	}
	pkg := pkgs[0]

	if len(pkg.Errors) > 0 {
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
	return pkg
}
