package schemaparser_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
)

func TestNewGraphQLObject(t *testing.T) {
	testObj(
		t,
		`package graphql

	import "github.com/lolopinto/ent/ent/viewer"

// @graphqltype Viewer
type Viewer struct {
	v viewer.ViewerContext

	// @graphql 
	ViewerID string

	loadedUser bool
}
`,
		func(_ []*schemaparser.Object) expectedObject {
			return expectedObject{
				name:        "Viewer",
				graphqlName: "Viewer",
				pkg:         "graphql",
				fields: []field{
					field{
						name: "viewerID",
						typ:  &enttype.StringType{},
					},
				},
			}
		},
	)
}

func TestFuncWhichReferencesNewObj(t *testing.T) {
	code := `package graphql

	import "context"
	import "github.com/lolopinto/ent/ent/viewer"

// @graphql viewer Query
func viewerr(ctx context.Context) (*Viewer, error) {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		return nil, err
	}

	return &Viewer{v:v}, nil
}

// @graphqltype Viewer
type Viewer struct {
	v viewer.ViewerContext

	// @graphql 
	ViewerID string
}
	`
	result := getParsedCustomGQLResult(t, code)

	assert.Nil(t, result.Error)
	objs := result.Objects
	assert.Len(t, objs, 1)

	expectedObj := expectedObject{
		name:        "Viewer",
		graphqlName: "Viewer",
		pkg:         "graphql",
		fields: []field{
			field{
				name: "viewerID",
				typ:  &enttype.StringType{},
			},
		},
	}
	validateExpectedObjects(t, []expectedObject{expectedObj}, objs)

	functionMap := result.Functions
	// viewerr function which returns Viewer
	assert.Len(t, functionMap, 1)

	functions := functionMap["Query"]
	assert.NotNil(t, functions)

	expectedFunc := expectedFunction{
		nodeName:     "Query",
		graphqlName:  "viewer",
		functionName: "viewerr",
		pkg:          "graphql",
		args: []field{
			field{
				name: "ctx",
				typ: enttype.NewNamedType(
					getFieldFromArg(t, functions, "viewer", "ctx").GetGoType(),
					false,
					false,
				),
			},
		},
		results: []field{
			field{
				name: "viewer",
				typ: enttype.NewPointerType(
					getFieldFromResult(t, functions, "viewer", "viewer").GetGoType(),
					false,
					false,
				),
			},
			field{
				name: "",
				typ: enttype.NewNamedType(
					getFieldFromResult(t, functions, "viewer", "").GetGoType(),
					false,
					false,
				),
			},
		},
	}
	validateExpectedFunctions(t, []expectedFunction{expectedFunc}, functions)
}

func testObj(t *testing.T, code string, fn func([]*schemaparser.Object) expectedObject) {
	testObjWithFns(
		t,
		code,
		func(objects []*schemaparser.Object, _ []*schemaparser.Function) expectedObject {
			return fn(objects)
		},
	)
}

func testObjWithFns(
	t *testing.T,
	code string,
	fn func([]*schemaparser.Object, []*schemaparser.Function) expectedObject) {
	result := getParsedCustomGQLResult(t, code)
	assert.Nil(t, result.Error)

	objs := result.Objects

	assert.Len(t, objs, 1)

	expectedNode := objs[0].GraphQLName

	functions := result.Functions[expectedNode]

	expectedObj := fn(objs, functions)

	validateExpectedObjects(t, []expectedObject{expectedObj}, objs)

	assert.Len(t, functions, len(expectedObj.functions))

	validateExpectedFunctions(t, expectedObj.functions, functions)
}
