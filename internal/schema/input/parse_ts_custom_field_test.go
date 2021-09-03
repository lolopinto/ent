package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCustomFields(t *testing.T) {
	data := `
 {
	 "User": {
		 "fields": [
				{
					"name": "email",
					"type": {
						"dbType": "String",
						"customType": "email"
					}
				},
				{
					"name": "nullable_email",
					"type": {
						"dbType": "String",
						"customType": "email"
					},
					"nullable": true
				},
				{
					"name": "password",
					"type": {
						"dbType": "String",
						"customType": "password"
					}
				},
				{
					"name": "nullable_password",
					"type": {
						"dbType": "String",
						"customType": "password"
					},
					"nullable": true
				},
				{
					"name": "phone",
					"type": {
						"dbType": "String",
						"customType": "phone"
					}
				},
				{
					"name": "nullable_phone",
					"type": {
						"dbType": "String",
						"customType": "phone"
					},
					"nullable": true
				}
		 ]
	 }
	}`

	s, err := input.ParseSchema([]byte(data))
	require.Nil(t, err)
	require.Len(t, s.Nodes, 1)
	user := s.Nodes["User"]
	require.Len(t, user.Fields, 6)

	getField := func(name string) *input.Field {
		for _, v := range user.Fields {
			if v.Name == name {
				return v
			}
		}
		require.Fail(t, "couldn't find field %s", name)
		return nil
	}

	validateField(t, getField("email"), &enttype.EmailType{})
	validateField(t, getField("nullable_email"), &enttype.NullableEmailType{})
	validateField(t, getField("phone"), &enttype.PhoneType{})
	validateField(t, getField("nullable_phone"), &enttype.NullablePhoneType{})
	validateField(t, getField("password"), &enttype.PasswordType{})
	validateField(t, getField("nullable_password"), &enttype.NullablePasswordType{})
}

func validateField(t *testing.T, f *input.Field, expType enttype.TSGraphQLType) {
	typ, err := f.GetEntType()
	require.Nil(t, err)
	assert.Equal(t, expType, typ)
}
