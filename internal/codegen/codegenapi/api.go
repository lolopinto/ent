package codegenapi

import "github.com/iancoleman/strcase"

type GraphQLMutationName string

const (
	// e.g. userCreate. default
	NounVerb GraphQLMutationName = "NounVerb"

	// e.g. createUser
	VerbNoun GraphQLMutationName = "VerbNoun"
)

type GraphQLFieldFormat string

const (
	LowerCamelCase GraphQLFieldFormat = "lowerCamel"

	SnakeCase GraphQLFieldFormat = "snake_case"
)

// this file exists to simplify circular dependencies
type Config interface {
	DefaultGraphQLMutationName() GraphQLMutationName
	DefaultGraphQLFieldFormat() GraphQLFieldFormat
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

var _ Config = &DummyConfig{}

func GraphQLName(cfg Config, name string) string {
	if cfg.DefaultGraphQLFieldFormat() == LowerCamelCase {
		// TODO audit strcase.ToLowerCamel everywhere
		// field & non ent field name has been converted. edge hasn't. what else?
		return strcase.ToLowerCamel(name)
	}
	return strcase.ToSnake(name)
}
