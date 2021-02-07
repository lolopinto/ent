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

func TestFuncThatTakesObject(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql viewerBlock Mutation
 func Block(ctx context.Context, user *models.User) error {
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
						name: "user",
						typ: enttype.NewPointerType(
							getFieldFromArg(t, functions, "viewerBlock", "user").GetGoType(),
							false,
							false,
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

func TestFuncThatOverridesParamName(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql viewerBlock Mutation
 // @graphqlparam blockee user
 func Block(ctx context.Context, blockee *models.User) error {
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
						name: "user",
						typ: enttype.NewPointerType(
							getFieldFromArg(t, functions, "viewerBlock", "user").GetGoType(),
							false,
							false,
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

func TestFuncThatTakesMultipleObjectOfSameType(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql viewerBlock Mutation
 func Block(ctx context.Context, user, user2 *models.User) error {
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
						name: "user",
						typ: enttype.NewPointerType(
							getFieldFromArg(t, functions, "viewerBlock", "user").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "user2",
						typ: enttype.NewPointerType(
							getFieldFromArg(t, functions, "viewerBlock", "user2").GetGoType(),
							false,
							false,
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

func TestFuncThatTakesSliceOfObject(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql viewerBlock Mutation
 func Block(ctx context.Context, users []*models.User) error {
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
						name: "users",
						typ: enttype.NewSliceType(
							getFieldFromArg(t, functions, "viewerBlock", "users").GetGoType().(*types.Slice),
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

func TestFuncThatReturnsMultipleNamedItems(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql authUser Mutation
 func Auth(ctx context.Context, email, password string) (user *models.User, token string, err error) {
	 return nil, "", nil
 }
 `,
		func(functions []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Mutation",
				graphqlName:  "authUser",
				functionName: "Auth",
				pkg:          "graphql",
				args: []field{
					field{
						name: "ctx",
						typ: enttype.NewNamedType(
							getFieldFromArg(t, functions, "authUser", "ctx").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "email",
						typ:  &enttype.StringType{},
					},
					field{
						name: "password",
						typ:  &enttype.StringType{},
					},
				},
				results: []field{
					field{
						name: "user",
						typ: enttype.NewPointerType(
							getFieldFromResult(t, functions, "authUser", "user").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "token",
						typ:  &enttype.StringType{},
					},
					field{
						name: "err",
						typ: enttype.NewNamedType(
							getFieldFromResult(t, functions, "authUser", "err").GetGoType(),
							false,
							false,
						),
					},
				},
			}
		},
	)
}

func TestFuncThatReturnsMultipleItemsGraphQLReturn(t *testing.T) {
	testFunc(
		t,
		"Mutation",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql authUser Mutation
 // @graphqlreturn user
 // @graphqlreturn token
 func Auth(ctx context.Context, email, password string) (*models.User, string, error) {
	 return nil, "", nil
 }
 `,
		func(functions []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Mutation",
				graphqlName:  "authUser",
				functionName: "Auth",
				pkg:          "graphql",
				args: []field{
					field{
						name: "ctx",
						typ: enttype.NewNamedType(
							getFieldFromArg(t, functions, "authUser", "ctx").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "email",
						typ:  &enttype.StringType{},
					},
					field{
						name: "password",
						typ:  &enttype.StringType{},
					},
				},
				results: []field{
					field{
						name: "user",
						typ: enttype.NewPointerType(
							getFieldFromResult(t, functions, "authUser", "user").GetGoType(),
							false,
							false,
						),
					},
					field{
						name: "token",
						typ:  &enttype.StringType{},
					},
					field{
						name: "",
						typ: enttype.NewNamedType(
							getFieldFromResult(t, functions, "authUser", "").GetGoType(),
							false,
							false,
						),
					},
				},
			}
		},
	)
}

func TestFuncThatReturnsNonNullItem(t *testing.T) {
	testFunc(
		t,
		"Query",
		`package graphql
 
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"

 // @graphql loggedInUser Query
 // @graphqlreturn user @required
 func loggedInUser(ctx context.Context) *models.User {
	 return &models.User{}
 }
 `,
		func(functions []*schemaparser.Function) expectedFunction {
			return expectedFunction{
				nodeName:     "Query",
				graphqlName:  "loggedInUser",
				functionName: "loggedInUser",
				pkg:          "graphql",
				args: []field{
					field{
						name: "ctx",
						typ: enttype.NewNamedType(
							getFieldFromArg(t, functions, "loggedInUser", "ctx").GetGoType(),
							false,
							false,
						),
					},
				},
				results: []field{
					field{
						name: "user",
						typ: enttype.NewPointerType(
							getFieldFromResult(t, functions, "loggedInUser", "user").GetGoType(),
							false,
							true,
						),
						graphqlType: "User!",
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
