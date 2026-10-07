package customtype

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func TestGlobalStructReferenceRequiresParentConversion(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	fi, err := field.NewFieldInfoFromInputs(cfg, "Parent", []*input.Field{{
		Name: "entry",
		Type: &input.FieldType{DBType: input.JSONB, Type: "Entry", GlobalType: "Entry"},
	}}, &field.Options{})
	require.NoError(t, err)
	ci := &CustomInterface{TSType: "Parent", Fields: fi.EntFields()}
	require.Empty(t, ci.Children)
	// No local key renaming or child declaration can trigger this conversion;
	// only the referenced global struct requires the parent wrapper.
	require.Equal(t, ci.Fields[0].TsFieldName(cfg), ci.Fields[0].GetDbColName())
	require.True(t, ci.HasConvertFunction(cfg))
}
