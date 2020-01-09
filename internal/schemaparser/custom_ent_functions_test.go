package schemaparser_test

import (
	"sync"
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
	testsync "github.com/lolopinto/ent/internal/testingutils/sync"
	"github.com/stretchr/testify/assert"
)

func TestCustomFields(t *testing.T) {
	result := getCustomGraphQLDefinitions(t)

	assert.Equal(t, 2, len(result))
	assert.NotNil(t, result["User"])
	assert.NotNil(t, result["Contact"])
	assert.Nil(t, result["Event"])
}

func TestCustomUserFields(t *testing.T) {
	result := getCustomGraphQLDefinitions(t)
	functions := result["User"]

	assert.Len(t, functions, 2)

	expectedFunctions := []expectedFunction{
		expectedFunction{
			nodeName:     "User",
			graphqlName:  "userFoo",
			functionName: "GetUserFoo",
			pkg:          "models",
			results: []field{
				field{
					typ: &enttype.StringType{},
				},
			},
		},
		expectedFunction{
			nodeName:     "User",
			graphqlName:  "baz",
			functionName: "Baz",
			pkg:          "models",
			results: []field{
				field{
					typ: &enttype.NullableFloatType{},
				},
			},
		},
	}
	validateExpectedFunctions(t, expectedFunctions, functions)
}

func TestCustomContactFields(t *testing.T) {
	result := getCustomGraphQLDefinitions(t)
	functions := result["Contact"]

	assert.Len(t, functions, 2)

	expectedFunctions := []expectedFunction{
		expectedFunction{
			nodeName:     "Contact",
			graphqlName:  "contactFoo",
			functionName: "GetContactFoo",
			pkg:          "models",
			results: []field{
				field{
					typ: &enttype.StringType{},
				},
			},
		},
		expectedFunction{
			nodeName:     "Contact",
			graphqlName:  "contactBar",
			functionName: "GetContactBar",
			pkg:          "models",
			results: []field{
				field{
					typ: &enttype.IntegerType{},
				},
			},
			args: []field{
				field{
					name: "foo",
					typ:  &enttype.IntegerType{},
				},
			},
		},
	}
	validateExpectedFunctions(t, expectedFunctions, functions)
}

func TestCustomSources(t *testing.T) {
	sources := make(map[string]string)

	// let's fake generated file here...
	sources["user_gen.go"] = getFakeGeneratedFile()

	// custom function here.
	sources["user.go"] = `
	package models

	// GetFoo blah blah blah
  // @graphql
func (user *User) GetFoo() string {
	return "foo"
}
`

	result, err := getCustomGraphQLDefinitionsWithOverlays(t, sources)
	assert.Nil(t, err)
	assert.Len(t, result, 1)

	validateExpectedFunctions(
		t,
		[]expectedFunction{
			expectedFunction{
				nodeName:     "User",
				graphqlName:  "foo",
				functionName: "GetFoo",
				pkg:          "models",
				results: []field{
					field{
						typ: &enttype.StringType{},
					},
				},
			},
		},
		result["User"],
	)
}

func TestInvalidReceiver(t *testing.T) {
	sources := make(map[string]string)

	// let's fake generated file here...
	sources["user_gen.go"] = getFakeGeneratedFile()

	// custom function here.
	sources["user.go"] = `
	package models

	// GetFoo blah blah blah
  // @graphql
func (user *User) GetFoo() string {
	return "foo"
}

type Bar struct {}

// GetFoo does crap
// @graphql
func (b Bar) GetFoo() string {
	return "foo 2.0"
}
`
	result, err := getCustomGraphQLDefinitionsWithOverlays(t, sources)
	assert.EqualError(t, err, "invalid type Bar should not have @graphql decoration")
	assert.Nil(t, result)
}

func getFakeGeneratedFile() string {
	return `
	package models

	import (
		"github.com/lolopinto/ent/ent"
		"github.com/lolopinto/ent/ent/privacy"
	)

	type User struct {
		ent.Node
		privacy.AlwaysDenyPrivacyPolicy
	}
`
}

var r *testsync.RunOnce
var once sync.Once

func getRunOnce() *testsync.RunOnce {
	once.Do(func() {
		r = testsync.NewRunOnce(func(t *testing.T, _ string) interface{} {
			resultChan := schemaparser.ParseCustomGraphQLDefinitions(
				&schemaparser.ConfigSchemaParser{
					AbsRootPath: "../test_schema/models",
				},
				&customEntParser{},
			)

			result := <-resultChan
			// verifies we have results and that the results are expected
			assert.Nil(t, result.Error)
			return result.Functions
		})
	})
	return r
}

func getCustomGraphQLDefinitions(t *testing.T) schemaparser.FunctionMap {
	return getRunOnce().Get(t, "").(schemaparser.FunctionMap)
}

func getCustomGraphQLDefinitionsWithOverlays(t *testing.T, sources map[string]string) (schemaparser.FunctionMap, error) {
	resultChan := schemaparser.ParseCustomGraphQLDefinitions(
		&schemaparser.SourceSchemaParser{
			Sources:     sources,
			PackageName: "models",
		},
		&customEntParser{},
	)
	result := <-resultChan
	return result.Functions, result.Error
}
