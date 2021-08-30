package codegen

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"
)

// Config is codegen info/config which is used to pass things
// down the line
type Config struct {
	relativePathToConfigs string
	importPathToConfigs   string
	importPathToModels    string
	importPathToRoot      string
	absPathToRoot         string
	absPathToConfigs      string
	config                *config
}

func NewConfig(configPath, modulePath string) (*Config, error) {
	// TODO all this logic is dependent on passing "models/configs". TODO fix it
	rootPath, err := filepath.Abs(configPath)

	if err != nil {
		return nil, err
	}

	c, err := parseConfig()
	if err != nil {
		return nil, err
	}
	absPathToRoot := filepath.Join(rootPath, "..", "..")

	return &Config{
		relativePathToConfigs: configPath,
		absPathToRoot:         absPathToRoot,
		absPathToConfigs:      rootPath, // this is part to configs root but not root of dir TODO...
		importPathToRoot:      modulePath,
		importPathToConfigs:   filepath.Join(modulePath, configPath),
		importPathToModels:    filepath.Join(modulePath, "models"),
		config:                c,
	}, nil
}

func (cfg *Config) OverrideImportPathToModels(importPath string) {
	cfg.importPathToModels = importPath
}

func (cfg *Config) GetQuotedImportPathToConfigs() string {
	return strconv.Quote(cfg.importPathToConfigs)
}

func (cfg *Config) GetImportPathToModels() string {
	return cfg.importPathToModels
}

func (cfg *Config) GetImportPathToGraphQL() string {
	return filepath.Join(cfg.importPathToRoot, "graphql")
}

func (cfg *Config) GetQuotedImportPathToModels() string {
	return strconv.Quote(cfg.importPathToModels)
}

func (cfg *Config) GetImportPathToRoot() string {
	return cfg.importPathToRoot
}

func (cfg *Config) GetRootPathToConfigs() string {
	return cfg.absPathToConfigs
}

func (cfg *Config) GetRelativePathToConfigs() string {
	return cfg.relativePathToConfigs
}

func (cfg *Config) GetAbsPathToRoot() string {
	return cfg.absPathToRoot
}

// used by golang
func (cfg *Config) AppendPathToModels(paths ...string) string {
	allPaths := append([]string{cfg.importPathToModels}, paths...)
	return filepath.Join(allPaths...)
}

// used by golang
func (cfg *Config) GetAbsPathToModels() string {
	return filepath.Join(cfg.absPathToConfigs, "..")
}

// used by golang
func (cfg *Config) GetAbsPathToGraphQL() string {
	return filepath.Join(cfg.absPathToRoot, "graphql")
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

func (cfg *Config) GetImportPackage() *ImportPackage {
	return impPkg
}

func (cfg *Config) GetDefaultActionPolicy() *PrivacyConfig {
	if cfg.config == nil || cfg.config.Codegen == nil || cfg.config.Codegen.DefaultActionPolicy == nil {
		return &PrivacyConfig{
			Path:       codepath.Package,
			PolicyName: "AllowIfViewerHasIdentityPrivacyPolicy",
		}
	}
	return cfg.config.Codegen.DefaultActionPolicy
}

func (cfg *Config) GetDefaultEntPolicy() *PrivacyConfig {
	if cfg.config == nil || cfg.config.Codegen == nil || cfg.config.Codegen.DefaultEntPolicy == nil {
		return &PrivacyConfig{
			Path:       codepath.Package,
			PolicyName: "AllowIfViewerPrivacyPolicy",
		}
	}
	return cfg.config.Codegen.DefaultEntPolicy
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
