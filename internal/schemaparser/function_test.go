package schemaparser_test

import (
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
)

type expectedFunction struct {
	nodeName     string
	graphqlName  string
	functionName string
	args         []field
	results      []field
	pkg          string // can't get the entire path since it's generated so settle for package comparison
}

type field struct {
	name        string
	typ         enttype.Type
	graphqlType string
}

func validateExpectedFunctions(t *testing.T, expectedFunctions []expectedFunction, fns []*schemaparser.Function) {
	assert.Equal(t, len(expectedFunctions), len(fns))

	for idx, expFn := range expectedFunctions {
		fn := fns[idx]

		_, pkg := filepath.Split(fn.PackagePath)
		assert.Equal(t, expFn.pkg, pkg)
		assert.Equal(t, expFn.nodeName, fn.NodeName)
		assert.Equal(t, expFn.graphqlName, fn.GraphQLName)
		assert.Equal(t, expFn.functionName, fn.FunctionName)

		validateFields(t, expFn.results, fn.Results)

		validateFields(t, expFn.args, fn.Args)
	}
}

func validateFields(t *testing.T, expFields []field, fields []*schemaparser.Field) {
	assert.Len(t, fields, len(expFields))

	for j, expField := range expFields {
		f := fields[j]

		assert.Equal(t, expField.name, f.Name)
		assert.Equal(t, expField.typ, f.Type)

		if expField.graphqlType != "" {
			assert.Equal(t, expField.graphqlType, f.Type.GetGraphQLType())
		}
	}
}
