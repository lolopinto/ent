package names

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type test struct {
	input  string
	output []string
}

func TestSplit(t *testing.T) {
	tests := []test{
		{"", []string{}},
		{"lowercase", []string{"lowercase"}},
		{"Class", []string{"Class"}},
		{"MyClass", []string{"My", "Class"}},
		{"MyC", []string{"My", "C"}},
		{"HTML", []string{"HTML"}},
		{"PDFLoader", []string{"PDF", "Loader"}},
		{"AString", []string{"A", "String"}},
		{"SimpleXMLParser", []string{"Simple", "XML", "Parser"}},
		{"vimRPCPlugin", []string{"vim", "RPC", "Plugin"}},
		{"GL11Version", []string{"GL", "11", "Version"}},
		{"99Bottles", []string{"99", "Bottles"}},
		{"May5", []string{"May", "5"}},
		{"BFG9000", []string{"BFG", "9000"}},
		{"BöseÜberraschung", []string{"Böse", "Überraschung"}},
		{"Two  spaces", []string{"Two", "  ", "spaces"}},
		{"BadUTF8\xe2\xe2\xa1", []string{"BadUTF8\xe2\xe2\xa1"}},
		{"192ndDay", []string{"192nd", "Day"}},
		{"userIDs", []string{"user", "ID", "s"}},
		{"Ms", []string{"Ms"}},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			actual := splitCamelCase(tt.input)
			assert.Equal(t, tt.output, actual)
		})
	}
}
