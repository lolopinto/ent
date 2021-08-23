package typeschema

import (
	"errors"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
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
					Name:   "foo",
					Import: &stringImport{},
				},
				{
					Name:   "bar",
					Import: &emailImport{},
				},
				{
					Name:   "baz",
					Import: &passwordImport{},
				},
				{
					Name:   "foo2",
					Import: &intImport{},
				},
				{
					Name:   "hello",
					Import: &boolImport{},
				},
			},
		},
		"different case + aliases": {
			fields: "foo:String bar:EMAIL baz:PasSWORD foo2:INTEGER hello:BOOLEAN",
			result: []*Field{
				{
					Name:   "foo",
					Import: &stringImport{},
				},
				{
					Name:   "bar",
					Import: &emailImport{},
				},
				{
					Name:   "baz",
					Import: &passwordImport{},
				},
				{
					Name:   "foo2",
					Import: &intImport{},
				},
				{
					Name:   "hello",
					Import: &boolImport{},
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
	}

	for k, v := range tests {
		t.Run(k, func(t *testing.T) {
			fields := strings.Split(v.fields, " ")
			res, err := parseFields(fields)
			if v.expectedErr == nil {
				require.Nil(t, err)

				require.Equal(t, v.result, res)
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
