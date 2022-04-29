package codegenapi

import "github.com/iancoleman/strcase"

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

// this file exists to simplify circular dependencies
type Config interface {
	DefaultGraphQLMutationName() GraphQLMutationName
	DefaultGraphQLFieldFormat() GraphQLFieldFormat
	GetRootPathToConfigs() string
	DebugMode() bool
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

var _ Config = &DummyConfig{}

func GraphQLName(cfg Config, name string) string {
	if cfg.DefaultGraphQLFieldFormat() == LowerCamelCase {
		return strcase.ToLowerCamel(name)
	}
	return strcase.ToSnake(name)
}
