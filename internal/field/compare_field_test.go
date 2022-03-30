package field

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func TestCompareNonEntField(t *testing.T) {
	f := NewNonEntField(&codegenapi.DummyConfig{}, "f1", &enttype.IntegerType{}, true)
	f2 := NewNonEntField(&codegenapi.DummyConfig{}, "f1", &enttype.IntegerType{}, true)

	require.True(t, NonEntFieldEqual(f, f2))
}

func TestCompareUnequalNonEntField(t *testing.T) {
	f := NewNonEntField(&codegenapi.DummyConfig{}, "f1", &enttype.IntegerType{}, true)
	f2 := NewNonEntField(&codegenapi.DummyConfig{}, "f2", &enttype.IntegerType{}, true)

	require.False(t, NonEntFieldEqual(f, f2))
}

func TestCompareUnequalNonEntFieldType(t *testing.T) {
	f := NewNonEntField(&codegenapi.DummyConfig{}, "f1", &enttype.IntegerType{}, true)
	f2 := NewNonEntField(&codegenapi.DummyConfig{}, "f1", &enttype.StringType{}, true)

	require.False(t, NonEntFieldEqual(f, f2))
}

func TestCompareField(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
	}
	require.True(t, FieldEqual(f, f2))
}

func TestCompareUnequalField(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
	}
	f2 := &Field{
		FieldName: "name",
		nullable:  true,
		fieldType: &enttype.TimeType{},
	}
	require.False(t, FieldEqual(f, f2))
}

func TestPolymorphicField(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		polymorphic: &input.PolymorphicOptions{
			Types: []string{"user"},
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		polymorphic: &input.PolymorphicOptions{
			Types: []string{"user"},
		},
	}
	require.True(t, FieldEqual(f, f2))
}

func TestUnequalPolymorphicField(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		polymorphic: &input.PolymorphicOptions{
			Types: []string{"user"},
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		polymorphic: &input.PolymorphicOptions{
			Types:              []string{"user"},
			DisableBuilderType: true,
		},
	}
	require.False(t, FieldEqual(f, f2))
}

func TestForeignKeyField(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fkey: &ForeignKeyInfo{
			Schema: "User",
			Field:  "id",
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fkey: &ForeignKeyInfo{
			Schema: "User",
			Field:  "id",
		},
	}
	require.True(t, FieldEqual(f, f2))
}

func TestUnequalForeignKeyField(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fkey: &ForeignKeyInfo{
			Schema: "User",
			Field:  "id",
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fkey: &ForeignKeyInfo{
			Schema:       "User",
			Field:        "id",
			DisableIndex: true,
		},
	}
	require.False(t, FieldEqual(f, f2))
}

func TestFieldEdgeWithInverse(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			InverseEdge: &input.InverseFieldEdge{
				Name: "CreatedEvents",
			},
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			InverseEdge: &input.InverseFieldEdge{
				Name: "CreatedEvents",
			},
		},
	}
	require.True(t, FieldEqual(f, f2))
}

func TestFieldEdgeWithUnequalInverse(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			InverseEdge: &input.InverseFieldEdge{
				Name: "CreatedEvents",
			},
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			InverseEdge: &input.InverseFieldEdge{
				Name:            "CreatedEvents",
				HideFromGraphQL: true,
			},
		},
	}
	require.False(t, FieldEqual(f, f2))
}

func TestFieldEdgeWithPolymorphic(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			Polymorphic: &base.PolymorphicOptions{
				PolymorphicOptions: &input.PolymorphicOptions{
					Types: []string{"user"},
				},
				Unique: true,
			},
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			Polymorphic: &base.PolymorphicOptions{
				PolymorphicOptions: &input.PolymorphicOptions{
					Types: []string{"user"},
				},
				Unique: true,
			},
		},
	}
	require.True(t, FieldEqual(f, f2))
}

func TestFieldEdgeWithUnequalPolymorphic(t *testing.T) {
	f := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			Polymorphic: &base.PolymorphicOptions{
				PolymorphicOptions: &input.PolymorphicOptions{
					Types: []string{"user"},
				},
				Unique: true,
			},
		},
	}
	f2 := &Field{
		FieldName: "name",
		fieldType: &enttype.TimeType{},
		fieldEdge: &base.FieldEdgeInfo{
			Schema: "User",
			Polymorphic: &base.PolymorphicOptions{
				PolymorphicOptions: &input.PolymorphicOptions{
					Types: []string{"user"},
				},
				Unique:        true,
				NodeTypeField: "User",
			},
		},
	}
	require.False(t, FieldEqual(f, f2))
}

func TestFieldWithInverseEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"User", &input.AssocEdge{
			Name:       "CreatedEvents",
			SchemaName: "Event",
		})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"User", &input.AssocEdge{
			Name:       "CreatedEvents",
			SchemaName: "Event",
		})
	require.Nil(t, err)

	f := &Field{
		FieldName:   "name",
		fieldType:   &enttype.TimeType{},
		inverseEdge: edge1,
	}
	f2 := &Field{
		FieldName:   "name",
		fieldType:   &enttype.TimeType{},
		inverseEdge: edge2,
	}
	require.True(t, FieldEqual(f, f2))
}

func TestFieldWithUnequalInverseEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"User", &input.AssocEdge{
			Name:       "CreatedEvents",
			SchemaName: "Event",
		})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"User", &input.AssocEdge{
			Name:       "eventsCreated",
			SchemaName: "Event",
		})
	require.Nil(t, err)

	f := &Field{
		FieldName:   "name",
		fieldType:   &enttype.TimeType{},
		inverseEdge: edge1,
	}
	f2 := &Field{
		FieldName:   "name",
		fieldType:   &enttype.TimeType{},
		inverseEdge: edge2,
	}
	require.False(t, FieldEqual(f, f2))
}
