package enttype_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/tsimport"
)

func TestArrayListType(t *testing.T) {
	testTypeDirectly(t, map[string]*typeTestCase{
		"string list": {
			&enttype.ArrayListType{
				ElemType: &enttype.StringType{},
			},
			expType{
				// TODO also do sqlite...
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Text())",
				graphql:    "[String!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.StringType{},
				},
				goTypePanics: true,
				convertFn:    "convertList",
			},
			nil,
		},
		"nullable string list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.StringType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Text())",
				graphql:    "[String!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.StringType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableList",
			},
			nil,
		},
		"int list": {
			&enttype.ArrayListType{
				ElemType: &enttype.IntegerType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Integer())",
				graphql:    "[Int!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLInt"),
				},
				tsType: "number[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.IntegerType{},
				},
				goTypePanics: true,
				convertFn:    "convertList",
			},
			nil,
		},
		"nullable int list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.IntegerType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Integer())",
				graphql:    "[Int!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLInt"),
				},
				tsType: "number[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.IntegerType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableList",
			},
			nil,
		},
		"bool list": {
			&enttype.ArrayListType{
				ElemType: &enttype.BoolType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Boolean())",
				graphql:    "[Boolean!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLBoolean"),
				},
				tsType: "boolean[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.BoolType{},
				},
				goTypePanics: true,
				convertFn:    "convertBoolList",
			},
			nil,
		},
		"nullable bool list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.BoolType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Boolean())",
				graphql:    "[Boolean!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLBoolean"),
				},
				tsType: "boolean[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.BoolType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableBoolList",
			},
			nil,
		},
		"float list": {
			&enttype.ArrayListType{
				ElemType: &enttype.FloatType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Float())",
				graphql:    "[Float!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLFloat"),
				},
				tsType: "number[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.FloatType{},
				},
				goTypePanics: true,
				convertFn:    "convertList",
			},
			nil,
		},
		"nullable float list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.FloatType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Float())",
				graphql:    "[Float!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLFloat"),
				},
				tsType: "number[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.FloatType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableList",
			},
			nil,
		},
		"date list": {
			&enttype.ArrayListType{
				ElemType: &enttype.DateType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Date())",
				graphql:    "[Time!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.DateType{},
				},
				goTypePanics: true,
				convertFn:    "convertDateList",
			},
			nil,
		},
		"nullable date list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.DateType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Date())",
				graphql:    "[Time!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.DateType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableDateList",
			},
			nil,
		},
		"time list": {
			&enttype.ArrayListType{
				ElemType: &enttype.TimeType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Time())",
				graphql:    "[String!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimeType{},
				},
				goTypePanics: true,
				convertFn:    "convertList",
			},
			nil,
		},
		"nullable time list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.TimeType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Time())",
				graphql:    "[String!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimeType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableList",
			},
			nil,
		},
		"timetz list": {
			&enttype.ArrayListType{
				ElemType: &enttype.TimetzType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Time(timezone=True))",
				graphql:    "[String!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimetzType{},
				},
				goTypePanics: true,
				convertFn:    "convertList",
			},
			nil,
		},
		"nullable timetz list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.TimetzType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.Time(timezone=True))",
				graphql:    "[String!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimetzType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableList",
			},
			nil,
		},
		"timestamp list": {
			&enttype.ArrayListType{
				ElemType: &enttype.TimestampType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.TIMESTAMP())",
				graphql:    "[Time!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimestampType{},
				},
				goTypePanics: true,
				convertFn:    "convertDateList",
			},
			nil,
		},
		"nullable timestamp list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.TimestampType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.TIMESTAMP())",
				graphql:    "[Time!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimestampType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableDateList",
			},
			nil,
		},
		"timestamptz list": {
			&enttype.ArrayListType{
				ElemType: &enttype.TimestamptzType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.TIMESTAMP(timezone=True))",
				graphql:    "[Time!]!",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimestamptzType{},
				},
				goTypePanics: true,
				convertFn:    "convertDateList",
			},
			nil,
		},
		"nullable timestamptz list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.TimestamptzType{},
			},
			expType{
				tsListType: true,
				db:         "postgresql.ARRAY(sa.TIMESTAMP(timezone=True))",
				graphql:    "[Time!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimestamptzType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableDateList",
			},
			nil,
		},
		"enum list": {
			&enttype.ArrayListType{
				ElemType: &enttype.EnumType{
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
			expType{
				db:         "postgresql.ARRAY(sa.Text())",
				graphql:    "[AccountStatus!]!",
				enumType:   true,
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewLocalEntImportPath("AccountStatus"),
				},
				tsType:        "AccountStatus[]",
				tsTypeImports: []string{"AccountStatus"},
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.EnumType{
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
				goTypePanics: true,
				convertFn:    "convertList",
			},
			nil,
		},
		"nullable enum list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.EnumType{
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
			expType{
				tsListType: true,
				enumType:   true,
				db:         "postgresql.ARRAY(sa.Text())",
				graphql:    "[AccountStatus!]",
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewLocalEntImportPath("AccountStatus"),
				},
				tsType:        "AccountStatus[] | null",
				tsTypeImports: []string{"AccountStatus"},
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.EnumType{
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
				goTypePanics: true,
				convertFn:    "convertNullableList",
			},
			nil,
		},
		"jsonb list": {
			&enttype.ArrayListType{
				ElemType: &enttype.JSONBType{},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSONB)",
				graphql:    "[JSON!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONBType{},
				},
				goTypePanics: true,
				convertFn:    "convertJSONList",
			},
			nil,
		},
		"json list": {
			&enttype.ArrayListType{
				ElemType: &enttype.JSONType{},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSON)",
				graphql:    "[JSON!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONType{},
				},
				goTypePanics: true,
				convertFn:    "convertJSONList",
			},
			nil,
		},
		"nullable jsonb list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.JSONBType{},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSONB)",
				graphql:    "[JSON!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONBType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableJSONList",
			},
			nil,
		},
		"nullable json list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.JSONType{},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSON)",
				graphql:    "[JSON!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLImportPath("GraphQLList"),
					tsimport.NewGQLImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONType{},
				},
				goTypePanics: true,
				convertFn:    "convertNullableJSONList",
			},
			nil,
		},
	})
}

// TODO enum convertList?
