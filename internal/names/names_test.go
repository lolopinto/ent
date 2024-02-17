package names_test

import (
	"fmt"
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
		{[]string{"firstName"}, "firstName"},
		{[]string{"first_name"}, "firstName"},
		{[]string{"FirstName"}, "firstName"},
		{[]string{"create", "Foo"}, "createFoo"},
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
		// TODO this is still broken
		// {[]string{"userIDs"}, "user_ids"},
		{[]string{"userIds"}, "user_ids"},
		{[]string{"firstName"}, "first_name"},
		{[]string{"first_name"}, "first_name"},
		{[]string{"FirstName"}, "first_name"},
	}

	for i, tt := range tests {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
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
		{[]string{"C_PLUS_PLUS"}, "CPlusPlus"},
		{[]string{"Create", "Foo", "Action"}, "CreateFooAction"},
		{[]string{"create", "foo", "action"}, "CreateFooAction"},
	}

	for i, tt := range tests {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
			actual := names.ToClassType(tt.names...)
			assert.Equal(t, tt.expected, actual, "Expected %s, got %s", tt.expected, actual)
		})
	}
}
