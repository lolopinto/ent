package field

import (
	"testing"

	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSimpleIntField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"InvitesLeft": field.F(
					field.IntType(),
					field.GraphQL("numInvitesLeft"),
				),
			}
		}`,
		&Field{
			FieldName:                "InvitesLeft",
			dbName:                   "invites_left",
			graphQLName:              "numInvitesLeft",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	testDBType(t, field, "sa.Integer()")
	testGraphQLType(t, field, "Int!")
}

func TestStringField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"EmailAddress": field.F(
					field.StringType(),
					field.Unique(), 
					field.DB("email"),
				),
			}
		}`,
		&Field{
			FieldName:                "EmailAddress",
			dbName:                   "email",
			graphQLName:              "emailAddress",
			unique:                   true,
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)

	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String!")
}

func TestFloatField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Balance": field.F(
					field.FloatType(),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:                "Balance",
			dbName:                   "balance",
			graphQLName:              "balance",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
		},
	)
	testDBType(t, field, "sa.Float()")
	testGraphQLType(t, field, "Float")
}

func TestBoolField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"ShowBioOnProfile": field.F(
					field.BoolType(),
					field.Nullable(),
					field.ServerDefault("true"), // TODO should support true
					field.DB("show_bio"),
				),
			}
		}`,
		&Field{
			FieldName:                "ShowBioOnProfile",
			dbName:                   "show_bio",
			graphQLName:              "showBioOnProfile",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
			defaultValue:             "true",
		},
	)
	testDBType(t, field, "sa.Boolean()")
	testGraphQLType(t, field, "Boolean")
}

func TestTimeField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type EventConfig struct {}
		
		func (config *EventConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"StartTime": field.F(
					field.TimeType(),
					field.Index(),
				),
			}
		}`,
		&Field{
			FieldName:                "StartTime",
			dbName:                   "start_time",
			graphQLName:              "startTime",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			index:                    true,
			pkgPath:                  "time",
		},
	)
	testDBType(t, field, "sa.TIMESTAMP()")
	testGraphQLType(t, field, "Time!")
}

func TestStringWithMoreCustomizationsField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"LastName": field.F(
					field.StringType(),
					field.ServerDefault("Ola"),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:                "LastName",
			dbName:                   "last_name",
			graphQLName:              "lastName",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
			defaultValue:             "Ola",
		},
	)

	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String")
}

func TestForeignKey(t *testing.T) {
	verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type EventConfig struct {}
		
		func (config *EventConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"UserID": field.F(
					field.StringType(), // TODO need to support uuid here
					field.ForeignKey("UserConfig", "ID"),
				),
			}
		}`,
		&Field{
			FieldName:                "UserID",
			dbName:                   "user_id",
			graphQLName:              "userID", // probably not exposed to gql
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			fkey: &ForeignKeyInfo{
				Schema: "User",
				Field:  "ID",
			},
		},
	)
}

func TestDataTypeWithCalls(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Bio": field.F(
					(&field.StringDataType{}).NotEmpty().ToLower(),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:                "Bio",
			dbName:                   "bio",
			graphQLName:              "bio",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
		},
	)
	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String")
}

func TestLocalInlineTypeWithCall(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type localStringType struct {}

		func (t localStringType) Type() interface{} {
			return ""
		}

		func (t localStringType) Foo() localStringType {
			return t
		}

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Bio": field.F(
					(localStringType{}).Foo(),
				),
			}
		}`,
		&Field{
			FieldName:                "Bio",
			dbName:                   "bio",
			graphQLName:              "bio",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String!")
}

func TestLocalInlineFuncCall(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type localStringType struct {}

		func (*localStringType) Type() interface{} {
			return ""
		}

		func str() *localStringType {
			return &localStringType{}
		}

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Bio": field.F(
					str(),
				),
			}
		}`,
		&Field{
			FieldName:                "Bio",
			dbName:                   "bio",
			graphQLName:              "bio",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String!")
}

func TestMultipleFields(t *testing.T) {
	// tests multiple fields with at least one repeated *and* one with a dependency
	// TODO need even more strenuous stress tests?
	fields := loadFields(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"InvitesLeft": field.F(
					field.IntType(),
					field.GraphQL("numInvitesLeft"),
				),
				"EmailAddress": field.F(
					field.StringType(),
					field.Unique(), 
					field.DB("email"),
				),
				"StartTime": field.F(
					field.TimeType(),
					field.Index(),
				),
				"LastName": field.F(
					field.StringType(),
					field.ServerDefault("Ola"),
					field.Nullable(),
				),
				"ProfileURL": field.F(
					field.StringType(),
				),
			}
		}`,
	)
	// need to include the 3 that are currently automatically added
	assert.Len(t, fields, 8)
}

func loadFields(t *testing.T, code string) []*Field {
	pkg, fn, err := schemaparser.FindFunction(code, "configs", "GetFields")
	require.Nil(t, err)
	require.NotNil(t, fn)
	require.NotNil(t, pkg)

	fieldInfo, err := ParseFieldsFunc(pkg, fn)
	require.Nil(t, err)
	return fieldInfo.Fields
}

func verifyField(t *testing.T, code string, expectedField *Field) *Field {
	fields := loadFields(t, code)

	// we get id, created_at, updated_at as part of the framework
	assert.Len(t, fields, 4)

	field := getNonDefaultField(t, fields)
	testField(t, field, expectedField)

	return field
}

func isDefaultField(field *Field) bool {
	switch field.FieldName {
	case "ID", "CreatedAt", "UpdatedAt":
		return true
	}
	return false
}

func getNonDefaultField(t *testing.T, fields []*Field) *Field {
	for _, f := range fields {
		if !isDefaultField(f) {
			return f
		}
	}

	assert.FailNow(t, "couldn't find a non-default field")
	return nil
}
