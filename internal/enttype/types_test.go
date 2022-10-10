package enttype_test

import (
	"fmt"
	"go/types"
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type expType struct {
	db                  string
	graphql             string
	graphqlImports      []*tsimport.ImportPath
	graphqlPanics       bool
	goTypePanics        bool
	castToMethod        string
	zeroValue           interface{}
	nullableType        enttype.Type
	nonNullableType     enttype.Type
	defaultGQLFieldName string
	elemGraphql         string
	errorType           bool
	enumType            bool
	tsListType          bool
	contextType         bool
	goType              string
	tsType              string
	tsTypePanics        bool
	convertSqliteFns    []string
	convertPostgresFns  []string
	importType          enttype.Import
	tsTypeImports       []*tsimport.ImportPath
	subFields           []*input.Field
	unionFields         []*input.Field
}

func TestStringType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() string {
	return ""
	}`)

	assert.IsType(t, &enttype.StringType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Text()",
		graphql: "String!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		zeroValue:    strconv.Quote(""),
		castToMethod: "cast.ToString",
		goType:       "string",
		nullableType: &enttype.NullableStringType{},
		tsType:       "string",
		importType:   &enttype.StringImport{},
	}, ret)
}

func TestCustomTypes(t *testing.T) {
	testTypeDirectly(
		t,
		map[string]*typeTestCase{
			"email": {
				&enttype.EmailType{},
				expType{
					db:      "sa.Text()",
					graphql: "String!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					zeroValue:    strconv.Quote(""),
					castToMethod: "cast.ToString",
					goType:       "string",
					nullableType: &enttype.NullableEmailType{},
					tsType:       "string",
					importType:   &enttype.EmailImport{},
				},
				nil,
			},
			"nullable email": {
				&enttype.NullableEmailType{},
				expType{
					db:      "sa.Text()",
					graphql: "String",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					zeroValue:       strconv.Quote(""),
					castToMethod:    "cast.ToNullableString",
					goType:          "string",
					nonNullableType: &enttype.EmailType{},
					tsType:          "string | null",
					importType:      &enttype.EmailImport{},
				},
				nil,
			},
			"password": {
				&enttype.PasswordType{},
				expType{
					db:      "sa.Text()",
					graphql: "String!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					zeroValue:    strconv.Quote(""),
					castToMethod: "cast.ToString",
					goType:       "string",
					nullableType: &enttype.NullablePasswordType{},
					tsType:       "string",
					importType:   &enttype.PasswordImport{},
				},
				nil,
			},
			"nullable password": {
				&enttype.NullablePasswordType{},
				expType{
					db:      "sa.Text()",
					graphql: "String",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					zeroValue:       strconv.Quote(""),
					castToMethod:    "cast.ToNullableString",
					goType:          "string",
					nonNullableType: &enttype.PasswordType{},
					tsType:          "string | null",
					importType:      &enttype.PasswordImport{},
				},
				nil,
			},
			"phone": {
				&enttype.PhoneType{},
				expType{
					db:      "sa.Text()",
					graphql: "String!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					zeroValue:    strconv.Quote(""),
					castToMethod: "cast.ToString",
					goType:       "string",
					nullableType: &enttype.NullablePhoneType{},
					tsType:       "string",
					importType:   &enttype.PhoneImport{},
				},
				nil,
			},
			"nullable phone": {
				&enttype.NullablePhoneType{},
				expType{
					db:      "sa.Text()",
					graphql: "String",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					zeroValue:       strconv.Quote(""),
					castToMethod:    "cast.ToNullableString",
					goType:          "string",
					nonNullableType: &enttype.PhoneType{},
					tsType:          "string | null",
					importType:      &enttype.PhoneImport{},
				},
				nil,
			},
		},
	)
}

func TestEnumishType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

		import "github.com/lolopinto/ent/ent"

func f() ent.NodeType {
	return ent.NodeType("user")
}`)

	assert.IsType(t, &enttype.StringType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Text()",
		graphql: "String!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		zeroValue: strconv.Quote(""),
		// this probably doesn't work correctly in practice because strong types broken?
		// would need castToMethod plus special enum cast
		castToMethod: "cast.ToString",
		goType:       "ent.NodeType",
		nullableType: &enttype.NullableStringType{},
		tsType:       "string",
		importType:   &enttype.StringImport{},
	}, ret)
}

func TestNullableStringType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *string {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableStringType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Text()",
		graphql: "String",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		zeroValue:       strconv.Quote(""),
		castToMethod:    "cast.ToNullableString",
		goType:          "*string",
		nonNullableType: &enttype.StringType{},
		tsType:          "string | null",
		importType:      &enttype.StringImport{},
	}, ret)
}

func TestBoolType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() bool {
	return true
	}`)

	assert.IsType(t, &enttype.BoolType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Boolean()",
		graphql: "Boolean!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLBoolean"),
		},
		zeroValue:        "false",
		castToMethod:     "cast.ToBool",
		goType:           "bool",
		nullableType:     &enttype.NullableBoolType{},
		tsType:           "boolean",
		convertSqliteFns: []string{"convertBool"},
		importType:       &enttype.BoolImport{},
	}, ret)
}

func TestNullableBoolType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *bool {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableBoolType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Boolean()",
		graphql: "Boolean",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLBoolean"),
		},
		zeroValue:        "false",
		castToMethod:     "cast.ToNullableBool",
		nonNullableType:  &enttype.BoolType{},
		goType:           "*bool",
		tsType:           "boolean | null",
		convertSqliteFns: []string{"convertNullableBool"},
		importType:       &enttype.BoolImport{},
	}, ret)
}

func TestIDType(t *testing.T) {
	testType(t, expType{
		db:      "postgresql.UUID()",
		graphql: "ID!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLID"),
		},
		zeroValue:    "",
		castToMethod: "cast.ToUUIDString",
		nullableType: &enttype.NullableIDType{},
		tsType:       "ID",
		tsTypeImports: []*tsimport.ImportPath{
			tsimport.NewEntImportPath("ID"),
		},
		importType: &enttype.UUIDImport{},
	}, returnType{
		entType: &enttype.IDType{},
	})
}

func TestNullableIDType(t *testing.T) {
	testType(t, expType{
		db:      "postgresql.UUID()",
		graphql: "ID",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLID"),
		},
		zeroValue:       "",
		castToMethod:    "cast.ToNullableUUIDString",
		nonNullableType: &enttype.IDType{},
		tsType:          "ID | null",
		tsTypeImports: []*tsimport.ImportPath{
			tsimport.NewEntImportPath("ID"),
		},
		importType: &enttype.UUIDImport{},
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
		db:      "sa.Integer()",
		graphql: "Int!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLInt"),
		},
		zeroValue:    "0",
		castToMethod: "cast.ToInt",
		goType:       "int",
		nullableType: &enttype.NullableIntegerType{},
		tsType:       "number",
		importType:   &enttype.IntImport{},
	}, ret)
}

func TestBigIntegerType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() int64 {
	return 1
	}`)

	assert.IsType(t, &enttype.BigIntegerType{}, ret.entType)
	testType(t, expType{
		db:      "sa.BigInteger()",
		graphql: "String!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		zeroValue:          "0",
		castToMethod:       "cast.ToInt64",
		goType:             "int64",
		nullableType:       &enttype.NullableBigIntegerType{},
		tsType:             "BigInt",
		importType:         &enttype.BigIntImport{},
		convertSqliteFns:   []string{"BigInt"},
		convertPostgresFns: []string{"BigInt"},
	}, ret)
}

func TestNullableIntegerType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *int {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableIntegerType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Integer()",
		graphql: "Int",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLInt"),
		},
		zeroValue:       "0",
		castToMethod:    "cast.ToNullableInt",
		nonNullableType: &enttype.IntegerType{},
		goType:          "*int",
		tsType:          "number | null",
		importType:      &enttype.IntImport{},
	}, ret)
}

func TestNullableBigIntegerType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *int64 {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableBigIntegerType{}, ret.entType)
	testType(t, expType{
		db:      "sa.BigInteger()",
		graphql: "String",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		zeroValue:          "0",
		castToMethod:       "cast.ToNullableInt64",
		nonNullableType:    &enttype.BigIntegerType{},
		goType:             "*int64",
		tsType:             "BigInt | null",
		importType:         &enttype.BigIntImport{},
		convertSqliteFns:   []string{"BigInt"},
		convertPostgresFns: []string{"BigInt"},
	}, ret)
}

func TestFloat64Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() float64 {
	return 1.0
	}`)
	testFloatType(t, ret, "float64")
}

func TestFloat32Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() float32 {
	return 1.0
	}`)
	testFloatType(t, ret, "float32")
}

func testFloatType(t *testing.T, ret returnType, goType string) {
	assert.IsType(t, &enttype.FloatType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Float()",
		graphql: "Float!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLFloat"),
		},
		zeroValue:    "0.0",
		castToMethod: "cast.ToFloat",
		goType:       goType,
		nullableType: &enttype.NullableFloatType{},
		tsType:       "number",
		importType:   &enttype.FloatImport{},
	}, ret)
}

func TestNullableFloat64Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *float64 {
	return nil
	}`)
	testNullableFloatType(t, ret, "*float64")
}

func TestNullableFloat32Type(t *testing.T) {
	ret := getTestReturnType(t, `package main 

func f() *float32 {
	return nil
	}`)
	testNullableFloatType(t, ret, "*float32")
}

func testNullableFloatType(t *testing.T, ret returnType, goType string) {
	assert.IsType(t, &enttype.NullableFloatType{}, ret.entType)
	testType(t, expType{
		db:      "sa.Float()",
		graphql: "Float",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLFloat"),
		},
		zeroValue:       "0.0",
		castToMethod:    "cast.ToNullableFloat",
		goType:          goType,
		nonNullableType: &enttype.FloatType{},
		tsType:          "number | null",
		importType:      &enttype.FloatImport{},
	}, ret)
}

func TestTimestampType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

	import "time"

func f() time.Time {
	return time.Time{}
	}`)

	assert.IsType(t, &enttype.TimestampType{}, ret.entType)
	testType(t, expType{
		db:      "sa.TIMESTAMP()",
		graphql: "Time!",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewEntGraphQLImportPath("GraphQLTime"),
		},
		zeroValue:           "time.Time{}",
		castToMethod:        "cast.ToTime",
		nullableType:        &enttype.NullableTimestampType{},
		defaultGQLFieldName: "time",
		goType:              "time.Time",
		tsType:              "Date",
		convertSqliteFns:    []string{"convertDate"},
		importType:          &enttype.TimestampImport{},
	}, ret)
}

func TestNullableTimestampType(t *testing.T) {
	ret := getTestReturnType(t, `package main 

	import "time"

func f() *time.Time {
	return nil
	}`)

	assert.IsType(t, &enttype.NullableTimestampType{}, ret.entType)
	testType(t, expType{
		db:      "sa.TIMESTAMP()",
		graphql: "Time",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewEntGraphQLImportPath("GraphQLTime"),
		},
		zeroValue:           "time.Time{}",
		castToMethod:        "cast.ToNullableTime",
		nonNullableType:     &enttype.TimestampType{},
		defaultGQLFieldName: "time",
		goType:              "*time.Time",
		tsType:              "Date | null",
		convertSqliteFns:    []string{"convertNullableDate"},
		importType:          &enttype.TimestampImport{},
	}, ret)
}

type testCase struct {
	code string
	exp  expType
	fn   func(ret *returnType, exp *expType)
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

	testTestCases(
		t, &enttype.PointerType{},
		map[string]testCase{
			"stringSlice": {
				`package main
	
				func f() *[]string {
					return &[]string{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[String!]",
					goType:       "*[]string",
					zeroValue:    "nil",
					tsType:       "string[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				defaultFn,
			},
			"stringPointerSlice": {
				`package main
	
				func f() *[]*string {
					return &[]*string{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[String]",
					goType:       "*[]*string",
					zeroValue:    "nil",
					tsType:       "string | null[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				defaultFn,
			},
		},
	)
}

func TestSliceType(t *testing.T) {
	testTestCases(
		t,
		&enttype.SliceType{},
		map[string]testCase{
			"string": {
				`package main

				func f() []string {
					return []string{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[String!]!",
					elemGraphql:  "String!",
					tsType:       "string[]",
					zeroValue:    "nil",
					goType:       "[]string",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"stringPointer": {
				`package main

				func f() []*string {
					return []*string{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[String]!",
					elemGraphql:  "String",
					tsType:       "string | null[]",
					zeroValue:    "nil",
					goType:       "[]*string",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"bool": {
				`package main

				func f() []bool {
					return []bool{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Boolean!]!",
					elemGraphql:  "Boolean!",
					tsType:       "boolean[]",
					zeroValue:    "nil",
					goType:       "[]bool",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"boolPointer": {
				`package main

				func f() []*bool {
					return []*bool{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Boolean]!",
					elemGraphql:  "Boolean",
					tsType:       "boolean | null[]",
					zeroValue:    "nil",
					goType:       "[]*bool",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"int": {
				`package main

				func f() []int {
					return []int{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Int!]!",
					elemGraphql:  "Int!",
					zeroValue:    "nil",
					tsType:       "number[]",
					goType:       "[]int",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"intPointer": {
				`package main

				func f() []*int {
					return []*int{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Int]!",
					elemGraphql:  "Int",
					zeroValue:    "nil",
					goType:       "[]*int",
					tsType:       "number | null[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"float64": {
				`package main

				func f() []float64 {
					return []float64{}
			}`,
				expType{
					db:           "sa.Text()",
					zeroValue:    "nil",
					graphql:      "[Float!]!",
					elemGraphql:  "Float!",
					tsType:       "number[]",
					goType:       "[]float64",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"float64Pointer": {
				`package main

				func f() []*float64 {
					return []*float64{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Float]!",
					elemGraphql:  "Float",
					zeroValue:    "nil",
					goType:       "[]*float64",
					tsType:       "number | null[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"float32": {
				`package main

				func f() []float32 {
					return []float32{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Float!]!",
					elemGraphql:  "Float!",
					zeroValue:    "nil",
					goType:       "[]float32",
					tsType:       "number[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"float32Pointer": {
				`package main

				func f() []*float32 {
					return []*float32{}
			}`,
				expType{
					db:           "sa.Text()",
					graphql:      "[Float]!",
					elemGraphql:  "Float",
					zeroValue:    "nil",
					goType:       "[]*float32",
					tsType:       "number | null[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"time": {
				`package main

				import "time"

				func f() []time.Time {
					return []time.Time{}
			}`,
				expType{
					db:                  "sa.Text()",
					graphql:             "[Time!]!",
					defaultGQLFieldName: "times",
					elemGraphql:         "Time!",
					zeroValue:           "nil",
					tsType:              "Date[]",
					goType:              "[]time.Time",
					castToMethod:        "cast.UnmarshallJSON",
				},
				nil,
			},
			"timePointer": {
				`package main

				import "time"

				func f() []*time.Time {
					return []*time.Time{}
			}`,
				expType{
					db:                  "sa.Text()",
					graphql:             "[Time]!",
					defaultGQLFieldName: "times",
					elemGraphql:         "Time",
					zeroValue:           "nil",
					goType:              "[]*time.Time",
					tsType:              "Date | null[]",
					castToMethod:        "cast.UnmarshallJSON",
				},
				nil,
			},
		},
	)
}

func TestArrayType(t *testing.T) {
	// I assume no need to test every single case ala slices
	// if we run into issues, revisit.
	testTestCases(
		t,
		&enttype.ArrayType{},
		map[string]testCase{
			"string": {
				`package main

	func f() [2]string {
		return [2]string{}
	}`,
				expType{
					graphql:      "[String!]!",
					elemGraphql:  "String!",
					db:           "sa.Text()",
					zeroValue:    "nil",
					goType:       "[2]string",
					tsType:       "string[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"stringPointer": {
				`package main
	
				func f() [2]*string {
					return [2]*string{}
				}`,
				expType{
					graphql:      "[String]!",
					elemGraphql:  "String",
					db:           "sa.Text()",
					zeroValue:    "nil",
					goType:       "[2]*string",
					tsType:       "string | null[]",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
		},
	)
}

func TestMapType(t *testing.T) {
	// I assume no need to test every single case ala slices
	// if we run into issues, revisit.
	testTestCases(
		t,
		&enttype.MapType{},
		map[string]testCase{
			"string": {
				`package main

	func f() map[string]string {
		return map[string]string{}
	}`,
				expType{
					graphql:      "Map",
					db:           "sa.Text()",
					zeroValue:    "nil",
					goType:       "map[string]string",
					tsType:       "Map",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
			"stringPointer": {
				`package main
	
				func f() map[string]*bool {
					return map[string]*bool{}
				}`,
				expType{
					graphql:      "Map",
					db:           "sa.Text()",
					zeroValue:    "nil",
					goType:       "map[string]*bool",
					tsType:       "Map",
					castToMethod: "cast.UnmarshallJSON",
				},
				nil,
			},
		},
	)
}

func TestStringEnumType(t *testing.T) {
	testTypeDirectly(t,
		map[string]*typeTestCase{
			"nullable": {
				&enttype.NullableStringEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					Values: []string{
						"NOT_VERIFIED",
						"VERIFIED",
						"DEACTIVATED",
						"DISABLED",
					},
				},
				expType{
					db:      "sa.Text()",
					graphql: "AccountStatus",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					enumType: true,
					tsType:   "AccountStatus | null",
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nonNullableType: &enttype.StringEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						Values: []string{
							"NOT_VERIFIED",
							"VERIFIED",
							"DEACTIVATED",
							"DISABLED",
						},
					},
				},
				nil,
			},
			"not nullable": {
				&enttype.StringEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					Values: []string{
						"NOT_VERIFIED",
						"VERIFIED",
						"DEACTIVATED",
						"DISABLED",
					},
				},
				expType{
					db:      "sa.Text()",
					graphql: "AccountStatus!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					tsType:   "AccountStatus",
					enumType: true,
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nullableType: &enttype.NullableStringEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						Values: []string{
							"NOT_VERIFIED",
							"VERIFIED",
							"DEACTIVATED",
							"DISABLED",
						},
					},
				},
				nil,
			},
			"not nullable db enum": {
				&enttype.StringEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					Values: []string{
						"NOT_VERIFIED",
						"VERIFIED",
						"DEACTIVATED",
						"DISABLED",
					},
					EnumDBType: true,
				},
				expType{
					db: fmt.Sprintf("postgresql.ENUM(%s, %s, %s, %s, name=%s)",
						strconv.Quote("NOT_VERIFIED"),
						strconv.Quote("VERIFIED"),
						strconv.Quote("DEACTIVATED"),
						strconv.Quote("DISABLED"),
						strconv.Quote("account_status"),
					),
					enumType: true,
					graphql:  "AccountStatus!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					tsType: "AccountStatus",
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nullableType: &enttype.NullableStringEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						Values: []string{
							"NOT_VERIFIED",
							"VERIFIED",
							"DEACTIVATED",
							"DISABLED",
						},
					},
				},
				nil,
			},
			"nullable db enum": {
				&enttype.NullableStringEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					Values: []string{
						"NOT_VERIFIED",
						"VERIFIED",
						"DEACTIVATED",
						"DISABLED",
					},
					EnumDBType: true,
				},
				expType{
					db: fmt.Sprintf("postgresql.ENUM(%s, %s, %s, %s, name=%s)",
						strconv.Quote("NOT_VERIFIED"),
						strconv.Quote("VERIFIED"),
						strconv.Quote("DEACTIVATED"),
						strconv.Quote("DISABLED"),
						strconv.Quote("account_status"),
					),
					enumType: true,
					graphql:  "AccountStatus",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					tsType: "AccountStatus | null",
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nonNullableType: &enttype.StringEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						Values: []string{
							"NOT_VERIFIED",
							"VERIFIED",
							"DEACTIVATED",
							"DISABLED",
						},
					},
				},
				nil,
			},
		},
	)
}

func TestIntEnumType(t *testing.T) {
	testTypeDirectly(t,
		map[string]*typeTestCase{
			"nullable": {
				&enttype.NullableIntegerEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					EnumMap: map[string]int{
						"UNVERIFIED":  0,
						"VERIFIED":    1,
						"DEACTIVATED": 2,
						"DISABLED":    3,
					},
				},
				expType{
					db:      "sa.Integer()",
					graphql: "AccountStatus",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					enumType: true,
					tsType:   "AccountStatus | null",
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nonNullableType: &enttype.IntegerEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						EnumMap: map[string]int{
							"UNVERIFIED":  0,
							"VERIFIED":    1,
							"DEACTIVATED": 2,
							"DISABLED":    3,
						},
					},
				},
				nil,
			},
			"not nullable": {
				&enttype.IntegerEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					EnumMap: map[string]int{
						"UNVERIFIED":  0,
						"VERIFIED":    1,
						"DEACTIVATED": 2,
						"DISABLED":    3,
					},
				},
				expType{
					db:      "sa.Integer()",
					graphql: "AccountStatus!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					tsType:   "AccountStatus",
					enumType: true,
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nullableType: &enttype.NullableIntegerEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						EnumMap: map[string]int{
							"UNVERIFIED":  0,
							"VERIFIED":    1,
							"DEACTIVATED": 2,
							"DISABLED":    3,
						},
					},
				},
				nil,
			},
			"nullable w deprecated": {
				&enttype.NullableIntegerEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					EnumMap: map[string]int{
						"VERIFIED":    1,
						"DEACTIVATED": 2,
						"DISABLED":    3,
					},
					DeprecatedEnumMap: map[string]int{
						"UNVERIFIED": 0,
					},
				},
				expType{
					db:      "sa.Integer()",
					graphql: "AccountStatus",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					enumType: true,
					tsType:   "AccountStatus | null",
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nonNullableType: &enttype.IntegerEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						EnumMap: map[string]int{
							"VERIFIED":    1,
							"DEACTIVATED": 2,
							"DISABLED":    3,
						},
						DeprecatedEnumMap: map[string]int{
							"UNVERIFIED": 0,
						},
					},
				},
				nil,
			},
			"not nullable w depreated": {
				&enttype.IntegerEnumType{
					Type:        "AccountStatus",
					GraphQLType: "AccountStatus",
					EnumMap: map[string]int{
						"VERIFIED":    1,
						"DEACTIVATED": 2,
						"DISABLED":    3,
					},
					DeprecatedEnumMap: map[string]int{
						"UNVERIFIED": 0,
					},
				},
				expType{
					db:      "sa.Integer()",
					graphql: "AccountStatus!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
					},
					tsType:   "AccountStatus",
					enumType: true,
					tsTypeImports: []*tsimport.ImportPath{
						tsimport.NewLocalEntImportPath("AccountStatus"),
					},
					goTypePanics: true,
					nullableType: &enttype.NullableIntegerEnumType{
						Type:        "AccountStatus",
						GraphQLType: "AccountStatus",
						EnumMap: map[string]int{
							"VERIFIED":    1,
							"DEACTIVATED": 2,
							"DISABLED":    3,
						},
						DeprecatedEnumMap: map[string]int{
							"UNVERIFIED": 0,
						},
					},
				},
				nil,
			},
		},
	)
}

func TestTimestamptzType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"nullable": {
			&enttype.NullableTimestamptzType{},
			expType{
				db:      "sa.TIMESTAMP(timezone=True)",
				graphql: "Time",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType:              "Date | null",
				nonNullableType:     &enttype.TimestamptzType{},
				castToMethod:        "cast.ToNullableTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				convertSqliteFns:    []string{"convertNullableDate"},
				importType:          &enttype.TimestamptzImport{},
			},
			nil,
		},
		"not nullable": {
			&enttype.TimestamptzType{},
			expType{
				db:      "sa.TIMESTAMP(timezone=True)",
				graphql: "Time!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType:              "Date",
				nullableType:        &enttype.NullableTimestamptzType{},
				castToMethod:        "cast.ToTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				convertSqliteFns:    []string{"convertDate"},
				importType:          &enttype.TimestamptzImport{},
			},
			nil,
		},
	})
}

func TestTimeType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"nullable": {
			&enttype.NullableTimeType{},
			expType{
				db:      "sa.Time()",
				graphql: "String",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType:              "string | null",
				nonNullableType:     &enttype.TimeType{},
				castToMethod:        "cast.ToNullableTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				importType:          &enttype.TimeImport{},
			},
			nil,
		},
		"not nullable": {
			&enttype.TimeType{},
			expType{
				db:      "sa.Time()",
				graphql: "String!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType:              "string",
				nullableType:        &enttype.NullableTimeType{},
				castToMethod:        "cast.ToTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				importType:          &enttype.TimeImport{},
			},
			nil,
		},
	})
}

func TestTimetzType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"nullable": {
			&enttype.NullableTimetzType{},
			expType{
				db:      "sa.Time(timezone=True)",
				graphql: "String",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType:              "string | null",
				nonNullableType:     &enttype.TimetzType{},
				castToMethod:        "cast.ToNullableTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				importType:          &enttype.TimetzImport{},
			},
			nil,
		},
		"not nullable": {
			&enttype.TimetzType{},
			expType{
				db:      "sa.Time(timezone=True)",
				graphql: "String!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType:              "string",
				nullableType:        &enttype.NullableTimetzType{},
				castToMethod:        "cast.ToTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				importType:          &enttype.TimetzImport{},
			},
			nil,
		},
	})
}

func TestDateType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"nullable": {
			&enttype.NullableDateType{},
			expType{
				db:      "sa.Date()",
				graphql: "Time",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType:              "Date | null",
				nonNullableType:     &enttype.DateType{},
				castToMethod:        "cast.ToNullableTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				convertSqliteFns:    []string{"convertNullableDate"},
				importType:          &enttype.DateImport{},
			},
			nil,
		},
		"not nullable": {
			&enttype.DateType{},
			expType{
				db:      "sa.Date()",
				graphql: "Time!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType:              "Date",
				nullableType:        &enttype.NullableDateType{},
				castToMethod:        "cast.ToTime",
				defaultGQLFieldName: "time",
				zeroValue:           "time.Time{}",
				convertSqliteFns:    []string{"convertDate"},
				importType:          &enttype.DateImport{},
			},
			nil,
		},
	})
}

func testTypeDirectly(t *testing.T, testCases map[string]*typeTestCase) {
	for name, tt := range testCases {
		t.Run(name, func(t *testing.T) {

			ret := returnType{
				entType: tt.typ,
			}
			if tt.fn != nil {
				tt.fn(&ret, &tt.exp)
			}
			testType(t, tt.exp, ret)
		})
	}
}

// when testing the type directly e.g. typescript...
type typeTestCase struct {
	typ enttype.Type
	exp expType
	fn  func(ret *returnType, exp *expType)
}

type returnType struct {
	entType enttype.Type
	goType  types.Type
}

func getTestReturnType(t *testing.T, code string) returnType {
	pkg, fn, err := schemaparser.FindFunction(code, "main", "f")
	assert.Nil(t, err)
	assert.NotNil(t, fn)
	assert.NotNil(t, pkg)

	assert.NotNil(t, fn.Type.Results)
	results := fn.Type.Results
	assert.Len(t, results.List, 1)

	goType := pkg.TypesInfo.TypeOf(results.List[0].Type)
	return returnType{
		goType:  goType,
		entType: enttype.GetType(goType),
	}
}

func testTestCases(t *testing.T, expType enttype.Type, testCases map[string]testCase) {
	for name, tt := range testCases {
		t.Run(name, func(t *testing.T) {
			ret := getTestReturnType(t, tt.code)
			assert.IsType(t, expType, ret.entType)

			if tt.fn != nil {
				tt.fn(&ret, &tt.exp)
			}
			testType(t, tt.exp, ret)
		})
	}
}

func testType(t *testing.T, exp expType, ret returnType) {
	typ := ret.entType
	if exp.graphqlPanics {
		assert.Panics(t, func() { typ.GetGraphQLType() })
	} else {
		assert.Equal(t, exp.graphql, typ.GetGraphQLType())
		gqlType, ok := typ.(enttype.TSGraphQLType)
		if ok {
			if exp.graphqlImports == nil {
				assert.Len(t, gqlType.GetTSGraphQLImports(false), 0)
			} else {
				assert.Equal(t, exp.graphqlImports, gqlType.GetTSGraphQLImports(false))
			}
		} else {
			// not a gqlType. this should be 0
			assert.Len(t, exp.graphqlImports, 0)
		}
	}

	entType, ok := typ.(enttype.EntType)
	if ok {
		assert.Equal(t, exp.db, entType.GetDBType())
		if exp.goTypePanics {
			assert.Panics(t, func() { entType.GetCastToMethod() })
			assert.Panics(t, func() { entType.GetZeroValue() })
		} else {
			assert.Equal(t, exp.castToMethod, entType.GetCastToMethod())
			assert.Equal(t, exp.zeroValue, entType.GetZeroValue())

		}
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

	if ret.goType != nil {
		assert.Equal(t, exp.goType, enttype.GetGoType(ret.goType))
	}

	tsType, ok := typ.(enttype.TSType)
	if ok && exp.tsTypePanics {
		assert.Panics(t, func() { tsType.GetTSType() })
	} else if ok {
		assert.Equal(t, exp.tsType, tsType.GetTSType())
	} else {
		assert.Equal(t, "", exp.tsType)
	}

	assert.Equal(t, exp.errorType, enttype.IsErrorType(typ))
	assert.Equal(t, exp.contextType, enttype.IsContextType(typ))
	_, enumType := enttype.GetEnumType(typ)
	assert.Equal(t, exp.enumType, enumType)
	assert.Equal(t, exp.tsListType, enttype.IsListType(typ))

	// hack. TODO remove in next PR
	json := enttype.IsJSONBType(typ) || enttype.IsJSONType(typ) || enttype.IsJSONListType(typ)

	convType, ok := typ.(enttype.ConvertDataType)
	if !json {
		if ok {
			m := convType.Convert()
			sqlite := m[config.SQLite]
			if sqlite != nil {
				require.Len(t, exp.convertSqliteFns, 1)
				require.Len(t, sqlite, 1)
				assert.Equal(t, exp.convertSqliteFns[0], sqlite[0].Import)
			}
			postgres := m[config.Postgres]
			if postgres != nil {
				require.Len(t, exp.convertPostgresFns, 1)
				require.Len(t, postgres, 1)
				assert.Equal(t, exp.convertPostgresFns[0], postgres[0].Import)
			}
		} else {
			assert.Len(t, exp.convertSqliteFns, 0)
			assert.Len(t, exp.convertPostgresFns, 0)
		}
	}

	impType, ok := typ.(enttype.TSCodegenableType)
	if ok {
		assert.Equal(t, exp.importType, impType.GetImportType())
	}

	withImports, ok := typ.(enttype.TSTypeWithImports)
	if ok {
		assert.Len(t, exp.tsTypeImports, len(withImports.GetTsTypeImports()))
		// account for nil
		if len(exp.tsTypeImports) != 0 {
			assert.Equal(t, exp.tsTypeImports, withImports.GetTsTypeImports())
		}
	}
	// TODO test the fields in any ways?

	withSubFields, ok := typ.(enttype.TSWithSubFields)
	if ok {
		subFields, ok := withSubFields.GetSubFields().([]*input.Field)
		if !ok {
			require.Nil(t, exp.subFields)
		} else {
			assert.Len(t, exp.subFields, len(subFields))
		}
	}

	withUnionFields, ok := typ.(enttype.TSWithUnionFields)
	if ok {
		unionFields, ok := withUnionFields.GetUnionFields().([]*input.Field)
		if !ok {
			require.Nil(t, exp.unionFields)
		} else {
			assert.Len(t, exp.unionFields, len(unionFields))
		}
	}
}
