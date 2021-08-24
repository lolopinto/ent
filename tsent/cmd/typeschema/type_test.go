package typeschema

import (
	"errors"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testcase struct {
	fields      string
	result      []*Field
	expectedErr error
}

func TestParse(t *testing.T) {
	tests := map[string]testcase{
		"basic": {
			fields: "foo:string bar:email baz:password foo2:int hello:bool",
			result: []*Field{
				{
					Name:               "foo",
					Import:             &stringImport{},
					expFieldObjectCall: "{name: \"foo\"}",
				},
				{
					Name:               "bar",
					Import:             &emailImport{},
					expFieldObjectCall: "{name: \"bar\"}",
				},
				{
					Name:               "baz",
					Import:             &passwordImport{},
					expFieldObjectCall: "{name: \"baz\"}",
				},
				{
					Name:               "foo2",
					Import:             &intImport{},
					expFieldObjectCall: "{name: \"foo2\"}",
				},
				{
					Name:               "hello",
					Import:             &boolImport{},
					expFieldObjectCall: "{name: \"hello\"}",
				},
			},
		},
		"different case + aliases": {
			fields: "foo:String bar:EMAIL baz:PasSWORD foo2:INTEGER hello:BOOLEAN",
			result: []*Field{
				{
					Name:               "foo",
					Import:             &stringImport{},
					expFieldObjectCall: "{name: \"foo\"}",
				},
				{
					Name:               "bar",
					Import:             &emailImport{},
					expFieldObjectCall: "{name: \"bar\"}",
				},
				{
					Name:               "baz",
					Import:             &passwordImport{},
					expFieldObjectCall: "{name: \"baz\"}",
				},
				{
					Name:               "foo2",
					Import:             &intImport{},
					expFieldObjectCall: "{name: \"foo2\"}",
				},
				{
					Name:               "hello",
					Import:             &boolImport{},
					expFieldObjectCall: "{name: \"hello\"}",
				},
			},
		},
		"unknown type": {
			fields:      "bar:string foo:unknown",
			expectedErr: errors.New("unknown is not a valid type for a field"),
		},
		"invalid format": {
			fields:      "bar:string foo",
			expectedErr: errors.New("invalid field format foo. needs to be of the form field:type"),
		},
		"duplicate field": {
			fields:      "bar:string bar:int",
			expectedErr: errors.New("field bar in schema more than once"),
		},
		"other keys": {
			fields: "foo:string:index bar:email:unique baz:password:private:hideFromGraphQL foo2:int:nullable hello:bool",
			result: []*Field{
				{
					Name:               "foo",
					Import:             &stringImport{},
					Index:              true,
					expFieldObjectCall: "{name: \"foo\", index: true}",
				},
				{
					Name:               "bar",
					Import:             &emailImport{},
					Unique:             true,
					expFieldObjectCall: "{name: \"bar\", unique: true}",
				},
				{
					Name:               "baz",
					Import:             &passwordImport{},
					Private:            true,
					HideFromGraphQL:    true,
					expFieldObjectCall: "{name: \"baz\", private: true, hideFromGraphQL: true}",
				},
				{
					Name:               "foo2",
					Import:             &intImport{},
					Nullable:           true,
					expFieldObjectCall: "{name: \"foo2\", nullable: true}",
				},
				{
					Name:   "hello",
					Import: &boolImport{},
				},
			},
		},
		"invalid other key": {
			fields:      "foo:string:index bar:email:unique baz:password:invalid foo2:int:nullable hello:bool",
			expectedErr: errors.New("invalid key invalid in field format"),
		},
		"complex other keys": {
			fields: "foo;string;serverDefault:bar bar:email:unique accountId;uuid;foreignKey:{schema:User;column:id};storageKey:user_id;defaultToViewerOnCreate",
			result: []*Field{
				{
					Name:               "foo",
					Import:             &stringImport{},
					ServerDefault:      "bar",
					expFieldObjectCall: "{name: \"foo\", serverDefault: \"bar\"}",
				},
				{
					Name:               "bar",
					Import:             &emailImport{},
					Unique:             true,
					expFieldObjectCall: "{name: \"bar\", unique: true}",
				},
				{
					Name:   "accountId",
					Import: &uuidImport{},
					ForeignKey: &input.ForeignKey{
						Schema: "User",
						Column: "id",
					},
					DefaultToViewerOnCreate: true,
					StorageKey:              "user_id",
					expFieldObjectCall:      "{name: \"accountId\", defaultToViewerOnCreate: true, storageKey: \"user_id\", foreignKey: {schema: \"User\", column: \"id\"}}",
				},
			},
		},
	}

	for k, v := range tests {
		t.Run(k, func(t *testing.T) {
			fields := strings.Split(v.fields, " ")
			res, err := parseFields(fields)
			if v.expectedErr == nil {
				require.Nil(t, err)

				require.Equal(t, len(v.result), len(res))
				for i, expF := range v.result {
					f := res[i]
					require.Equal(t, expF.Name, f.Name, f.Name)
					assert.Equal(t, expF.Import, f.Import, f.Name)
					assert.Equal(t, expF.Unique, f.Unique, f.Name)
					assert.Equal(t, expF.PrimaryKey, f.PrimaryKey, f.Name)
					assert.Equal(t, expF.Index, f.Index, f.Name)
					assert.Equal(t, expF.Nullable, f.Nullable, f.Name)
					assert.Equal(t, expF.Private, f.Private, f.Name)
					assert.Equal(t, expF.HideFromGraphQL, f.HideFromGraphQL, f.Name)
					assert.Equal(t, expF.DefaultToViewerOnCreate, f.DefaultToViewerOnCreate, f.Name)
					assert.Equal(t, expF.ServerDefault, f.ServerDefault, f.Name)
					assert.Equal(t, expF.ForeignKey, f.ForeignKey, f.Name)
					assert.Equal(t, expF.StorageKey, f.StorageKey, f.Name)
					assert.Equal(t, expF.GraphQLName, f.GraphQLName, f.Name)

					// TODO unconditional test
					if expF.expFieldObjectCall != "" {
						assert.Equal(t, expF.expFieldObjectCall, f.FieldObjectCall(), f.Name)
					}
				}
			} else {
				require.NotNil(t, err)
				require.Equal(t, err.Error(), v.expectedErr.Error())
			}
		})
	}
}

type typeTestCase struct {
	importPath    string
	imp           string
	defaultImport bool
	aliases       []string
}

func TestTypes(t *testing.T) {
	testcases := map[string]typeTestCase{
		"string": {
			importPath: codepath.SchemaPackage,
			imp:        "StringType",
			aliases:    []string{"string", "text"},
		},
		"uuid": {
			importPath: codepath.SchemaPackage,
			imp:        "UUIDType",
			aliases:    []string{"uuid"},
		},
		"int": {
			importPath: codepath.SchemaPackage,
			imp:        "IntegerType",
			aliases:    []string{"int", "integer"},
		},
		"float": {
			importPath: codepath.SchemaPackage,
			imp:        "FloatType",
			aliases:    []string{"float"},
		},
		"bool": {
			importPath: codepath.SchemaPackage,
			imp:        "BooleanType",
			aliases:    []string{"bool", "boolean"},
		},
		"timestamp": {
			importPath: codepath.SchemaPackage,
			imp:        "TimestampType",
			aliases:    []string{"timestamp"},
		},
		"timestamptz": {
			importPath: codepath.SchemaPackage,
			imp:        "TimestamptzType",
			aliases:    []string{"timestamptz"},
		},
		"time": {
			importPath: codepath.SchemaPackage,
			imp:        "TimeType",
			aliases:    []string{"time"},
		},
		"timetz": {
			importPath: codepath.SchemaPackage,
			imp:        "TimetzType",
			aliases:    []string{"timetz"},
		},
		"date": {
			importPath: codepath.SchemaPackage,
			imp:        "DateType",
			aliases:    []string{"date"},
		},
		"email": {
			importPath: codepath.EmailPackage,
			imp:        "EmailType",
			aliases:    []string{"email", "email-address", "email_address"},
		},
		"phone": {
			importPath: codepath.PhonenumberPackage,
			imp:        "PhoneNumberType",
			aliases:    []string{"phone", "phone_number", "phone-number"},
		},
		"password": {
			importPath: codepath.PasswordPackage,
			imp:        "PasswordType",
			aliases:    []string{"password"},
		},
	}

	for k, v := range testcases {
		t.Run(k, func(t *testing.T) {
			typ := GetTypeForField(k)
			require.NotNil(t, typ)
			assert.Equal(t, typ.Aliases(), v.aliases)
			assert.Equal(t, typ.ImportPath(), v.importPath)
			assert.Equal(t, typ.Import(), v.imp)
			assert.Equal(t, typ.DefaultImport(), v.defaultImport)

			for _, alias := range typ.Aliases() {
				require.NotNil(t, GetTypeForField(alias))
			}
		})
	}
}
