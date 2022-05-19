package codegen

import (
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/schema/change"
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
	// writeAll, even if changes are valid, still write all the files
	writeAll bool
	// changes are valid
	useChanges bool
	dummyWrite bool
	changes    change.ChangeMap
	// keep track of changed ts files to pass to prettier
	changedTSFiles []string
}

// Clone doesn't clone changes and changedTSFiles
func (cfg *Config) Clone() *Config {
	return &Config{
		relativePathToConfigs: cfg.relativePathToConfigs,
		importPathToConfigs:   cfg.importPathToConfigs,
		importPathToModels:    cfg.importPathToModels,
		importPathToRoot:      cfg.importPathToRoot,
		absPathToRoot:         cfg.absPathToRoot,
		absPathToConfigs:      cfg.absPathToConfigs,
		config:                cloneConfig(cfg.config),
		debugMode:             cfg.debugMode,
		writeAll:              cfg.writeAll,
		useChanges:            cfg.useChanges,
	}
}

func (cfg *Config) OverrideGraphQLMutationName(mutationName codegenapi.GraphQLMutationName) {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		codegen.DefaultGraphQLMutationName = mutationName
		return
	}
	cfg.config = &config{
		Codegen: &CodegenConfig{
			DefaultGraphQLMutationName: mutationName,
		},
	}
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
	cfg.writeAll = true
	if err != nil {
		return nil, err
	}
	cfg.config = &config{
		Codegen: codegenCfg,
	}
	return cfg, nil
}

func (cfg *Config) SetDebugMode(debugMode bool) {
	cfg.debugMode = debugMode
}

func (cfg *Config) SetWriteAll(writeAll bool) {
	cfg.writeAll = writeAll
}

func (cfg *Config) SetUseChanges(useChanges bool) {
	cfg.useChanges = useChanges
}

func (cfg *Config) SetChangeMap(changes change.ChangeMap) {
	cfg.changes = changes
}

// In rare scenarios, we can have UseChanges() and WriteAll() be true if
// ent.yml changed so that we can process deletes also
func (cfg *Config) UseChanges() bool {
	return cfg.useChanges
}

func (cfg *Config) WriteAllFiles() bool {
	return cfg.writeAll
}

func (cfg *Config) ChangeMap() change.ChangeMap {
	return cfg.changes
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

func (cfg *Config) GetPathToSchemaFile() string {
	return path.Join(cfg.GetAbsPathToRoot(), ".ent/schema.json")
}

func (cfg *Config) GetPathToCustomSchemaFile() string {
	return path.Join(cfg.GetAbsPathToRoot(), ".ent/custom_schema.json")
}

func (cfg *Config) GetPathToBuildFile() string {
	return path.Join(cfg.GetAbsPathToRoot(), ".ent/build_info.yaml")
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

func (cfg *Config) AddChangedFile(filePath string) {
	if strings.HasSuffix(filePath, ".ts") {
		cfg.changedTSFiles = append(cfg.changedTSFiles, filePath)
	}
}

func (cfg *Config) GetChangedTSFiles() []string {
	return cfg.changedTSFiles
}

func (cfg *Config) GetCustomGraphQLJSONPath() string {
	if cfg.config == nil {
		return ""
	}
	return cfg.config.CustomGraphQLJSONPath
}

func (cfg *Config) DummyWrite() bool {
	return cfg.dummyWrite
}

func (cfg *Config) SetDummyWrite(val bool) {
	cfg.dummyWrite = val
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

func (cfg *Config) DefaultGraphQLMutationName() codegenapi.GraphQLMutationName {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		if codegen.DefaultGraphQLMutationName != "" {
			return codegen.DefaultGraphQLMutationName
		}
	}
	return codegenapi.NounVerb
}

func (cfg *Config) DefaultGraphQLFieldFormat() codegenapi.GraphQLFieldFormat {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		if codegen.DefaultGraphQLFieldFormat != "" {
			return codegen.DefaultGraphQLFieldFormat
		}
	}
	return codegenapi.LowerCamelCase
}

func (cfg *Config) SchemaSQLFilePath() string {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.SchemaSQLFilePath
	}
	return ""
}

func (cfg *Config) DatabaseToCompareTo() string {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		return codegen.DatabaseToCompareTo
	}
	return ""
}

func (cfg *Config) FieldPrivacyEvaluated() codegenapi.FieldPrivacyEvaluated {
	if codegen := cfg.getCodegenConfig(); codegen != nil {
		if codegen.DefaultGraphQLFieldFormat != "" {
			return codegen.FieldPrivacyEvaluated
		}
	}
	return codegenapi.OnDemand
}

func (cfg *Config) GetTemplatizedViewer() *ViewerConfig {
	if codegen := cfg.getCodegenConfig(); codegen != nil && codegen.TemplatizedViewer != nil {
		return codegen.TemplatizedViewer
	}
	return &ViewerConfig{
		Path: codepath.Package,
		Name: "Viewer",
	}
}

const DEFAULT_GLOB = "src/**/*.ts"
const PRETTIER_FILE_CHUNKS = 20

// options: https://prettier.io/docs/en/options.html
var defaultArgs = []string{
	"--trailing-comma", "all",
	"--quote-props", "consistent",
	"--parser", "typescript",
	"--end-of-line", "lf",
}

func (cfg *Config) getPrettierArgs() [][]string {
	// nothing to do here
	if cfg.useChanges && len(cfg.changedTSFiles) == 0 {
		return nil
	}

	glob := DEFAULT_GLOB
	args := defaultArgs

	if cfg.config != nil && cfg.config.Codegen != nil && cfg.config.Codegen.Prettier != nil {
		prettier := cfg.config.Codegen.Prettier

		if prettier.Glob != "" {
			glob = prettier.Glob
		}
		if prettier.Custom {
			args = []string{}
		}
	}

	// if writeAll, break into src/ent/**/*.ts and src/graphql/**/*.ts
	if cfg.writeAll {
		return [][]string{
			append(args, "--write", "src/ent/**/*.ts"),
			append(args, "--write", "src/graphql/**/*.ts"),
		}
	}

	if !cfg.useChanges {
		return [][]string{
			append(args, "--write", glob),
		}
	}

	// else break up into chunks and run each on its own

	var ret [][]string
	l := len(cfg.changedTSFiles)
	iters := l / PRETTIER_FILE_CHUNKS
	if l%PRETTIER_FILE_CHUNKS > 0 {
		iters++
	}
	for i := 0; i < iters; i++ {
		start := i * PRETTIER_FILE_CHUNKS
		var files []string
		end := start + PRETTIER_FILE_CHUNKS
		if end > l {
			files = cfg.changedTSFiles[start:]
		} else {
			files = cfg.changedTSFiles[start:end]
		}
		curr := append(args, "--write")
		curr = append(curr, files...)
		ret = append(ret, curr)
	}
	return ret
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
	Codegen               *CodegenConfig `yaml:"codegen"`
	CustomGraphQLJSONPath string         `yaml:"customGraphQLJSONPath"`
}

func (cfg *config) Clone() *config {
	return &config{
		Codegen:               cloneCodegen(cfg.Codegen),
		CustomGraphQLJSONPath: cfg.CustomGraphQLJSONPath,
	}
}

func cloneConfig(cfg *config) *config {
	if cfg == nil {
		return nil
	}
	return cfg.Clone()
}

type CodegenConfig struct {
	DefaultEntPolicy           *PrivacyConfig                   `yaml:"defaultEntPolicy"`
	DefaultActionPolicy        *PrivacyConfig                   `yaml:"defaultActionPolicy"`
	Prettier                   *PrettierConfig                  `yaml:"prettier"`
	RelativeImports            bool                             `yaml:"relativeImports"`
	DisableGraphQLRoot         bool                             `yaml:"disableGraphQLRoot"`
	GeneratedHeader            string                           `yaml:"generatedHeader"`
	DisableBase64Encoding      bool                             `yaml:"disableBase64Encoding"`
	GenerateRootResolvers      bool                             `yaml:"generateRootResolvers"`
	DefaultGraphQLMutationName codegenapi.GraphQLMutationName   `yaml:"defaultGraphQLMutationName"`
	DefaultGraphQLFieldFormat  codegenapi.GraphQLFieldFormat    `yaml:"defaultGraphQLFieldFormat"`
	SchemaSQLFilePath          string                           `yaml:"schemaSQLFilePath"`
	DatabaseToCompareTo        string                           `yaml:"databaseToCompareTo"`
	FieldPrivacyEvaluated      codegenapi.FieldPrivacyEvaluated `yaml:"fieldPrivacyEvaluated"`
	TemplatizedViewer          *ViewerConfig                    `yaml:"templatizedViewer"`
}

func cloneCodegen(cfg *CodegenConfig) *CodegenConfig {
	if cfg == nil {
		return nil
	}
	return cfg.Clone()
}

func (cfg *CodegenConfig) Clone() *CodegenConfig {
	return &CodegenConfig{
		DefaultEntPolicy:           clonePrivacyConfig(cfg.DefaultEntPolicy),
		DefaultActionPolicy:        clonePrivacyConfig(cfg.DefaultActionPolicy),
		Prettier:                   clonePrettierConfig(cfg.Prettier),
		RelativeImports:            cfg.RelativeImports,
		DisableGraphQLRoot:         cfg.DisableGraphQLRoot,
		GeneratedHeader:            cfg.GeneratedHeader,
		DisableBase64Encoding:      cfg.DisableBase64Encoding,
		GenerateRootResolvers:      cfg.GenerateRootResolvers,
		DefaultGraphQLMutationName: cfg.DefaultGraphQLMutationName,
		DefaultGraphQLFieldFormat:  cfg.DefaultGraphQLFieldFormat,
		SchemaSQLFilePath:          cfg.SchemaSQLFilePath,
		DatabaseToCompareTo:        cfg.DatabaseToCompareTo,
		FieldPrivacyEvaluated:      cfg.FieldPrivacyEvaluated,
		TemplatizedViewer:          cloneViewerConfig(cfg.TemplatizedViewer),
	}
}

func clonePrivacyConfig(cfg *PrivacyConfig) *PrivacyConfig {
	if cfg == nil {
		return nil
	}
	return cfg.Clone()
}

type PrivacyConfig struct {
	Path       string `yaml:"path"`
	PolicyName string `yaml:"policyName"`
	Class      bool   `yaml:"class"`
}

func (cfg *PrivacyConfig) Clone() *PrivacyConfig {
	return &PrivacyConfig{
		Path:       cfg.Path,
		PolicyName: cfg.PolicyName,
		Class:      cfg.Class,
	}
}

func cloneViewerConfig(cfg *ViewerConfig) *ViewerConfig {
	if cfg == nil {
		return nil
	}
	return cfg.Clone()
}

type ViewerConfig struct {
	Path string `yaml:"path"`
	Name string `yaml:"name"`
}

func (cfg *ViewerConfig) Clone() *ViewerConfig {
	return &ViewerConfig{
		Path: cfg.Path,
		Name: cfg.Name,
	}
}

func clonePrettierConfig(cfg *PrettierConfig) *PrettierConfig {
	if cfg == nil {
		return nil
	}
	return cfg.Clone()
}

type PrettierConfig struct {
	Custom bool   `yaml:"custom"`
	Glob   string `yaml:"glob"`
}

func (cfg *PrettierConfig) Clone() *PrettierConfig {
	return &PrettierConfig{
		Custom: cfg.Custom,
		Glob:   cfg.Glob,
	}
}
