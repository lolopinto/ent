package codegen

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"
)

// rename from CodePath to CodegenInfo
type CodePath struct {
	relativePathToConfigs string
	importPathToConfigs   string
	importPathToModels    string
	importPathToRoot      string
	absPathToConfigs      string
	config                *config
}

func NewCodePath(configPath, modulePath string) (*CodePath, error) {
	// TODO all this logic is dependent on passing "models/configs". TODO fix it
	rootPath, err := filepath.Abs(configPath)

	if err != nil {
		return nil, err
	}

	c, err := parseConfig()
	if err != nil {
		return nil, err
	}

	// TODO we need to store absPathToRoot at some point
	return &CodePath{
		relativePathToConfigs: configPath,
		absPathToConfigs:      rootPath, // this is part to configs root but not root of dir TODO...
		importPathToRoot:      modulePath,
		importPathToConfigs:   filepath.Join(modulePath, configPath),
		importPathToModels:    filepath.Join(modulePath, "models"),
		config:                c,
	}, nil
}

func (cp *CodePath) OverrideImportPathToModels(importPath string) {
	cp.importPathToModels = importPath
}

func (cp *CodePath) GetQuotedImportPathToConfigs() string {
	return strconv.Quote(cp.importPathToConfigs)
}

func (cp *CodePath) GetImportPathToModels() string {
	return cp.importPathToModels
}

func (cp *CodePath) GetImportPathToGraphQL() string {
	return filepath.Join(cp.importPathToRoot, "graphql")
}

func (cp *CodePath) GetQuotedImportPathToModels() string {
	return strconv.Quote(cp.importPathToModels)
}

func (cp *CodePath) GetImportPathToRoot() string {
	return cp.importPathToRoot
}

func (cp *CodePath) GetRootPathToConfigs() string {
	return cp.absPathToConfigs
}

func (cp *CodePath) GetRelativePathToConfigs() string {
	return cp.relativePathToConfigs
}

func (cp *CodePath) AppendPathToModels(paths ...string) string {
	allPaths := append([]string{cp.importPathToModels}, paths...)
	return filepath.Join(allPaths...)
}

func (cp *CodePath) GetAbsPathToModels() string {
	return filepath.Join(cp.absPathToConfigs, "..")
}

func (cp *CodePath) GetAbsPathToRoot() string {
	return filepath.Join(cp.absPathToConfigs, "../..")
}

func (cp *CodePath) GetAbsPathToGraphQL() string {
	return filepath.Join(cp.absPathToConfigs, "../..", "graphql")
}

func init() {
	impPkg = &ImportPackage{
		PackagePath:        codepath.Package,
		AuthPackagePath:    codepath.AuthPackage,
		ActionPackagePath:  codepath.ActionPackage,
		SchemaPackagePath:  codepath.SchemaPackage,
		GraphQLPackagePath: codepath.GraphQLPackage,
		InternalImportPath: codepath.GetInternalImportPath(),
		ExternalImportPath: codepath.GetExternalImportPath(),
	}
}

var impPkg *ImportPackage

func (cp *CodePath) GetImportPackage() *ImportPackage {
	return impPkg
}

func (cp *CodePath) GetDefaultActionPolicy() *PrivacyConfig {
	if cp.config == nil || cp.config.Codegen == nil || cp.config.Codegen.DefaultActionPolicy == nil {
		return &PrivacyConfig{
			Path:       codepath.Package,
			PolicyName: "AllowIfViewerHasIdentityPrivacyPolicy",
		}
	}
	return cp.config.Codegen.DefaultActionPolicy
}

func (cp *CodePath) GetDefaultEntPolicy() *PrivacyConfig {
	if cp.config == nil || cp.config.Codegen == nil || cp.config.Codegen.DefaultEntPolicy == nil {
		return &PrivacyConfig{
			Path:       codepath.Package,
			PolicyName: "AllowIfViewerPrivacyPolicy",
		}
	}
	return cp.config.Codegen.DefaultEntPolicy
}

// ImportPackage refers to TypeScript paths of what needs to be generated for imports
type ImportPackage struct {
	PackagePath        string
	AuthPackagePath    string
	ActionPackagePath  string
	SchemaPackagePath  string
	GraphQLPackagePath string
	InternalImportPath string
	ExternalImportPath string
}

func parseConfig() (*config, error) {
	paths := []string{
		"ent.yml",
		"src/ent.yml",
		"src/graphql/ent.yml",
	}
	for _, p := range paths {
		fi, err := os.Stat(p)
		if os.IsNotExist(err) {
			spew.Dump("not exist", p)
			continue
		}
		if err != nil {
			return nil, err
		}
		if fi.IsDir() {
			return nil, fmt.Errorf("%s is a directory", p)
		}
		f, err := os.Open(p)
		if err != nil {
			return nil, errors.Wrap(err, "error opening file")
		}
		b, err := io.ReadAll(f)
		if err != nil {
			return nil, err
		}
		var c config
		if err := yaml.Unmarshal(b, &c); err != nil {
			return nil, err
		}
		return &c, nil
	}
	return nil, nil
}

type config struct {
	Codegen *CodegenConfig `yaml:"codegen"`
}

type CodegenConfig struct {
	DefaultEntPolicy    *PrivacyConfig `yaml:"defaultEntPolicy"`
	DefaultActionPolicy *PrivacyConfig `yaml:"defaultActionPolicy"`
}

type PrivacyConfig struct {
	Path       string `yaml:"path"`
	PolicyName string `yaml:"policyName"`
	Class      bool   `yaml:"class"`
}
