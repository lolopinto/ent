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
				convertSqliteFns: []string{"convertList"},
			},
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
				convertSqliteFns: []string{"convertNullableList"},
			},
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
				convertSqliteFns: []string{"convertList"},
			},
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
				convertSqliteFns: []string{"convertNullableList"},
			},
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
				convertSqliteFns: []string{"convertBoolList"},
			},
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
				convertSqliteFns: []string{"convertNullableBoolList"},
			},
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
				convertSqliteFns: []string{"convertList"},
			},
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
				convertSqliteFns: []string{"convertNullableList"},
			},
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
				convertSqliteFns: []string{"convertDateList"},
			},
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
				convertSqliteFns: []string{"convertNullableDateList"},
			},
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
				convertSqliteFns: []string{"convertList"},
			},
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
				convertSqliteFns: []string{"convertNullableList"},
			},
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
				convertSqliteFns: []string{"convertList"},
			},
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
				convertSqliteFns: []string{"convertNullableList"},
			},
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
				convertSqliteFns: []string{"convertDateList"},
			},
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
				convertSqliteFns: []string{"convertNullableDateList"},
			},
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
				convertSqliteFns: []string{"convertDateList"},
			},
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
				convertSqliteFns: []string{"convertNullableDateList"},
			},
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
					tsimport.NewTypesEntImportPath("AccountStatus"),
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
				convertSqliteFns:   []string{"convertAccountStatusList"},
				convertPostgresFns: []string{"convertAccountStatusList"},
			},
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
					tsimport.NewTypesEntImportPath("AccountStatus"),
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
				convertSqliteFns:   []string{"convertNullableAccountStatusList"},
				convertPostgresFns: []string{"convertNullableAccountStatusList"},
			},
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
				convertSqliteFns: []string{"convertJSONList"},
			},
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
				convertSqliteFns: []string{"convertJSONList"},
			},
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
				convertSqliteFns: []string{"convertJSONList"},
			},
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
				convertSqliteFns: []string{"convertJSONList"},
			},
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
				convertSqliteFns: []string{"convertNullableJSONList"},
			},
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
				convertSqliteFns: []string{"convertNullableJSONList"},
			},
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
				convertSqliteFns: []string{"convertNullableJSONList"},
			},
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
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
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
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
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
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
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
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithSubFields"),
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
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
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
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
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
				convertSqliteFns: []string{"convertJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
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
				convertSqliteFns: []string{"convertNullableJSONList"},
				tsTypeImports: []*tsimport.ImportPath{
					tsimport.NewTypesEntImportPath("TypeWithUnionFields"),
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
		},
	})
}

// TODO enum convertList?
