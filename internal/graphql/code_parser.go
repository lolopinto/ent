package graphql

import (
	"fmt"
	"path/filepath"
	"regexp"
)

var entFileRegex = regexp.MustCompile(`(\w+)_gen.go`)

type customEntParser struct {
	schema *graphQLSchema
}

func newCustomEntParser(schema *graphQLSchema) *customEntParser {
	return &customEntParser{
		schema: schema,
	}
}

func (p *customEntParser) ValidateFnReceiver(name string) error {
	if p.schema.Types[name] == nil {
		return fmt.Errorf("invalid type %s should not have @graphql decoration", name)
	}
	return nil
}

func (p *customEntParser) ProcessFileName(filename string) bool {
	match := entFileRegex.FindStringSubmatch(filename)
	// we don't want generated files
	return len(match) != 2
}

func (p *customEntParser) ReceiverRequired() bool {
	return true
}

func (p *customEntParser) CreatesComplexTypeForSingleResult() bool {
	return false
}

type customTopLevelParser struct {
}

func (p *customTopLevelParser) ReceiverRequired() bool {
	return false
}

var defaultGraphQLFiles = []string{
	"generated.go",
	"models_gen.go",
	"resolver.go",
}

func (p *customTopLevelParser) ProcessFileName(filename string) bool {
	_, path := filepath.Split(filename)
	for _, p := range defaultGraphQLFiles {
		if p == path {
			return false
		}
	}
	return true
}

func (p *customTopLevelParser) CreatesComplexTypeForSingleResult() bool {
	// not true, only does this for Mutation, not Query...
	return true
}
