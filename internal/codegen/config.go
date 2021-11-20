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
	debugMode             bool
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

func NewTestConfig(configPath, modulePath string, codegenCfg *CodegenConfig) (*Config, error) {
	cfg, err := NewConfig(configPath, modulePath)
	if err != nil {
		return nil, err
	}
	cfg.config = &config{
		Codegen: codegenCfg,
	}
	return cfg, nil
}

func (cfg *Config) SetDebugMode(debugMode bool) {
	cfg.debugMode = true
}

func (cfg *Config) DebugMode() bool {
	return cfg.debugMode
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

func (cfg *Config) getCodegenConfig() *CodegenConfig {
	if cfg.config != nil && cfg.config.Codegen != nil {
		return cfg.config.Codegen
	}
	return nil
}

func (cfg *Config) ShouldUseRelativePaths() bool {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.RelativeImports
	}
	return false
}

func (cfg *Config) DisableBase64Encoding() bool {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.DisableBase64Encoding
	}
	return false
}

func (cfg *Config) Base64EncodeIDs() bool {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return !codegen.DisableBase64Encoding
	}
	return true
}

func (cfg *Config) GenerateNodeQuery() bool {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return !codegen.GenerateRootResolvers
	}
	return true
}

func (cfg *Config) GenerateRootResolvers() bool {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.GenerateRootResolvers
	}
	return false
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
	if codegen := cfg.getCodegenConfig(); codegen != nil && codegen.DefaultActionPolicy != nil {
		return codegen.DefaultActionPolicy
	}
	return &PrivacyConfig{
		Path:       codepath.Package,
		PolicyName: "AllowIfViewerHasIdentityPrivacyPolicy",
	}
}

func (cfg *Config) GetDefaultEntPolicy() *PrivacyConfig {
	if codegen := cfg.getCodegenConfig(); codegen != nil && codegen.DefaultEntPolicy != nil {
		return codegen.DefaultEntPolicy
	}
	return &PrivacyConfig{
		Path:       codepath.Package,
		PolicyName: "AllowIfViewerPrivacyPolicy",
	}
}

func (cfg *Config) DisableGraphQLRoot() bool {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.DisableGraphQLRoot
	}

	return false
}

func (cfg *Config) GeneratedHeader() string {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.GeneratedHeader
	}
	return ""
}

// options: https://prettier.io/docs/en/options.html
var defaultArgs = []string{
	"--trailing-comma", "all",
	"--quote-props", "consistent",
	"--parser", "typescript",
	"--end-of-line", "lf",
}

func (cfg *Config) GetPrettierArgs(changedFiles []string) []string {
	if cfg.config == nil || cfg.config.Codegen == nil || cfg.config.Codegen.Prettier == nil {
		// defaults
		res := append(defaultArgs, "--write")
		res = append(res, changedFiles...)
		return res
	}

	prettier := cfg.config.Codegen.Prettier
	if prettier.Custom {
		return append([]string{"--write"}, changedFiles...)
	}

	return append(defaultArgs, "--write")
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
	DefaultEntPolicy      *PrivacyConfig  `yaml:"defaultEntPolicy"`
	DefaultActionPolicy   *PrivacyConfig  `yaml:"defaultActionPolicy"`
	Prettier              *PrettierConfig `yaml:"prettier"`
	RelativeImports       bool            `yaml:"relativeImports"`
	DisableGraphQLRoot    bool            `yaml:"disableGraphQLRoot"`
	GeneratedHeader       string          `yaml:"generatedHeader"`
	DisableBase64Encoding bool            `yaml:"disableBase64Encoding"`
	GenerateRootResolvers bool            `yaml:"generateRootResolvers"`
}

type PrivacyConfig struct {
	Path       string `yaml:"path"`
	PolicyName string `yaml:"policyName"`
	Class      bool   `yaml:"class"`
}

type PrettierConfig struct {
	Custom bool `yaml:"custom"`
}
