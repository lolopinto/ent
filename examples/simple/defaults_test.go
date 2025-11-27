package simple

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/require"
)

func TestCreateActionDefaultsMakeFieldsOptional(t *testing.T) {
	schemaPath := filepath.Join("src", "schema", "defaults_example_schema.ts")
	code, err := os.ReadFile(schemaPath)
	require.NoError(t, err)

	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"defaults_example_schema.ts": testhelper.GetCodeWithSchema(string(code)),
		},
		"DefaultsExample",
	)

	createAction := actionInfo.GetByName("CreateDefaultsExampleAction")
	require.NotNil(t, createAction)

	getField := func(name string) action.ActionField {
		for _, f := range createAction.GetFields() {
			if f.TsBuilderFieldName() == name {
				return f
			}
		}
		return nil
	}

	creatorID := getField("creatorId")
	perHour := getField("perHour")
	hourlyLimit := getField("hourlyLimit")
	name := getField("name")

	require.NotNil(t, creatorID)
	require.NotNil(t, perHour)
	require.NotNil(t, hourlyLimit)
	require.NotNil(t, name)

	require.False(t, action.IsRequiredField(createAction, creatorID))
	require.False(t, action.IsRequiredField(createAction, perHour))
	require.False(t, action.IsRequiredField(createAction, hourlyLimit))
	require.True(t, action.IsRequiredField(createAction, name))
}
