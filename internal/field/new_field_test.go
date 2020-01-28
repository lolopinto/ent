package field

import (
	"testing"

	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
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
					field.Int(),
					field.GraphQL("numInvitesLeft"),
				),
			}
		}`,
		&Field{
			FieldName:           "InvitesLeft",
			dbName:              "invites_left",
			graphQLName:         "numInvitesLeft",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
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
					field.String(),
					field.Unique(), 
					field.DB("email"),
				),
			}
		}`,
		&Field{
			FieldName:           "EmailAddress",
			dbName:              "email",
			graphQLName:         "emailAddress",
			unique:              true,
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
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
					field.Float(),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:           "Balance",
			dbName:              "balance",
			graphQLName:         "balance",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			nullable:            true,
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
					field.Bool(),
					field.Nullable(),
					field.ServerDefault("true"), // TODO should support true
					field.DB("show_bio"),
				),
			}
		}`,
		&Field{
			FieldName:           "ShowBioOnProfile",
			dbName:              "show_bio",
			graphQLName:         "showBioOnProfile",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			nullable:            true,
			defaultValue:        "true",
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
					field.Time(),
					field.Index(),
				),
			}
		}`,
		&Field{
			FieldName:           "StartTime",
			dbName:              "start_time",
			graphQLName:         "startTime",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			index:               true,
			pkgPath:             "time",
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
					field.String(),
					field.ServerDefault("Ola"),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:           "LastName",
			dbName:              "last_name",
			graphQLName:         "lastName",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			nullable:            true,
			defaultValue:        "Ola",
		},
	)

	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String")
}

func TestCustomURLType(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"
		import "github.com/lolopinto/ent/ent/field/url"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"ProfileURL": field.F(
					url.Field().RestrictToDomain("https://www.facebook.com"),
					field.HideFromGraphQL(),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:           "ProfileURL",
			dbName:              "profile_url",
			graphQLName:         "profileURL",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			nullable:            true,
			hideFromGraphQL:     true,
		},
	)

	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String")
}

func TestCustomEmailType(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"
		import "github.com/lolopinto/ent/ent/field/email"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"EmailAddress": field.F(
					email.Field(),
					field.Unique(), 
					field.DB("email"),
				),
			}
		}`,
		&Field{
			FieldName:           "EmailAddress",
			dbName:              "email",
			graphQLName:         "emailAddress",
			unique:              true,
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
		},
	)

	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String!")
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
					field.String(), // TODO need to support uuid here
					field.ForeignKey("UserConfig", "ID"),
				),
			}
		}`,
		&Field{
			FieldName:           "UserID",
			dbName:              "user_id",
			graphQLName:         "userID", // probably not exposed to gql
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			fkey: &ForeignKeyInfo{
				Config: "UserConfig",
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
					(&field.StringType{}).NotEmpty().ToLower(),
					field.Nullable(),
				),
			}
		}`,
		&Field{
			FieldName:           "Bio",
			dbName:              "bio",
			graphQLName:         "bio",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
			nullable:            true,
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
			FieldName:           "Bio",
			dbName:              "bio",
			graphQLName:         "bio",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
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
			FieldName:           "Bio",
			dbName:              "bio",
			graphQLName:         "bio",
			topLevelStructField: true,
			exposeToActions:     true,
			dbColumn:            true,
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
		import "github.com/lolopinto/ent/ent/field/email"
		import "github.com/lolopinto/ent/ent/field/url"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"InvitesLeft": field.F(
					field.Int(),
					field.GraphQL("numInvitesLeft"),
				),
				"EmailAddress": field.F(
					email.Field(),
					field.Unique(), 
					field.DB("email"),
				),
				"StartTime": field.F(
					field.Time(),
					field.Index(),
				),
				"LastName": field.F(
					field.String(),
					field.ServerDefault("Ola"),
					field.Nullable(),
				),
				"ProfileURL": field.F(
					url.Field(),
				),
			}
		}`,
	)
	// need to include the 3 that are currently automatically added
	assert.Len(t, fields, 8)
}

func loadFields(t *testing.T, code string) []*Field {
	pkg, fn, err := schemaparser.FindFunction(code, "configs", "GetFields")
	assert.Nil(t, err)
	assert.NotNil(t, fn)
	assert.NotNil(t, pkg)

	fieldInfo, err := ParseFieldsFunc(pkg, fn)
	assert.Nil(t, err)
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
