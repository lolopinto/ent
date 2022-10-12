package enttype_test

import (
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type expType struct {
	db                 string
	graphql            string
	graphqlImports     []*tsimport.ImportPath
	nullableType       enttype.Type
	nonNullableType    enttype.Type
	enumType           bool
	tsListType         bool
	tsType             string
	convertSqliteFns   []string
	convertPostgresFns []string
	importType         enttype.Import
	tsTypeImports      []*tsimport.ImportPath
	subFields          []*input.Field
	unionFields        []*input.Field
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
					nullableType: &enttype.NullableEmailType{},
					tsType:       "string",
					importType:   &enttype.EmailImport{},
				},
			},
			"nullable email": {
				&enttype.NullableEmailType{},
				expType{
					db:      "sa.Text()",
					graphql: "String",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					nonNullableType: &enttype.EmailType{},
					tsType:          "string | null",
					importType:      &enttype.EmailImport{},
				},
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
					nullableType: &enttype.NullablePasswordType{},
					tsType:       "string",
					importType:   &enttype.PasswordImport{},
				},
			},
			"nullable password": {
				&enttype.NullablePasswordType{},
				expType{
					db:      "sa.Text()",
					graphql: "String",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					nonNullableType: &enttype.PasswordType{},
					tsType:          "string | null",
					importType:      &enttype.PasswordImport{},
				},
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
					nullableType: &enttype.NullablePhoneType{},
					tsType:       "string",
					importType:   &enttype.PhoneImport{},
				},
			},
			"nullable phone": {
				&enttype.NullablePhoneType{},
				expType{
					db:      "sa.Text()",
					graphql: "String",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLString"),
					},
					nonNullableType: &enttype.PhoneType{},
					tsType:          "string | null",
					importType:      &enttype.PhoneImport{},
				},
			},
		},
	)
}

func TestStringType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"string": {
			&enttype.StringType{},
			expType{
				db:      "sa.Text()",
				graphql: "String!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				nullableType: &enttype.NullableStringType{},
				tsType:       "string",
				importType:   &enttype.StringImport{},
			},
		},
		"nullable": {
			&enttype.NullableStringType{},
			expType{
				db:      "sa.Text()",
				graphql: "String",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				nonNullableType: &enttype.StringType{},
				tsType:          "string | null",
				importType:      &enttype.StringImport{},
			},
		},
	})
}

func TestBoolType(t *testing.T) {
	testTypeDirectly(
		t,
		map[string]*typeTestCase{
			"bool": {
				&enttype.BoolType{},
				expType{
					db:      "sa.Boolean()",
					graphql: "Boolean!",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLClassImportPath("GraphQLNonNull"),
						tsimport.NewGQLImportPath("GraphQLBoolean"),
					},
					nullableType:     &enttype.NullableBoolType{},
					tsType:           "boolean",
					convertSqliteFns: []string{"convertBool"},
					importType:       &enttype.BoolImport{},
				},
			},
			"nullable": {
				&enttype.NullableBoolType{},
				expType{
					db:      "sa.Boolean()",
					graphql: "Boolean",
					graphqlImports: []*tsimport.ImportPath{
						tsimport.NewGQLImportPath("GraphQLBoolean"),
					},
					nonNullableType:  &enttype.BoolType{},
					tsType:           "boolean | null",
					convertSqliteFns: []string{"convertNullableBool"},
					importType:       &enttype.BoolImport{},
				},
			},
		},
	)
}

func TestIDType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"id": {
			&enttype.IDType{},
			expType{
				db:      "postgresql.UUID()",
				graphql: "ID!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLID"),
				},
				nullableType: &enttype.NullableIDType{},
				tsType:       "ID",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewEntImportPath("ID"),
				},
				importType: &enttype.UUIDImport{},
			},
		},
		"nullable": {
			&enttype.NullableIDType{},
			expType{
				db:      "postgresql.UUID()",
				graphql: "ID",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLID"),
				},
				nonNullableType: &enttype.IDType{},
				tsType:          "ID | null",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewEntImportPath("ID"),
				},
				importType: &enttype.UUIDImport{},
			},
		},
	})
}

func TestIntegerType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"int": {
			&enttype.IntegerType{},
			expType{
				db:      "sa.Integer()",
				graphql: "Int!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLInt"),
				},
				nullableType: &enttype.NullableIntegerType{},
				tsType:       "number",
				importType:   &enttype.IntImport{},
			},
		},
		"nullable": {
			&enttype.NullableIntegerType{},
			expType{
				db:      "sa.Integer()",
				graphql: "Int",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLInt"),
				},
				nonNullableType: &enttype.IntegerType{},
				tsType:          "number | null",
				importType:      &enttype.IntImport{},
			},
		},
	})

}

func TestBigIntegerType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"bigint": {
			&enttype.BigIntegerType{},
			expType{
				db:      "sa.BigInteger()",
				graphql: "String!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				nullableType:       &enttype.NullableBigIntegerType{},
				tsType:             "BigInt",
				importType:         &enttype.BigIntImport{},
				convertSqliteFns:   []string{"BigInt"},
				convertPostgresFns: []string{"BigInt"},
			},
		},
		"nullable": {
			&enttype.NullableBigIntegerType{},
			expType{
				db:      "sa.BigInteger()",
				graphql: "String",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				nonNullableType:    &enttype.BigIntegerType{},
				tsType:             "BigInt | null",
				importType:         &enttype.BigIntImport{},
				convertSqliteFns:   []string{"BigInt"},
				convertPostgresFns: []string{"BigInt"},
			},
		},
	})
}

func TestFloatType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"float": {
			&enttype.FloatType{},
			expType{
				db:      "sa.Float()",
				graphql: "Float!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLFloat"),
				},
				nullableType: &enttype.NullableFloatType{},
				tsType:       "number",
				importType:   &enttype.FloatImport{},
			},
		},
		"nullable": {
			&enttype.NullableFloatType{},
			expType{
				db:      "sa.Float()",
				graphql: "Float",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLFloat"),
				},
				nonNullableType: &enttype.FloatType{},
				tsType:          "number | null",
				importType:      &enttype.FloatImport{},
			},
		},
	})
}

func TestTimestampType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"timestamp": {
			&enttype.TimestampType{},
			expType{
				db:      "sa.TIMESTAMP()",
				graphql: "Time!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				nullableType:     &enttype.NullableTimestampType{},
				tsType:           "Date",
				convertSqliteFns: []string{"convertDate"},
				importType:       &enttype.TimestampImport{},
			},
		},
		"nullable": {
			&enttype.NullableTimestampType{},
			expType{
				db:      "sa.TIMESTAMP()",
				graphql: "Time",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				nonNullableType:  &enttype.TimestampType{},
				tsType:           "Date | null",
				convertSqliteFns: []string{"convertNullableDate"},
				importType:       &enttype.TimestampImport{},
			},
		},
	})

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
				tsType:           "Date | null",
				nonNullableType:  &enttype.TimestamptzType{},
				convertSqliteFns: []string{"convertNullableDate"},
				importType:       &enttype.TimestamptzImport{},
			},
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
				tsType:           "Date",
				nullableType:     &enttype.NullableTimestamptzType{},
				convertSqliteFns: []string{"convertDate"},
				importType:       &enttype.TimestamptzImport{},
			},
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
				tsType:          "string | null",
				nonNullableType: &enttype.TimeType{},
				importType:      &enttype.TimeImport{},
			},
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
				tsType:       "string",
				nullableType: &enttype.NullableTimeType{},
				importType:   &enttype.TimeImport{},
			},
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
				tsType:          "string | null",
				nonNullableType: &enttype.TimetzType{},
				importType:      &enttype.TimetzImport{},
			},
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
				tsType:       "string",
				nullableType: &enttype.NullableTimetzType{},
				importType:   &enttype.TimetzImport{},
			},
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
				tsType:           "Date | null",
				nonNullableType:  &enttype.DateType{},
				convertSqliteFns: []string{"convertNullableDate"},
				importType:       &enttype.DateImport{},
			},
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
				tsType:           "Date",
				nullableType:     &enttype.NullableDateType{},
				convertSqliteFns: []string{"convertDate"},
				importType:       &enttype.DateImport{},
			},
		},
	})
}

func testTypeDirectly(t *testing.T, testCases map[string]*typeTestCase) {
	for name, tt := range testCases {
		t.Run(name, func(t *testing.T) {

			testType(t, tt.exp, tt.typ)
		})
	}
}

// when testing the type directly e.g. typescript...
type typeTestCase struct {
	typ enttype.Type
	exp expType
}

func testType(t *testing.T, exp expType, typ enttype.Type) {
	assert.Equal(t, exp.graphql, typ.GetGraphQLType())
	tsType, ok := typ.(enttype.TSType)
	if ok {
		assert.Equal(t, exp.tsType, tsType.GetTSType())
		if exp.graphqlImports == nil {
			assert.Len(t, tsType.GetTSGraphQLImports(false), 0)
		} else {
			assert.Equal(t, exp.graphqlImports, tsType.GetTSGraphQLImports(false))
		}
	} else {
		// not a tsType. this should be 0
		assert.Len(t, exp.graphqlImports, 0)
		assert.Equal(t, "", exp.tsType)
	}

	assert.Equal(t, exp.db, typ.GetDBType())

	nullableType, ok := typ.(enttype.NullableType)
	if ok {
		nullType := nullableType.GetNullableType()

		assert.Equal(t, exp.nullableType, nullType)
		assert.False(t, strings.HasSuffix(nullType.GetGraphQLType(), "!"))
	}

	nonNullableType, ok := typ.(enttype.NonNullableType)
	if ok {
		nonNullType := nonNullableType.GetNonNullableType()

		assert.Equal(t, exp.nonNullableType, nonNullType)
		assert.True(t, strings.HasSuffix(nonNullType.GetGraphQLType(), "!"))
	}

	_, enumType := enttype.GetEnumType(typ)
	assert.Equal(t, exp.enumType, enumType)
	assert.Equal(t, exp.tsListType, enttype.IsListType(typ))

	convType, ok := typ.(enttype.ConvertDataType)
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
