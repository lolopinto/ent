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

type expectedObject struct {
	name        string // struct name
	graphqlName string
	pkg         string // can't get the entire path since it's generated so settle for package comparison
	fields      []field
	functions   []expectedFunction
}

func validateExpectedFunctions(t *testing.T, expectedFunctions []expectedFunction, fns []*schemaparser.Function) {
	assert.Equal(t, len(expectedFunctions), len(fns))

	for idx, expFn := range expectedFunctions {
		fn := fns[idx]

		assert.Equal(t, expFn.nodeName, fn.NodeName)
		assert.Equal(t, expFn.graphqlName, fn.GraphQLName)
		assert.Equal(t, expFn.functionName, fn.FunctionName)

		validatePackage(t, expFn.pkg, fn.PackagePath)

		validateFields(t, expFn.results, fn.Results)

		validateFields(t, expFn.args, fn.Args)
	}
}

func validateExpectedObjects(t *testing.T, expectedObjects []expectedObject, objs []*schemaparser.Object) {
	assert.Equal(t, len(expectedObjects), len(objs))

	for idx, expObj := range expectedObjects {
		obj := objs[idx]

		assert.Equal(t, expObj.name, obj.Name)
		assert.Equal(t, expObj.graphqlName, obj.GraphQLName)

		validatePackage(t, expObj.pkg, obj.PackagePath)

		validateFields(t, expObj.fields, obj.Fields)
	}
}

func validatePackage(t *testing.T, expectedPackage, packagePath string) {
	_, pkg := filepath.Split(packagePath)
	assert.Equal(t, expectedPackage, pkg)
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

func getFieldFromArg(t *testing.T, functions []*schemaparser.Function, graphqlName, argName string) *schemaparser.Field {
	for _, f := range functions {
		if f.GraphQLName == graphqlName {
			for _, arg := range f.Args {
				if arg.Name == argName {
					return arg
				}
			}
			break
		}
	}
	assert.FailNow(t, "couldn't find field %s from arg with graphql name %s", argName, graphqlName)
	return nil
}

func getFieldFromResult(t *testing.T, functions []*schemaparser.Function, graphqlName, name string) *schemaparser.Field {
	for _, f := range functions {
		if f.GraphQLName == graphqlName {
			for _, result := range f.Results {
				if result.Name == name {
					return result
				}
			}
			break
		}
	}
	assert.FailNow(t, "couldn't find field %s from result with graphql name %s", name, graphqlName)
	return nil
}

func getFieldOfObject(t *testing.T, objects []*schemaparser.Object, graphqlName, fieldName string) *schemaparser.Field {
	for _, obj := range objects {
		if obj.GraphQLName == graphqlName {
			for _, field := range obj.Fields {
				if field.Name == fieldName {
					return field
				}
			}
			break
		}
	}
	assert.FailNow(t, "couldn't find field %s of object with graphql Name %s", fieldName, graphqlName)
	return nil
}
