package enttype_test

import (
	"go/ast"
	"go/types"
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
)

type expType struct {
	db                  string
	graphql             string
	graphqlPanics       bool
	castToMethod        string
	zeroValue           interface{}
	nullableType        enttype.Type
	nonNullableType     enttype.Type
	defaultGQLFieldName string
	elemGraphql         string
	errorType           bool
	contextType         bool
	structType          string
}

func TestStringType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() string {
	return ""
	}`)

	assert.IsType(t, &enttype.StringType{}, ret.entType)
	testType(t, expType{
		db:           "sa.Text()",
		graphql:      "String!",
		zeroValue:    strconv.Quote(""),
		castToMethod: "cast.ToString",
		nullableType: &enttype.NullableStringType{},
	}, ret)
}

func TestEnumishType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

		import "github.com/lolopinto/ent/ent"

func f() ent.NodeType {
	return ent.NodeType("user")
}`)

	assert.IsType(t, &enttype.StringType{}, ret.entType)
	testType(t, expType{
		db:        "sa.Text()",
		graphql:   "String!",
		zeroValue: strconv.Quote(""),
		// this probably doesn't work correctly in practice because strong types broken?
		// would need castToMethod plus special enum cast
		castToMethod: "cast.ToString",
		nullableType: &enttype.NullableStringType{},
	}, ret)
}

func TestNullableStringType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *string {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableStringType{}, ret.entType)
	testType(t, expType{
		db:              "sa.Text()",
		graphql:         "String",
		zeroValue:       strconv.Quote(""),
		castToMethod:    "cast.ToNullableString",
		nonNullableType: &enttype.StringType{},
	}, ret)
}

func TestBoolType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() bool {
	return true
	}`)

	assert.IsType(t, &enttype.BoolType{}, ret.entType)
	testType(t, expType{
		db:           "sa.Boolean()",
		graphql:      "Boolean!",
		zeroValue:    "false",
		castToMethod: "cast.ToBool",
		nullableType: &enttype.NullableBoolType{},
	}, ret)
}

func TestNullableBoolType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *bool {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableBoolType{}, ret.entType)
	testType(t, expType{
		db:              "sa.Boolean()",
		graphql:         "Boolean",
		zeroValue:       "false",
		castToMethod:    "cast.ToNullableBool",
		nonNullableType: &enttype.BoolType{},
	}, ret)
}

func TestIDType(t *testing.T) {
	testType(t, expType{
		db:           "UUID()",
		graphql:      "ID!",
		zeroValue:    "",
		castToMethod: "cast.ToUUIDString",
		nullableType: &enttype.NullableIDType{},
	}, returnType{
		entType: &enttype.IDType{},
	})
}

func TestNullableIDType(t *testing.T) {
	testType(t, expType{
		db:              "UUID()",
		graphql:         "ID",
		zeroValue:       "",
		castToMethod:    "cast.ToNullableUUIDString",
		nonNullableType: &enttype.IDType{},
	}, returnType{
		entType: &enttype.NullableIDType{},
	})
}

func TestIntegerType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() int {
	return 1
	}`)

	assert.IsType(t, &enttype.IntegerType{}, ret.entType)
	testType(t, expType{
		db:           "sa.Integer()",
		graphql:      "Int!",
		zeroValue:    "0",
		castToMethod: "cast.ToInt",
		nullableType: &enttype.NullableIntegerType{},
	}, ret)
}

func TestNullableIntegerType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *int {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableIntegerType{}, ret.entType)
	testType(t, expType{
		db:              "sa.Integer()",
		graphql:         "Int",
		zeroValue:       "0",
		castToMethod:    "cast.ToNullableInt",
		nonNullableType: &enttype.IntegerType{},
	}, ret)
}

func TestFloat64Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() float64 {
	return 1.0
	}`)
	testFloatType(t, ret)
}

func TestFloat32Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() float32 {
	return 1.0
	}`)
	testFloatType(t, ret)
}

func testFloatType(t *testing.T, ret returnType) {
	assert.IsType(t, &enttype.FloatType{}, ret.entType)
	testType(t, expType{
		db:           "sa.Float()",
		graphql:      "Float!",
		zeroValue:    "0.0",
		castToMethod: "cast.ToFloat",
		nullableType: &enttype.NullableFloatType{},
	}, ret)
}

func TestNullableFloat64Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *float64 {
	return nil
	}`)
	testNullableFloatType(t, ret)
}

func TestNullableFloat32Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *float32 {
	return nil
	}`)
	testNullableFloatType(t, ret)
}

func testNullableFloatType(t *testing.T, ret returnType) {
	assert.IsType(t, &enttype.NullableFloatType{}, ret.entType)
	testType(t, expType{
		db:              "sa.Float()",
		graphql:         "Float",
		zeroValue:       "0.0",
		castToMethod:    "cast.ToNullableFloat",
		nonNullableType: &enttype.FloatType{},
	}, ret)
}

func TestTimeType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

	import "time"

func f() time.Time {
	return time.Time{}
	}`)

	assert.IsType(t, &enttype.TimeType{}, ret.entType)
	testType(t, expType{
		db:                  "sa.TIMESTAMP()",
		graphql:             "Time!",
		zeroValue:           "time.Time{}",
		castToMethod:        "cast.ToTime",
		nullableType:        &enttype.NullableTimeType{},
		defaultGQLFieldName: "time",
	}, ret)
}

func TestNullableTimeType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

	import "time"

func f() *time.Time {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableTimeType{}, ret.entType)
	testType(t, expType{
		db:                  "sa.TIMESTAMP()",
		graphql:             "Time",
		zeroValue:           "time.Time{}",
		castToMethod:        "cast.ToNullableTime",
		nonNullableType:     &enttype.TimeType{},
		defaultGQLFieldName: "time",
	}, ret)
}

type testCase struct {
	code string
	exp  expType
	fn   func(ret *returnType, exp *expType)
}

func TestNamedType(t *testing.T) {
	defaultFn := func(ret *returnType, exp *expType) {
		namedType := ret.entType.(*enttype.NamedType)
		exp.nullableType = enttype.NewNamedType(
			namedType.GetActualType(),
			true,
			false,
		)
		exp.nonNullableType = enttype.NewNamedType(
			namedType.GetActualType(),
			false,
			true,
		)
	}

	testCases := []testCase{
		testCase{
			`package main

		import "context"

		func f() context.Context {
			return context.TODO()
		}`,
			expType{
				graphql:             "Context!",
				defaultGQLFieldName: "context",
				contextType:         true,
				structType:          "context.Context",
			},
			defaultFn,
		},

		testCase{
			`package main

		func f() error {
			return nil
		}`,
			expType{
				graphqlPanics: true,
				errorType:     true,
				structType:    "error",
			},
			defaultFn,
		},

		testCase{
			`package main

			import "github.com/lolopinto/ent/internal/test_schema/models"

			func f() models.User {
				// we have no reason to do this but test that default behavior does the right thing
			return models.User{}
		}`,
			expType{
				graphql:             "User!",
				defaultGQLFieldName: "user",
				structType:          "models.User",
			},
			defaultFn,
		},
	}

	testTestCases(t, testCases, &enttype.NamedType{})
}

func TestPointerType(t *testing.T) {
	defaultFn := func(ret *returnType, exp *expType) {
		pointerType := ret.entType.(*enttype.PointerType)
		exp.nullableType = enttype.NewPointerType(
			pointerType.GetActualType(),
			true,
			false,
		)
		exp.nonNullableType = enttype.NewPointerType(
			pointerType.GetActualType(),
			false,
			true,
		)
	}

	testCases := []testCase{
		testCase{
			`package main

			import "github.com/lolopinto/ent/internal/test_schema/models"

			func f() *models.User {
			return nil
		}`,
			expType{
				graphql:             "User",
				defaultGQLFieldName: "user",
				structType:          "models.User",
			},
			defaultFn,
		},

		testCase{
			`package main

			func f() *[]string {
				return &[]string{}
		}`,
			expType{
				graphql:    "[String!]",
				structType: "*[]string",
			},
			defaultFn,
		},

		testCase{
			`package main

			func f() *[]*string {
				return &[]*string{}
		}`,
			expType{
				graphql:    "[String]",
				structType: "*[]*string",
			},
			defaultFn,
		},

		testCase{
			`package main

			import "github.com/lolopinto/ent/internal/test_schema/models"

			func f() *[]*models.User {
			return nil
		}`,
			expType{
				graphql:             "[User]",
				defaultGQLFieldName: "users",
				structType:          "models.User",
			},
			defaultFn,
		},
	}

	testTestCases(t, testCases, &enttype.PointerType{})
}

func TestSliceType(t *testing.T) {
	testCases := []testCase{
		testCase{
			`package main

			func f() []string {
				return []string{}
		}`,
			expType{
				graphql:     "[String!]!",
				elemGraphql: "String!",
			},
			nil,
		},

		testCase{
			`package main

			func f() []*string {
				return []*string{}
		}`,
			expType{
				graphql:     "[String]!",
				elemGraphql: "String",
			},
			nil,
		},

		testCase{
			`package main

			func f() []bool {
				return []bool{}
		}`,
			expType{
				graphql:     "[Boolean!]!",
				elemGraphql: "Boolean!",
			},
			nil,
		},

		testCase{
			`package main

			func f() []*bool {
				return []*bool{}
		}`,
			expType{
				graphql:     "[Boolean]!",
				elemGraphql: "Boolean",
			},
			nil,
		},

		testCase{
			`package main

			func f() []int {
				return []int{}
		}`,
			expType{
				graphql:     "[Int!]!",
				elemGraphql: "Int!",
			},
			nil,
		},

		testCase{
			`package main

			func f() []*int {
				return []*int{}
		}`,
			expType{
				graphql:     "[Int]!",
				elemGraphql: "Int"},
			nil,
		},

		testCase{
			`package main

			func f() []float64 {
				return []float64{}
		}`,
			expType{
				graphql:     "[Float!]!",
				elemGraphql: "Float!",
			},
			nil,
		},

		testCase{
			`package main

			func f() []*float64 {
				return []*float64{}
		}`,
			expType{
				graphql:     "[Float]!",
				elemGraphql: "Float",
			},
			nil,
		},

		testCase{
			`package main

			func f() []float32 {
				return []float32{}
		}`,
			expType{
				graphql:     "[Float!]!",
				elemGraphql: "Float!",
			},
			nil,
		},

		testCase{
			`package main

			func f() []*float32 {
				return []*float32{}
		}`,
			expType{
				graphql:     "[Float]!",
				elemGraphql: "Float",
			},
			nil,
		},

		testCase{
			`package main

			import "time"

			func f() []time.Time {
				return []time.Time{}
		}`,
			expType{
				graphql:             "[Time!]!",
				defaultGQLFieldName: "times",
				elemGraphql:         "Time!",
			},
			nil,
		},

		testCase{
			`package main

			import "time"

			func f() []*time.Time {
				return []*time.Time{}
		}`,
			expType{
				graphql:             "[Time]!",
				defaultGQLFieldName: "times",
				elemGraphql:         "Time",
			},
			nil,
		},

		testCase{
			`package main

			import "github.com/lolopinto/ent/internal/test_schema/models"

			func f() []models.User {
				return []models.User{}
		}`,
			expType{
				graphql:             "[User!]!",
				defaultGQLFieldName: "users",
				elemGraphql:         "User!",
			},
			nil,
		},

		testCase{
			`package main

			import "github.com/lolopinto/ent/internal/test_schema/models"

			func f() []*models.User {
				return []*models.User{}
		}`,
			expType{
				graphql:             "[User]!",
				defaultGQLFieldName: "users",
				elemGraphql:         "User",
			},
			nil,
		},
	}

	testTestCases(t, testCases, &enttype.SliceType{})
}

func TestArrayType(t *testing.T) {
	// I assume no need to test every single case ala slices
	// if we run into issues, revisit.
	testCases := []testCase{
		testCase{
			`package main

			func f() [2]string {
				return [2]string{}
			}`,
			expType{
				graphql:     "[String!]!",
				elemGraphql: "String!",
			},
			nil,
		},
	}
	testTestCases(t, testCases, &enttype.ArrayType{})
}

type returnType struct {
	entType enttype.Type
	goType  types.Type
}

func getTestReturnType(t *testing.T, code string) returnType {
	overlay := make(map[string]string)
	overlay["code.go"] = code

	parser := &schemaparser.SourceSchemaParser{
		Sources:     overlay,
		PackageName: "main",
	}
	pkg := schemaparser.LoadPackage(parser)
	assert.Len(t, pkg.Errors, 0)

	assert.Len(t, pkg.GoFiles, 1)

	var ret returnType
	ast.Inspect(pkg.Syntax[0], func(node ast.Node) bool {
		if fn, ok := node.(*ast.FuncDecl); ok {
			if fn.Name.Name != "f" {
				return false
			}

			assert.NotNil(t, fn.Type.Results)
			results := fn.Type.Results
			assert.Len(t, results.List, 1)

			goType := pkg.TypesInfo.TypeOf(results.List[0].Type)
			ret = returnType{
				goType:  goType,
				entType: enttype.GetType(goType),
			}
		}
		return true
	})
	assert.NotZero(t, ret)
	return ret
}

func testTestCases(t *testing.T, testCases []testCase, expType enttype.Type) {
	for _, tt := range testCases {
		ret := getTestReturnType(t, tt.code)
		assert.IsType(t, expType, ret.entType)

		if tt.fn != nil {
			tt.fn(&ret, &tt.exp)
		}
		testType(t, tt.exp, ret)
	}
}

func testType(t *testing.T, exp expType, ret returnType) {
	typ := ret.entType
	if exp.graphqlPanics {
		assert.Panics(t, func() { typ.GetGraphQLType() })
	} else {
		assert.Equal(t, exp.graphql, typ.GetGraphQLType())
	}

	entType, ok := typ.(enttype.EntType)
	if ok {
		assert.Equal(t, exp.db, entType.GetDBType())
		assert.Equal(t, exp.castToMethod, entType.GetCastToMethod())
		assert.Equal(t, exp.zeroValue, entType.GetZeroValue())
	}

	nullableType, ok := typ.(enttype.NullableType)
	if ok {
		nullType := nullableType.GetNullableType()

		assert.Equal(t, exp.nullableType, nullType)
		if exp.graphqlPanics {
			assert.Panics(t, func() { nullType.GetGraphQLType() })
		} else {
			assert.False(t, strings.HasSuffix(nullType.GetGraphQLType(), "!"))
		}

		if ret.goType != nil {
			// GetNullableType should return expected nullType
			assert.Equal(t, nullType, enttype.GetNullableType(ret.goType, true))
		}
	} else {
		if ret.goType != nil {
			// should return self if not nullable
			assert.Equal(t, typ, enttype.GetNullableType(ret.goType, false))
		}
	}

	nonNullableType, ok := typ.(enttype.NonNullableType)
	if ok {
		nonNullType := nonNullableType.GetNonNullableType()

		assert.Equal(t, exp.nonNullableType, nonNullType)
		if exp.graphqlPanics {
			assert.Panics(t, func() { nonNullType.GetGraphQLType() })
		} else {
			assert.True(t, strings.HasSuffix(nonNullType.GetGraphQLType(), "!"))
		}

		if ret.goType != nil {
			// GetNonNullableType should return expected nonNullType
			assert.Equal(t, nonNullType, enttype.GetNonNullableType(ret.goType, true))
		}
	} else {
		if ret.goType != nil {
			// should return self if not non-nullable
			assert.Equal(t, typ, enttype.GetNonNullableType(ret.goType, false))
		}
	}

	defaultFieldNameType, ok := typ.(enttype.DefaulFieldNameType)
	if ok {
		assert.Equal(t, exp.defaultGQLFieldName, defaultFieldNameType.DefaultGraphQLFieldName())
	}

	listType, ok := typ.(enttype.ListType)
	if ok {
		assert.Equal(t, exp.elemGraphql, listType.GetElemGraphQLType())
	}

	// hmm this isn't always as expected. revisit in future maybe?
	// works for ent types so it's fine
	structType, ok := typ.(enttype.FieldWithOverridenStructType)
	if ok {
		assert.Equal(t, exp.structType, structType.GetStructType())
	}

	assert.Equal(t, exp.errorType, enttype.IsErrorType(typ))
	assert.Equal(t, exp.contextType, enttype.IsContextType(typ))
}
