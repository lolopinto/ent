package enttype

import (
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
		"bigint": {
			importPath: codepath.SchemaPackage,
			imp:        "BigIntegerType",
			aliases:    []string{"bigint", "int64"},
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
		"json": {
			importPath: codepath.Package,
			imp:        "JSONType",
			aliases:    []string{"json"},
		},
		"jsonb": {
			importPath: codepath.Package,
			imp:        "JSONBType",
			aliases:    []string{"jsonb"},
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
