package graphql

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCustomFieldMarshall(t *testing.T) {
	tt := map[string]CustomField{
		"accessor": {
			Node:        "User",
			GraphQLName: "contacts",
			FieldType:   Accessor,
		},
		"field": {
			Node:        "User",
			GraphQLName: "contacts",
			FieldType:   Field,
		},
		"function": {
			Node:        "User",
			GraphQLName: "contacts",
			FieldType:   Function,
		},
		"async function": {
			Node:        "User",
			GraphQLName: "contacts",
			FieldType:   AsyncFunction,
		},
		"async function diff fn": {
			Node:         "User",
			GraphQLName:  "contacts",
			FunctionName: "getContacts",
			FieldType:    AsyncFunction,
		},
		"with args": {
			Node:         "User",
			GraphQLName:  "contactsSameDomain",
			FunctionName: "getContactsSameDomain",
			FieldType:    AsyncFunction,
			Args: []CustomItem{
				{
					Name:         "context",
					Type:         "Context",
					IsContextArg: true,
				},
				{
					Name:     "id",
					Type:     "string",
					Nullable: NullableTrue,
					List:     true,
				},
			},
		},
		"with result": {
			Node:         "User",
			GraphQLName:  "contactsSameDomain",
			FunctionName: "getContactsSameDomain",
			FieldType:    AsyncFunction,
			Results: []CustomItem{
				{
					Name: "",
					Type: "User",
				},
			},
		},
		"with both": {
			Node:         "User",
			GraphQLName:  "contactsSameDomain",
			FunctionName: "getContactsSameDomain",
			FieldType:    AsyncFunction,
			Args: []CustomItem{
				{
					Name:         "context",
					Type:         "Context",
					IsContextArg: true,
				},
				{
					Name:     "id",
					Type:     "string",
					Nullable: NullableTrue,
					List:     true,
				},
			}, Results: []CustomItem{
				{
					Name: "",
					Type: "User",
				},
			},
		},
		"with connection": {
			Node:         "User",
			GraphQLName:  "contactsSameDomain",
			FunctionName: "getContactsSameDomain",
			FieldType:    AsyncFunction,
			// ignored by json
			Connection: true,
			Args: []CustomItem{
				{
					Name:         "context",
					Type:         "Context",
					IsContextArg: true,
				},
				{
					Name:     "id",
					Type:     "string",
					Nullable: NullableTrue,
					List:     true,
				},
			},
			Results: []CustomItem{
				{
					Name:       "",
					Type:       "UserConnection",
					Connection: true,
				},
			},
		},
		"connection. no args": {
			Node:         "User",
			GraphQLName:  "contactsSameDomain",
			FunctionName: "getContactsSameDomain",
			FieldType:    AsyncFunction,
			// ignored by json
			Connection: true,
			Results: []CustomItem{
				{
					Name:       "",
					Type:       "UserConnection",
					Connection: true,
				},
			},
		}}
	for k, cf := range tt {
		t.Run(k, func(t *testing.T) {
			b, err := json.Marshal(cf)
			require.Nil(t, err)

			var cf2 CustomField
			err = json.Unmarshal(b, &cf2)
			require.Nil(t, err)

			eq := customFieldEqual(&cf, &cf2)
			if !isConnection(&cf) {
				require.True(t, eq)
			} else {
				require.Equal(t, isConnection(&cf), isConnection(&cf2))
				// append context args
				if !eq {
					cf.Args = append(cf.Args, getConnectionArgs()...)
				}
				eq = customFieldEqual(&cf, &cf2)
				assert.True(t, eq)
			}
		})
	}
}
