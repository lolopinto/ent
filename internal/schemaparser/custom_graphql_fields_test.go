package schemaparser

import (
	"go/types"
	"testing"

	"github.com/stretchr/testify/assert"
)

func (f *Field) GetGoType() types.Type {
	return f.goType
}

func TestNilParams(t *testing.T) {
	resultChan := ParseCustomGraphQLDefinitions(nil, nil)
	result := <-resultChan
	assert.Nil(t, result.Error)
	assert.Len(t, result.Functions, 0)
	assert.Len(t, result.Objects, 0)
}
