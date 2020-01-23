package field

import (
	"go/ast"
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

func TestCustomType(t *testing.T) {
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

func TestDataTypeDirectly(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Bio": field.F(
					&field.StringType{},
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

func TestDirectDataTypeWithCalls(t *testing.T) {
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

func TestLocalInlineType(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type localStringType struct {}

		func (t localStringType) Type() interface{} {
			return ""
		}

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Bio": field.F(
					localStringType{},
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

func TestLocalInlineType2(t *testing.T) {
	// TODO move all these complications into a generic astparser library
	// we don't support things like (&localStringType{}).Foo().Bar("sdsdsd", 2) yet
	// and this file (+package) now spends too much time on parsing edge cases instead of dealing with just getting the information we care about

	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type localStringType struct {}

		func (*localStringType) Type() interface{} {
			return ""
		}

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Bio": field.F(
					&localStringType{},
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
		import "github.com/lolopinto/ent/ent/field/url"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"InvitesLeft": field.F(
					field.Int(),
					field.GraphQL("numInvitesLeft"),
				),
				"EmailAddress": field.F(
					field.String(),
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
	assert.Len(t, fields, 5)
}

func loadFields(t *testing.T, code string) []*Field {
	m2 := make(map[string]string)
	m2["code.go"] = code

	pkg := schemaparser.LoadPackage(
		&schemaparser.SourceSchemaParser{
			Sources: m2,
		},
	)

	file := pkg.Syntax[0]
	var fieldsFn *ast.FuncDecl
	ast.Inspect(file, func(node ast.Node) bool {
		if fn, ok := node.(*ast.FuncDecl); ok &&
			fn.Name.Name == "GetFields" {

			fieldsFn = fn
			return false
		}
		return true
	})
	assert.NotNil(t, fieldsFn)

	fieldInfo, err := ParseFieldsFunc(pkg, fieldsFn)
	assert.Nil(t, err)
	return fieldInfo.Fields
}

func verifyField(t *testing.T, code string, expectedField *Field) *Field {
	fields := loadFields(t, code)

	assert.Len(t, fields, 1)

	testField(t, fields[0], expectedField)

	return fields[0]
}
