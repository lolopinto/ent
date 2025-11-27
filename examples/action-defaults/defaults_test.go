package actiondefaults

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/require"
)

func TestCreateActionDefaultsMakeFieldsOptional(t *testing.T) {
	eventSchemaPath := filepath.Join("src", "schema", "event.ts")
	code, err := os.ReadFile(eventSchemaPath)
	require.NoError(t, err)

	actionInfo := testhelper.ParseActionInfoForTest(
		t,
		map[string]string{
			"event.ts": testhelper.GetCodeWithSchema(string(code)),
		},
		"Event",
	)

	createAction := actionInfo.GetByName("CreateEventAction")
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
