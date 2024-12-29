package field

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIDField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.UUID,
			},
			Name: "id",
		},
		&Field{
			FieldName:                "id",
			dbName:                   "id",
			graphQLName:              "id",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
		"postgresql.UUID()",
		"ID!",
	)
}

func TestIntField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.Int,
			},
			Name:        "InvitesLeft",
			GraphQLName: "numInvitesLeft",
		},
		&Field{
			FieldName:                "InvitesLeft",
			dbName:                   "invites_left",
			graphQLName:              "numInvitesLeft",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
		"sa.Integer()",
		"Int!",
	)
}

func TestStringField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.String,
			},
			Name:       "EmailAddress",
			StorageKey: "email",
			Unique:     true,
		},
		&Field{
			FieldName:                "EmailAddress",
			dbName:                   "email",
			graphQLName:              "emailAddress",
			unique:                   true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
		"sa.Text()",
		"String!",
	)
}

func TestNullableStringField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.String,
			},
			Name:     "Bio",
			Nullable: true,
		},
		&Field{
			FieldName:                "Bio",
			dbName:                   "bio",
			graphQLName:              "bio",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
		},
		"sa.Text()",
		"String",
	)
}

func TestFloatField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.Float,
			},
			Name:     "Balance",
			Nullable: true,
		},
		&Field{
			FieldName:                "Balance",
			dbName:                   "balance",
			graphQLName:              "balance",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
		},
		"sa.Float()",
		"Float",
	)
}

func TestBoolField(t *testing.T) {
	dv := "true"
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.Boolean,
			},
			Name:          "ShowBioOnProfile",
			StorageKey:    "show_bio",
			Nullable:      true,
			ServerDefault: &dv,
		},
		&Field{
			FieldName:                "ShowBioOnProfile",
			dbName:                   "show_bio",
			graphQLName:              "showBioOnProfile",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
			defaultValue:             &dv,
		},
		"sa.Boolean()",
		"Boolean")
}

func TestTimeField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Name:  "StartTime",
			Index: true,
			Type: &input.FieldType{
				DBType: input.Timestamp,
			},
		},
		&Field{
			FieldName:                "StartTime",
			dbName:                   "start_time",
			graphQLName:              "startTime",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			index:                    true,
		},
		"sa.TIMESTAMP()",
		"Time!")
}

func TestStringWithMoreCustomizationsField(t *testing.T) {
	dv := "Ola"
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.String,
			},
			Name:          "LastName",
			ServerDefault: &dv,
			Nullable:      true,
		},
		&Field{
			FieldName:                "LastName",
			dbName:                   "last_name",
			graphQLName:              "lastName",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			nullable:                 true,
			defaultValue:             &dv,
		},
		"sa.Text()",
		"String",
	)
}

func TestHiddenGraphQLField(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.String,
			},
			Name:            "LastName",
			HideFromGraphQL: true,
		},
		&Field{
			FieldName:                "LastName",
			dbName:                   "last_name",
			graphQLName:              "lastName",
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			hideFromGraphQL:          true,
		},
		"sa.Text()",
		"String!",
	)
}

func TestForeignKey(t *testing.T) {
	testFieldFromInput(t,
		&input.Field{
			Type: &input.FieldType{
				DBType: input.UUID,
			},
			Name: "UserID",
			ForeignKey: &input.ForeignKey{
				Schema: "User",
				Column: "id",
			},
		},
		&Field{
			FieldName:                "UserID",
			dbName:                   "user_id",
			graphQLName:              "userId", // probably not exposed to gql
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			fkey: &ForeignKeyInfo{
				Schema: "User",
				Field:  "id",
			},
		},
		"postgresql.UUID()",
		"ID!",
	)
}

func TestDBOnlyNullableField(t *testing.T) {
	_, err := newFieldFromInputTest(&codegenapi.DummyConfig{}, &input.Field{
		Name: "foo",
		Type: &input.FieldType{
			DBType: input.Int,
		},
		DBOnly:   true,
		Nullable: true,
	})
	require.Nil(t, err)
}

func TestDBOnlyServerDefaultField(t *testing.T) {
	dv := "2"

	_, err := newFieldFromInputTest(&codegenapi.DummyConfig{}, &input.Field{
		Name: "foo",
		Type: &input.FieldType{
			DBType: input.Int,
		},
		DBOnly:        true,
		Nullable:      true,
		ServerDefault: &dv,
	})
	require.Nil(t, err)
}

func TestDBOnlyNoNullableNoServerDefault(t *testing.T) {
	_, err := newFieldFromInputTest(&codegenapi.DummyConfig{}, &input.Field{
		Name: "foo",
		Type: &input.FieldType{
			DBType: input.Int,
		},
		DBOnly: true,
	})
	require.NotNil(t, err)
}

func getFieldFromInput(t *testing.T, f *input.Field) *Field {
	cfg := &codegenapi.DummyConfig{}

	f2, err := newFieldFromInputTest(cfg, f)
	require.Nil(t, err)
	return f2
}

func testFieldFromInput(t *testing.T, f *input.Field, expectedField *Field, db, graphql string) {
	f2 := getFieldFromInput(t, f)
	testField(t, f2, expectedField)
	testDBType(t, f2, db)
	testGraphQLType(t, f2, graphql)
}

func testField(t *testing.T, f, expFieldProps *Field) {
	assert.Equal(
		t,
		expFieldProps.FieldName,
		f.FieldName,
		"field name was not as expected, expected %s, got %s",
		expFieldProps.FieldName,
		f.FieldName,
	)

	assert.Equal(
		t,
		expFieldProps.singleFieldPrimaryKey,
		f.SingleFieldPrimaryKey(),
		"expected primary key to be %v, got %v instead",
		expFieldProps.singleFieldPrimaryKey,
		f.SingleFieldPrimaryKey(),
	)

	expose := f.ExposeToGraphQL()
	assert.Equal(
		t,
		!expFieldProps.hideFromGraphQL,
		expose,
		"expected field exposed to graphql status to return !(%v), got %v instead",
		!expFieldProps.hideFromGraphQL,
		expose,
	)

	fieldName := f.GetGraphQLName()
	assert.Equal(
		t,
		expFieldProps.graphQLName,
		fieldName,
		"expected graphql field name to be %s, got %s instead",
		expFieldProps.graphQLName,
		fieldName,
	)

	assert.Equal(
		t,
		expFieldProps.dbName,
		f.dbName,
		"expected db field to be %s, got %s instead",
		expFieldProps.dbName,
		f.dbName,
	)

	dbColumn := f.CreateDBColumn()
	assert.Equal(
		t,
		expFieldProps.dbColumn,
		dbColumn,
		"expected create db column for field to be %v, got %v instead",
		expFieldProps.dbColumn,
		dbColumn,
	)

	assert.Equal(
		t,
		expFieldProps.nullable,
		f.Nullable(),
		"expected nullable value for field to be %v, got %v instead",
		expFieldProps.nullable,
		f.Nullable(),
	)

	assert.Equal(
		t,
		expFieldProps.defaultValue,
		f.DefaultValue(),
		"expected default value for field to be %v, got %v instead",
		expFieldProps.DefaultValue(),
		f.DefaultValue(),
	)

	assert.Equal(
		t,
		expFieldProps.fkey,
		f.fkey,
		"expected fkey values were not equal",
	)

	// clone and confirm that the clone is equal
	f2, err := f.Clone()
	require.Nil(t, err)
	assert.True(t, FieldEqual(f, f2))
}

func testDBType(t *testing.T, f *Field, expectedType string) {
	assert.Equal(
		t,
		expectedType,
		f.GetDbTypeForField(),
		"expected db type for field %s to be %s, got %s instead",
		f.FieldName,
		expectedType,
		f.GetDbTypeForField(),
	)
}

func testGraphQLType(t *testing.T, f *Field, expectedType string) {
	assert.Equal(
		t,
		expectedType,
		f.GetGraphQLTypeForField(),

		"expected graphql type for field %s to be %s, got %s instead",
		f.FieldName,
		expectedType,
		f.GetGraphQLTypeForField(),
	)
}
