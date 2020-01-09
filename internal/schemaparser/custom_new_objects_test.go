package schemaparser_test

import (
	"go/types"
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

func TestGraphQLObjectWithOverridenName(t *testing.T) {
	testObj(
		t,
		`package graphql

	import "github.com/lolopinto/ent/ent/viewer"
	import "github.com/lolopinto/ent/internal/test_schema/models"

// @graphqltype Viewer
type Viewer struct {
	v viewer.ViewerContext

	// @graphql 
	ViewerID string

	// @graphql account
	User *models.User
}
`,
		func(objects []*schemaparser.Object) expectedObject {
			return expectedObject{
				name:        "Viewer",
				graphqlName: "Viewer",
				pkg:         "graphql",
				fields: []field{
					field{
						name: "viewerID",
						typ:  &enttype.StringType{},
					},
					field{
						name: "account",
						typ: enttype.NewPointerType(
							getFieldOfObject(t, objects, "Viewer", "account").GetGoType(),
							false,
							false,
						),
						graphqlType: "User",
					},
				},
			}
		},
	)
}

func TestGraphQLObjectWithRequiredField(t *testing.T) {
	testObj(
		t,
		`package graphql

	import "github.com/lolopinto/ent/ent/viewer"
	import "github.com/lolopinto/ent/internal/test_schema/models"

// @graphqltype Viewer
type Viewer struct {
	v viewer.ViewerContext

	// @graphql 
	ViewerID string

	// @graphql @required
	User *models.User
}
`,
		func(objects []*schemaparser.Object) expectedObject {
			return expectedObject{
				name:        "Viewer",
				graphqlName: "Viewer",
				pkg:         "graphql",
				fields: []field{
					field{
						name: "viewerID",
						typ:  &enttype.StringType{},
					},
					field{
						name: "user",
						typ: enttype.NewPointerType(
							getFieldOfObject(t, objects, "Viewer", "user").GetGoType(),
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

func TestGraphQLObjectWithRequiredFieldAndOverridenName(t *testing.T) {
	testObj(
		t,
		`package graphql

	import "github.com/lolopinto/ent/ent/viewer"
	import "github.com/lolopinto/ent/internal/test_schema/models"

// @graphqltype Viewer
type Viewer struct {
	v viewer.ViewerContext

	// @graphql 
	ViewerID string

	// @graphql account @required
	User *models.User
}
`,
		func(objects []*schemaparser.Object) expectedObject {
			return expectedObject{
				name:        "Viewer",
				graphqlName: "Viewer",
				pkg:         "graphql",
				fields: []field{
					field{
						name: "viewerID",
						typ:  &enttype.StringType{},
					},
					field{
						name: "account",
						typ: enttype.NewPointerType(
							getFieldOfObject(t, objects, "Viewer", "account").GetGoType(),
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

func TestGraphQLObjectWithFunctions(t *testing.T) {
	testObjWithFns(
		t,
		`package graphql

	import "github.com/lolopinto/ent/ent/viewer"
	import "github.com/lolopinto/ent/internal/test_schema/models"

// @graphqltype Viewer
type Viewer struct {
	v viewer.ViewerContext

	// @graphql 
	ViewerID string

	// @graphql account @required
	User *models.User
}

// @graphql contact
func (v *Viewer) LoadContact() (*models.Contact, error) {
	// no need to implement
	return nil, nil
}

// @graphql 
func (v *Viewer) FamilyMembers() ([]*models.User, error) {
	return v.User.LoadFamilyMembers()
}
`,
		func(objects []*schemaparser.Object, functions []*schemaparser.Function) expectedObject {
			return expectedObject{
				name:        "Viewer",
				graphqlName: "Viewer",
				pkg:         "graphql",
				fields: []field{
					field{
						name: "viewerID",
						typ:  &enttype.StringType{},
					},
					field{
						name: "account",
						typ: enttype.NewPointerType(
							getFieldOfObject(t, objects, "Viewer", "account").GetGoType(),
							false,
							true,
						),
						graphqlType: "User!",
					},
				},
				functions: []expectedFunction{
					expectedFunction{
						nodeName:     "Viewer",
						graphqlName:  "contact",
						functionName: "LoadContact",
						pkg:          "graphql",
						results: []field{
							field{
								name: "contact",
								typ: enttype.NewPointerType(
									getFieldFromResult(t, functions, "contact", "contact").GetGoType(),
									false,
									false,
								),
								graphqlType: "Contact",
							},
							field{
								name: "",
								typ: enttype.NewNamedType(
									getFieldFromResult(t, functions, "contact", "").GetGoType(),
									false,
									false,
								),
							},
						},
					},
					expectedFunction{
						nodeName:     "Viewer",
						graphqlName:  "familyMembers",
						functionName: "FamilyMembers",
						pkg:          "graphql",
						results: []field{
							field{
								name: "users",
								typ: enttype.NewSliceType(
									getFieldFromResult(t, functions, "familyMembers", "users").GetGoType().(*types.Slice),
								),
							},
							field{
								name: "",
								typ: enttype.NewNamedType(
									getFieldFromResult(t, functions, "familyMembers", "").GetGoType(),
									false,
									false,
								),
							},
						},
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
