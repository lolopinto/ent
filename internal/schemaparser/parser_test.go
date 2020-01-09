package schemaparser_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/schemaparser"
)

func validTypes() map[string]bool {
	return map[string]bool{
		"Contact": true,
		"User":    true,
	}
}

// custom_ent_parser for test
type customEntParser struct {
}

func (p *customEntParser) ValidateFnReceiver(name string) error {
	if !validTypes()[name] {
		return fmt.Errorf("invalid type %s should not have @graphql decoration", name)
	}
	return nil
}

func (p *customEntParser) ProcessFileName(filename string) bool {
	return !strings.HasSuffix(filename, "_gen.go")
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

func (p *customTopLevelParser) ProcessFileName(filename string) bool {
	return true
}

func (p *customTopLevelParser) CreatesComplexTypeForSingleResult() bool {
	// not true, only does this for Mutation, not Query...
	return true
}

func getParsedCustomGQLResult(t *testing.T, code string) schemaparser.ParseCustomGQLResult {
	overlay := make(map[string]string)
	overlay["code.go"] = code

	parser := &schemaparser.SourceSchemaParser{
		Sources:     overlay,
		PackageName: "graphql",
	}

	resultChan := schemaparser.ParseCustomGraphQLDefinitions(
		parser,
		&customTopLevelParser{},
	)

	result := <-resultChan
	return result
}
