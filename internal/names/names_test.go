package names_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/names"
	"github.com/stretchr/testify/assert"
)

type test struct {
	names    []string
	expected string
}

func TestToTsFieldName(t *testing.T) {
	tests := []test{
		{[]string{"ID"}, "id"},
		{[]string{"id"}, "id"},
		{[]string{"id", "Foo"}, "idFoo"},
		{[]string{"_", "name"}, "_name"},
		{[]string{"foo"}, "foo"},
		{[]string{"foo", "bar"}, "fooBar"},
		{[]string{"foo", "bar", "baz"}, "fooBarBaz"},
		{[]string{"foo_bar"}, "fooBar"},
		{[]string{"foo_bar", "baz"}, "fooBarBaz"},
		{[]string{"userID"}, "userId"},
		{[]string{"userId"}, "userId"},
		{[]string{"userIDs"}, "userIds"},
		{[]string{"userIds"}, "userIds"},
		{[]string{"user_ids"}, "userIds"},
		{[]string{"user_id"}, "userId"},
		{[]string{"firstName"}, "firstName"},
		{[]string{"first_name"}, "firstName"},
		{[]string{"FirstName"}, "firstName"},
		{[]string{"create", "Foo"}, "createFoo"},
		{[]string{"timeInMs"}, "timeInMs"},
		{[]string{"getNewTimeInMsValue"}, "getNewTimeInMsValue"},
	}

	for i, tt := range tests {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
			actual := names.ToTsFieldName(tt.names...)
			assert.Equal(t, tt.expected, actual, "Expected %s, got %s", tt.expected, actual)
		})
	}
}

func TestToDbColumn(t *testing.T) {
	tests := []test{
		{[]string{"ID"}, "id"},
		{[]string{"id"}, "id"},
		{[]string{"id", "Foo"}, "id_foo"},
		{[]string{"_", "name"}, "_name"}, // TODO do we care about this?
		{[]string{"foo"}, "foo"},
		{[]string{"foo", "bar"}, "foo_bar"},
		{[]string{"foo", "bar", "baz"}, "foo_bar_baz"},
		{[]string{"foo_bar"}, "foo_bar"},
		{[]string{"foo_bar", "baz"}, "foo_bar_baz"},
		{[]string{"userID"}, "user_id"},
		{[]string{"userId"}, "user_id"},
		{[]string{"userIDs"}, "user_ids"},
		{[]string{"userIds"}, "user_ids"},
		{[]string{"firstName"}, "first_name"},
		{[]string{"first_name"}, "first_name"},
		{[]string{"FirstName"}, "first_name"},

		// second strcase handles this so using it for this case
		{[]string{"event_rsvps", "id1", "edge_type", "id2", "pkey"}, "event_rsvps_id1_edge_type_id2_pkey"},

		// this is a breaking change from the previous implementation
		// fine with it because it's consistent with what JS does
		// and is what I'd expect if writing this from scratch
		{[]string{"new_col"}, "new_col"},
		{[]string{"newCol"}, "new_col"},
		{[]string{"new_col2"}, "new_col2"},
		{[]string{"cover_photo"}, "cover_photo"},
		{[]string{"coverPhoto"}, "cover_photo"},
		{[]string{"cover_photo2"}, "cover_photo2"},

		{[]string{"timeInMs"}, "time_in_ms"},
	}

	for _, tt := range tests {
		t.Run(strings.Join(tt.names, "_"), func(t *testing.T) {
			actual := names.ToDBColumn(tt.names...)
			assert.Equal(t, tt.expected, actual, "Expected %s, got %s", tt.expected, actual)
		})
	}
}

func TestGraphQLEnumName(t *testing.T) {
	tests := []test{
		{[]string{"Typescript"}, "TYPESCRIPT"},
		{[]string{"typescript"}, "TYPESCRIPT"},
		{[]string{"C_PLUS_PLUS"}, "C_PLUS_PLUS"},
		{[]string{"c_plus_plus"}, "C_PLUS_PLUS"},
	}

	for i, tt := range tests {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
			assert.Len(t, tt.names, 1)
			actual := names.ToGraphQLEnumName(tt.names[0])
			assert.Equal(t, tt.expected, actual, "Expected %s, got %s", tt.expected, actual)
		})
	}
}

func TestToClassType(t *testing.T) {
	tests := []test{
		{[]string{"Foo", "Type"}, "FooType"},
		{[]string{"foo", "type"}, "FooType"},
		{[]string{"Create", "Foo", "Action"}, "CreateFooAction"},
		{[]string{"create", "foo", "action"}, "CreateFooAction"},
		{[]string{"UserAuthJWTInputType"}, "UserAuthJWTInputType"},
		{[]string{"timeInMs"}, "TimeInMs"},
		{[]string{"timeInMs", "Type"}, "TimeInMsType"},
	}

	for i, tt := range tests {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
			actual := names.ToClassType(tt.names...)
			assert.Equal(t, tt.expected, actual, "Expected %s, got %s", tt.expected, actual)
		})
	}
}
