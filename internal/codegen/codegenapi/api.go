package codegenapi

import (
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/tsimport"
)

type GraphQLMutationName string

const (
	// e.g. userCreate. default
	NounVerb GraphQLMutationName = "NounVerb"

	// e.g. createUser
	VerbNoun GraphQLMutationName = "VerbNoun"
)

const DefaultGraphQLMutationName = NounVerb

type GraphQLFieldFormat string

const (
	LowerCamelCase GraphQLFieldFormat = "lowerCamel"

	SnakeCase GraphQLFieldFormat = "snake_case"
)

type FieldPrivacyEvaluated string

const (
	AtEntLoad FieldPrivacyEvaluated = "at_ent_load"
	OnDemand  FieldPrivacyEvaluated = "on_demand"
)

type ImportedObject struct {
	Path  string `yaml:"path"`
	Name  string `yaml:"name"`
	Alias string `yaml:"alias"`
}

func (cfg *ImportedObject) Clone() *ImportedObject {
	return &ImportedObject{
		Path:  cfg.Path,
		Name:  cfg.Name,
		Alias: cfg.Alias,
	}
}

func (cfg *ImportedObject) GetImport() string {
	if cfg.Alias != "" {
		return cfg.Alias
	}
	return cfg.Name
}

func (cfg *ImportedObject) GetImportPath() *tsimport.ImportPath {
	ret := &tsimport.ImportPath{
		ImportPath: strings.TrimSuffix(cfg.Path, ".ts"),
		Import:     cfg.Name,
	}
	if cfg.Alias != "" {
		ret.OriginalImport = cfg.Name
		ret.Import = cfg.Alias
	}
	return ret
}

// this file exists to simplify circular dependencies
type Config interface {
	DefaultGraphQLMutationName() GraphQLMutationName
	DefaultGraphQLFieldFormat() GraphQLFieldFormat
	FieldPrivacyEvaluated() FieldPrivacyEvaluated
	GetRootPathToConfigs() string
	DebugMode() bool
	DebugFilesMode() bool
	// doesn't actually writes the files, just keeps track of which files were going to be written
	// used to detect dangling files...
	DummyWrite() bool
	GetTemplatizedViewer() *ImportedObject
	GetAssocEdgePath() *ImportedObject
}

// DummyConfig exists for tests/legacy paths which need Configs and don't want to create the production one
type DummyConfig struct {
}

func (cfg *DummyConfig) DefaultGraphQLMutationName() GraphQLMutationName {
	return NounVerb
}

func (cfg *DummyConfig) DefaultGraphQLFieldFormat() GraphQLFieldFormat {
	return LowerCamelCase
}

func (cfg *DummyConfig) GetRootPathToConfigs() string {
	return "src/schema"
}

func (cfg *DummyConfig) DebugMode() bool {
	return false
}

func (cfg *DummyConfig) DebugFilesMode() bool {
	return false
}

func (cfg DummyConfig) FieldPrivacyEvaluated() FieldPrivacyEvaluated {
	return OnDemand
}

func (cfg DummyConfig) DummyWrite() bool {
	return false
}

func (cfg DummyConfig) GetTemplatizedViewer() *ImportedObject {
	return &ImportedObject{
		Path: codepath.Package,
		Name: "Viewer",
	}
}

func (cfg DummyConfig) GetAssocEdgePath() *ImportedObject {
	return &ImportedObject{
		Path: codepath.Package,
		Name: "AssocEdge",
	}
}

var _ Config = &DummyConfig{}

func GraphQLName(cfg Config, name string) string {
	// special case id
	if strings.ToLower(name) == "id" {
		return "id"
	}
	if cfg.DefaultGraphQLFieldFormat() == LowerCamelCase {
		return strcase.ToLowerCamel(name)
	}
	return strcase.ToSnake(name)
}
