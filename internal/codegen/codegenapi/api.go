package codegenapi

import (
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codepath"
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

// this file exists to simplify circular dependencies
type Config interface {
	DefaultGraphQLMutationName() GraphQLMutationName
	DefaultGraphQLFieldFormat() GraphQLFieldFormat
	FieldPrivacyEvaluated() FieldPrivacyEvaluated
	GetRootPathToConfigs() string
	DebugMode() bool
	// doesn't actually writes the files, just keeps track of which files were going to be written
	// used to detect dangling files...
	DummyWrite() bool
	GetTemplatizedViewer() *ViewerConfig
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

func (cfg DummyConfig) FieldPrivacyEvaluated() FieldPrivacyEvaluated {
	return OnDemand
}

func (cfg DummyConfig) DummyWrite() bool {
	return false
}

func (cfg DummyConfig) GetTemplatizedViewer() *ViewerConfig {
	return &ViewerConfig{
		Path: codepath.Package,
		Name: "Viewer",
	}
}

var _ Config = &DummyConfig{}

func GraphQLName(cfg Config, name string) string {
	if cfg.DefaultGraphQLFieldFormat() == LowerCamelCase {
		return strcase.ToLowerCamel(name)
	}
	return strcase.ToSnake(name)
}
