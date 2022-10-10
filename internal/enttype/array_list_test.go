package enttype_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.StringType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.StringType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLInt"),
				},
				tsType: "number[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.IntegerType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLInt"),
				},
				tsType: "number[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.IntegerType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLBoolean"),
				},
				tsType: "boolean[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.BoolType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertBoolList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLBoolean"),
				},
				tsType: "boolean[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.BoolType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableBoolList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLFloat"),
				},
				tsType: "number[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.FloatType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLFloat"),
				},
				tsType: "number[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.FloatType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.DateType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertDateList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.DateType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableDateList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimeType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimeType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimetzType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLImportPath("GraphQLString"),
				},
				tsType: "string[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimetzType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimestampType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertDateList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimestampType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableDateList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.TimestamptzType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertDateList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewEntGraphQLImportPath("GraphQLTime"),
				},
				tsType: "Date[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.TimestamptzType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableDateList"},
			},
			nil,
		},
		"enum list": {
			&enttype.ArrayListType{
				ElemType: &enttype.StringEnumType{
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
				},
				tsType: "AccountStatus[]",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("AccountStatus"),
				},
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.StringEnumType{
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
				goTypePanics:     true,
				convertSqliteFns: []string{"convertList"},
			},
			nil,
		},
		"nullable enum list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.StringEnumType{
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("AccountStatus"),
				},
				tsType: "AccountStatus[] | null",
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("AccountStatus"),
				},
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.StringEnumType{
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
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONBType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
			},
			nil,
		},
		"jsonb as list": {
			&enttype.ArrayListType{
				ElemType:           &enttype.JSONBType{},
				ElemDBTypeNotArray: true,
			},
			expType{
				db:         "postgresql.JSONB",
				graphql:    "[JSON!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType:           &enttype.JSONBType{},
					ElemDBTypeNotArray: true,
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
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
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
			},
			nil,
		},
		"json as list": {
			&enttype.ArrayListType{
				ElemType:           &enttype.JSONType{},
				ElemDBTypeNotArray: true,
			},
			expType{
				db:         "postgresql.JSON",
				graphql:    "[JSON!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType:           &enttype.JSONType{},
					ElemDBTypeNotArray: true,
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONBType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
			},
			nil,
		},
		"nullable jsonb as list": {
			&enttype.NullableArrayListType{
				ElemType:           &enttype.JSONBType{},
				ElemDBTypeNotArray: true,
			},
			expType{
				db:         "postgresql.JSONB",
				graphql:    "[JSON!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType:           &enttype.JSONBType{},
					ElemDBTypeNotArray: true,
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
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
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGraphQLJSONImportPath("GraphQLJSON"),
				},
				tsType: "any[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONType{},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
			},
			nil,
		},
		"jsonb with sub fields as list": {
			&enttype.ArrayListType{
				ElemType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
				ElemDBTypeNotArray: true,
			},
			expType{
				db:         "postgresql.JSONB",
				graphql:    "[TypeWithSubFields!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONBType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithSubFields",
							CustomGraphQLInterface: "TypeWithSubFields",
							SubFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType: input.String,
									},
									Name: "string",
								},
							},
						},
					},
					ElemDBTypeNotArray: true,
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
				},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
		},
		"nullable jsonb with sub fields as list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
				ElemDBTypeNotArray: true,
			},
			expType{
				db:         "postgresql.JSONB",
				graphql:    "[TypeWithSubFields!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONBType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithSubFields",
							CustomGraphQLInterface: "TypeWithSubFields",
							SubFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType: input.String,
									},
									Name: "string",
								},
							},
						},
					},
					ElemDBTypeNotArray: true,
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
				},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
		},
		"json with sub fields list": {
			&enttype.ArrayListType{
				ElemType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSON)",
				graphql:    "[TypeWithSubFields!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithSubFields",
							CustomGraphQLInterface: "TypeWithSubFields",
							SubFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType: input.String,
									},
									Name: "string",
								},
							},
						},
					},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
				},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
		},
		"nullable json with sub fields list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithSubFields",
						CustomGraphQLInterface: "TypeWithSubFields",
						SubFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType: input.String,
								},
								Name: "string",
							},
						},
					},
				},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSON)",
				graphql:    "[TypeWithSubFields!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithSubFields"),
				},
				tsType: "TypeWithSubFields[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithSubFields",
							CustomGraphQLInterface: "TypeWithSubFields",
							SubFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType: input.String,
									},
									Name: "string",
								},
							},
						},
					},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithSubFields"),
				},
				subFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType: input.String,
						},
						Name: "string",
					},
				},
			},
			nil,
		},

		"jsonb with union fields list": {
			&enttype.ArrayListType{
				ElemType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSONB,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSONB,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSONB)",
				graphql:    "[TypeWithUnionFields!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONBType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithUnionFields",
							CustomGraphQLInterface: "TypeWithUnionFields",
							UnionFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType:      input.JSONB,
										Type:        "UnionField",
										GraphQLType: "UnionField",
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "foo",
								},
								{
									Type: &input.FieldType{
										DBType: input.JSONB,
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "bar",
								},
							},
						},
					},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
				},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UnionField",
							GraphQLType: "UnionField",
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSONB,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
			nil,
		},
		"nullable jsonb with union fields list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.JSONBType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSONB,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSONB,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSONB)",
				graphql:    "[TypeWithUnionFields!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONBType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithUnionFields",
							CustomGraphQLInterface: "TypeWithUnionFields",
							UnionFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType:      input.JSONB,
										Type:        "UnionField",
										GraphQLType: "UnionField",
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "foo",
								},
								{
									Type: &input.FieldType{
										DBType: input.JSONB,
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "bar",
								},
							},
						},
					},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
				},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UnionField",
							GraphQLType: "UnionField",
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSONB,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
			nil,
		},
		"json with union fields list": {
			&enttype.ArrayListType{
				ElemType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSON,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSON,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSON)",
				graphql:    "[TypeWithUnionFields!]!",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields[]",
				nullableType: &enttype.NullableArrayListType{
					ElemType: &enttype.JSONType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithUnionFields",
							CustomGraphQLInterface: "TypeWithUnionFields",
							UnionFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType:      input.JSON,
										Type:        "UnionField",
										GraphQLType: "UnionField",
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "foo",
								},
								{
									Type: &input.FieldType{
										DBType: input.JSON,
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "bar",
								},
							},
						},
					},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
				},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType:      input.JSON,
							Type:        "UnionField",
							GraphQLType: "UnionField",
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSON,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
			nil,
		},
		"nullable json with union fields list": {
			&enttype.NullableArrayListType{
				ElemType: &enttype.JSONType{
					CommonJSONType: enttype.CommonJSONType{
						CustomTsInterface:      "TypeWithUnionFields",
						CustomGraphQLInterface: "TypeWithUnionFields",
						UnionFields: []*input.Field{
							{
								Type: &input.FieldType{
									DBType:      input.JSON,
									Type:        "UnionField",
									GraphQLType: "UnionField",
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "foo",
							},
							{
								Type: &input.FieldType{
									DBType: input.JSON,
									SubFields: []*input.Field{
										{
											Name: "string",
											Type: &input.FieldType{
												DBType: input.String,
											},
										},
										{
											Name: "int",
											Type: &input.FieldType{
												DBType: input.Int,
											},
										},
									},
								},
								Name: "bar",
							},
						},
					},
				},
			},
			expType{
				db:         "postgresql.ARRAY(postgresql.JSON)",
				graphql:    "[TypeWithUnionFields!]",
				tsListType: true,
				graphqlImports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLList"),
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					tsimport.NewLocalGraphQLEntImportPath("TypeWithUnionFields"),
				},
				tsType: "TypeWithUnionFields[] | null",
				nonNullableType: &enttype.ArrayListType{
					ElemType: &enttype.JSONType{
						CommonJSONType: enttype.CommonJSONType{
							CustomTsInterface:      "TypeWithUnionFields",
							CustomGraphQLInterface: "TypeWithUnionFields",
							UnionFields: []*input.Field{
								{
									Type: &input.FieldType{
										DBType:      input.JSON,
										Type:        "UnionField",
										GraphQLType: "UnionField",
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "foo",
								},
								{
									Type: &input.FieldType{
										DBType: input.JSON,
										SubFields: []*input.Field{
											{
												Name: "string",
												Type: &input.FieldType{
													DBType: input.String,
												},
											},
											{
												Name: "int",
												Type: &input.FieldType{
													DBType: input.Int,
												},
											},
										},
									},
									Name: "bar",
								},
							},
						},
					},
				},
				goTypePanics:     true,
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath("TypeWithUnionFields"),
				},
				unionFields: []*input.Field{
					{
						Type: &input.FieldType{
							DBType:      input.JSON,
							Type:        "UnionField",
							GraphQLType: "UnionField",
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "foo",
					},
					{
						Type: &input.FieldType{
							DBType: input.JSON,
							SubFields: []*input.Field{
								{
									Name: "string",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
								{
									Name: "int",
									Type: &input.FieldType{
										DBType: input.Int,
									},
								},
							},
						},
						Name: "bar",
					},
				},
			},
			nil,
		},
	})
}

// TODO enum convertList?
