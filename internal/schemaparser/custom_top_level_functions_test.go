package schemaparser_test

import (
	"go/types"
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
)

func testFunc(t *testing.T, nodeName, code string, fn func([]*schemaparser.Function) expectedFunction) {
	fns := getParsedFuncs(t, code)

	assert.Len(t, fns, 1)

	functions := fns[nodeName]
	assert.NotNil(t, functions)

	expectedFn := fn(functions)

	validateExpectedFunctions(t, []expectedFunction{expectedFn}, functions)
}

func TestFuncThatReturnsOneItem(t *testing.T) {
	testFunc(
		t,
		"Query",
		`package graphql
 
	import "time"

 // @graphql serverTime
 func serverTime() time.Time {
	 return time.Now()
 }
 `,
		func(_ []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Query",
				graphqlName:  "serverTime",
				functionName: "serverTime",
				pkg:          "graphql",
				results: []field{
					field{
						name: "time", // from default field name
						typ:  &enttype.TimestampType{},
					},
				},
			}
		},
	)
}

func TestFuncWithArgs(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql

	import "context"

 // @graphql logEvent Mutation
 func Log(ctx context.Context, event string) {
	// TODO
 }
 `,
		func(functions []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Mutation",
				graphqlName:  "logEvent",
				functionName: "Log",
				pkg:          "graphql",
				args: []field{
					field{
						name: "ctx",
						typ: enttype.NewNamedType(
							getFieldFromArg(t, functions, "logEvent", "ctx").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "event",
						typ:  &enttype.StringType{},
					},
				},
			}
		},
	)
}

func TestFuncThatReturnsError(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
// @graphql logEvent Mutation
func Log() error {
	return nil
}
`,
		func(functions []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Mutation",
				graphqlName:  "logEvent",
				functionName: "Log",
				pkg:          "graphql",
				results: []field{
					field{
						name: "", // no name
						typ: enttype.NewNamedType(
							getFieldFromResult(t, functions, "logEvent", "").GetGoType(),
							false,
							false,
						),
					},
				},
			}
		},
	)
}

func TestFuncThatTakesSliceOfScalar(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"

 // @graphql viewerBlock Mutation
 func Block(ctx context.Context, userIDs []string) error {
	 return nil
 }
 `,
		func(functions []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Mutation",
				graphqlName:  "viewerBlock",
				functionName: "Block",
				pkg:          "graphql",
				args: []field{
					field{
						name: "ctx",
						typ: enttype.NewNamedType(
							getFieldFromArg(t, functions, "viewerBlock", "ctx").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "userIDs",
						typ: enttype.NewSliceType(
							getFieldFromArg(t, functions, "viewerBlock", "userIDs").GetGoType().(*types.Slice),
						),
					},
				},
				results: []field{
					field{
						name: "", // no name
						typ: enttype.NewNamedType(
							getFieldFromResult(t, functions, "viewerBlock", "").GetGoType(),
							false,
							false,
						),
					},
				},
			}
		},
	)
}

func getParsedFuncs(t *testing.T, code string) schemaparser.FunctionMap {
	result := getParsedCustomGQLResult(t, code)
	assert.Nil(t, result.Error)

	assert.Len(t, result.Objects, 0)
	return result.Functions
}
