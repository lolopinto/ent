package field

import (
	"strconv"
	"sync"
	"testing"

	"github.com/lolopinto/ent/internal/parsehelper"
	testsync "github.com/lolopinto/ent/internal/testingutils/sync"
	"github.com/stretchr/testify/assert"
)

func TestFieldInfo(t *testing.T) {
	fieldInfo := getTestFieldInfo(t, "AccountConfig")

	length := len(fieldInfo.Fields)
	expectedLength := 11
	assert.Equal(t, expectedLength, len(fieldInfo.Fields), "expected %d fields generated. got %d instead", expectedLength, length)
}

func TestIDField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "ID")

	testField(
		t,
		f,
		&Field{
			FieldName:             "ID",
			singleFieldPrimaryKey: true,
			hideFromGraphQL:       false,
			topLevelStructField:   false,
			dbColumn:              true,
			nullable:              false,
			dbName:                "id",
			graphQLName:           "id",
		},
	)
	testDBType(t, f, "postgresql.UUID()")
	testGraphQLType(t, f, "ID!")
}

func TestCreatedAtField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "CreatedAt")

	testField(
		t,
		f,
		&Field{
			FieldName:             "CreatedAt",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       true,
			topLevelStructField:   false,
			dbColumn:              true,
			nullable:              false,
			dbName:                "created_at",
			graphQLName:           "createdAt",
		},
	)
	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time!")
}

func TestUpdatedAtField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "UpdatedAt")

	testField(
		t,
		f,
		&Field{
			FieldName:             "UpdatedAt",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       true,
			topLevelStructField:   false,
			dbColumn:              true,
			nullable:              false,
			dbName:                "updated_at",
			graphQLName:           "updatedAt",
		},
	)
	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time!")
}

func TestDefaultGraphQLField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "FirstName")

	testField(
		t,
		f,
		&Field{
			FieldName:             "FirstName",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       false,
			topLevelStructField:   true,
			dbColumn:              true,
			nullable:              false,
			dbName:                "first_name",
			graphQLName:           "firstName",
		},
	)
}

func TestOverridenGraphQLField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastLoginAt")

	testField(
		t,
		f,
		&Field{
			FieldName:             "LastLoginAt",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       false,
			topLevelStructField:   true,
			dbColumn:              true,
			nullable:              false,
			dbName:                "last_login_time",
			graphQLName:           "lastLoginTime",
		},
	)
}

func TestHiddenGraphQLField(t *testing.T) {
	// Also tests default value...
	f := getTestFieldByName(t, "AccountConfig", "NumberOfLogins")

	testField(
		t,
		f,
		&Field{
			FieldName:             "NumberOfLogins",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       true,
			topLevelStructField:   true,
			dbColumn:              true,
			nullable:              false,
			defaultValue:          "0",
			dbName:                "number_of_logins",
			graphQLName:           "numberOfLogins",
		},
	)
}

func TestTypesForStringField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "FirstName")

	testDBType(t, f, "sa.Text()")
	testGraphQLType(t, f, "String!")
	testStructType(t, f, "string")
}

func TestNullableStringField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "Bio")

	testField(
		t,
		f,
		&Field{
			FieldName:             "Bio",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       false,
			topLevelStructField:   true,
			dbColumn:              true,
			nullable:              true,
			dbName:                "bio",
			graphQLName:           "bio",
		},
	)
	testDBType(t, f, "sa.Text()")
	testGraphQLType(t, f, "String")
	testStructType(t, f, "*string")
}

func TestTypesForIntegerField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "NumberOfLogins")

	testDBType(t, f, "sa.Integer()")
	testGraphQLType(t, f, "Int!") // this is a weird ish test because it's not exposed to graphql but that's neither here nor there...
	testStructType(t, f, "int")
}

func TestTypesForTimeField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastLoginAt")

	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time!")
	testStructType(t, f, "time.Time")
}

func TestNullableTimeField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "DateOfBirth")

	testField(
		t,
		f,
		&Field{
			FieldName:             "DateOfBirth",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       false,
			topLevelStructField:   true,
			dbColumn:              true,
			nullable:              true,
			dbName:                "date_of_birth",
			graphQLName:           "dateOfBirth",
		},
	)
	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time")
	testStructType(t, f, "*time.Time")
}

func TestTypesForBoolField(t *testing.T) {
	f := getTestFieldByName(t, "TodoConfig", "Completed")

	testDBType(t, f, "sa.Boolean()")
	testGraphQLType(t, f, "Boolean!")
	testStructType(t, f, "bool")
}

func TestNullableBoolField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "ShowBioOnProfile")

	testField(
		t,
		f,
		&Field{
			FieldName:             "ShowBioOnProfile",
			singleFieldPrimaryKey: false,
			hideFromGraphQL:       false,
			topLevelStructField:   true,
			dbColumn:              true,
			nullable:              true,
			dbName:                "show_bio_on_profile",
			graphQLName:           "showBioOnProfile",
		},
	)
	testDBType(t, f, "sa.Boolean()")
	testGraphQLType(t, f, "Boolean")
	testStructType(t, f, "*bool")
}

func TestTypesForCustomStringField(t *testing.T) {
	f := getTestFieldByName(t, "TodoConfig", "AccountType")

	testDBType(t, f, "sa.Text()")        // string in db because yup
	testGraphQLType(t, f, "String!")     // string in graphql because enum not exposed
	testStructType(t, f, "ent.NodeType") // strongly typed in golang
}

func TestDefaultDBField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "FirstName")

	testColName(t, f, "first_name")
}

func TestOverridenDBField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastLoginAt")

	testColName(t, f, "last_login_time")
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

	structField := f.TopLevelStructField()
	assert.Equal(
		t,
		expFieldProps.topLevelStructField,
		structField,
		"expected top level struct field to be %v, got %v instead",
		expFieldProps.topLevelStructField,
		structField,
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

	assert.Equal(
		t,
		expFieldProps.pkgPath,
		f.pkgPath,
		"expected package path values were not equal. expected %s got %s",
		expFieldProps.pkgPath,
		f.pkgPath,
	)
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

func testStructType(t *testing.T, f *Field, expectedType string) {
	typ := GetNilableGoType(f)
	assert.Equal(
		t,
		expectedType,
		typ,
		"expected type in struct definition for field %T to be %s, got %s instead",
		f.fieldType,
		expectedType,
		typ,
	)
}

func testColName(t *testing.T, f *Field, expectedColName string) {
	assert.Equal(
		t,
		expectedColName,
		f.GetDbColName(),
		"expected col name for field %s to be %s, got %s instead",
		f.FieldName,
		expectedColName,
		f.GetDbColName(),
	)

	assert.Equal(
		t,
		strconv.Quote(expectedColName),
		f.GetQuotedDBColName(),
		"expected quoted col name for field %s to be %s, got %s instead",
		f.FieldName,
		strconv.Quote(expectedColName),
		f.GetQuotedDBColName(),
	)
}

var r *testsync.RunOnce
var once sync.Once

func getFieldInfoMap() *testsync.RunOnce {
	once.Do(func() {
		r = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := parsehelper.ParseFilesForTest(t, parsehelper.ParseFuncs(parsehelper.ParseStruct))

			fieldInfo, err := GetFieldInfoForStruct(data.StructMap[configName], data.Info)

			assert.Nil(t, err)
			assert.NotNil(t, fieldInfo, "invalid fieldInfo retrieved")
			return fieldInfo
		})
	})
	return r
}

// in an ideal world, this is also in asttester but code duplication here is fine for now
// don't wanna deal with untangling the circular dependencies by making this package field_test
// because I like using private field Info to indicate expected behavior...
// these 2 copied into action_test.go for now...
func getTestFieldInfo(t *testing.T, configName string) *FieldInfo {
	return getFieldInfoMap().Get(t, configName).(*FieldInfo)
}

func getTestFieldByName(t *testing.T, configName string, fieldName string) *Field {
	fieldInfo := getTestFieldInfo(t, configName)
	return fieldInfo.GetFieldByName(fieldName)
}
