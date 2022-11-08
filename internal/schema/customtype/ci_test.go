package customtype

import (
	"testing"

	"github.com/lolopinto/ent/internal/field"
	"github.com/stretchr/testify/require"
)

func TestCompare(t *testing.T) {
	ci := &CustomInterface{
		TSType:  "Foo",
		GQLName: "Foo",
		Fields: []*field.Field{
			{
				FieldName: "Foo",
			},
		},
	}
	ci2 := &CustomInterface{
		TSType:  "Foo",
		GQLName: "Foo",
		Fields: []*field.Field{
			{
				FieldName: "Foo",
			},
		},
	}
	require.True(t, CustomInterfaceEqual(ci, ci2))
}

func TestCompareWithAction(t *testing.T) {
	ci := &CustomInterface{
		TSType:  "Foo",
		GQLName: "Foo",
		Fields: []*field.Field{
			{
				FieldName: "Foo",
			},
		},
		// can't actually test this because of circular dependencies so this is fine..
		Action: "foo",
	}
	ci2 := &CustomInterface{
		TSType:  "Foo",
		GQLName: "Foo",
		Fields: []*field.Field{
			{
				FieldName: "Foo",
			},
		},
		// can't actually test this because of circular dependencies so this is fine..
		Action: "foo2222",
	}
	require.True(t, CustomInterfaceEqual(ci, ci2))
}

func TestCompareWithOneNullAction(t *testing.T) {
	ci := &CustomInterface{
		TSType:  "Foo",
		GQLName: "Foo",
		Fields: []*field.Field{
			{
				FieldName: "Foo",
			},
		},
	}
	ci2 := &CustomInterface{
		TSType:  "Foo",
		GQLName: "Foo",
		Fields: []*field.Field{
			{
				FieldName: "Foo",
			},
		},
		Action: "foo2222",
	}
	require.False(t, CustomInterfaceEqual(ci, ci2))
}
