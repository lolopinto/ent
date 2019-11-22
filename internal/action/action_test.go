package action

import (
	"sync"
	"testing"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/parsehelper"
	testsync "github.com/lolopinto/ent/internal/testingutils/sync"

	"github.com/stretchr/testify/assert"
)

func TestRequiredField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastName")
	f2 := getTestFieldByName(t, "AccountConfig", "Bio")

	action := getTestActionByType(t, "account", "ent.CreateAction")
	action2 := getTestActionByType(t, "account", "ent.EditAction")

	assert.True(t, IsRequiredField(action, f), "LastName field not required in CreateAction as expected")
	assert.False(t, IsRequiredField(action2, f), "LastName field required in EditAction not expected")
	assert.False(t, IsRequiredField(action, f2), "Bio field required in CreateAction not expected")
	assert.False(t, IsRequiredField(action2, f2), "Bio field required in EditAction not expected")
}

func getParsedConfig(t *testing.T) *parsehelper.FileConfigData {
	return parsehelper.ParseFilesForTest(t, parsehelper.ParseFuncs(parsehelper.ParseStruct|parsehelper.ParseActions))
}

// this is slightly confusing but we have multi-caching going on here
// similar to field_test, edge_test, we're caching the results of parsing fields/actions into separate
// instance of RunOnce.
// They both use getParsedConfig() which has its own caching based on flags passed above.
var rF *testsync.RunOnce
var rA *testsync.RunOnce

var once sync.Once

func initSyncs() {
	once.Do(func() {
		rF = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)
			fieldInfo := field.GetFieldInfoForStruct(data.StructMap[configName], data.Fset, data.Info)
			assert.NotNil(t, fieldInfo, "invalid fieldInfo retrieved")
			return fieldInfo
		})

		rA = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)

			fn := data.GetActionsFn(configName)
			assert.NotNil(t, fn, "GetActions fn was unexpectedly nil")

			// TODO need to fix this dissonance...
			fieldInfo := getTestFieldInfo(t, strcase.ToCamel(configName)+"Config")
			actionInfo := ParseActions("Account", fn, fieldInfo, nil)
			assert.NotNil(t, actionInfo, "invalid actionInfo retrieved")
			return actionInfo
		})
	})
}

func getFieldInfoMap() *testsync.RunOnce {
	initSyncs()
	return rF
}

func getActionInfoMap() *testsync.RunOnce {
	initSyncs()
	return rA
}

func getTestActionInfo(t *testing.T, configName string) *ActionInfo {
	return getActionInfoMap().Get(t, configName).(*ActionInfo)
}

func getTestActionByType(t *testing.T, configName string, actionType string) Action {
	name := getActionTypeFromString(actionType).(concreteNodeActionType).getDefaultActionName(configName)
	action := getTestActionInfo(t, configName).GetByName(name)
	assert.NotNil(t, action, "invalid action retrieved")
	return action
}

// copied and modified from field_test.go
func getTestFieldInfo(t *testing.T, configName string) *field.FieldInfo {
	return getFieldInfoMap().Get(t, configName).(*field.FieldInfo)
}

func getTestFieldByName(t *testing.T, configName string, fieldName string) *field.Field {
	fieldInfo := getTestFieldInfo(t, configName)
	return fieldInfo.GetFieldByName(fieldName)
}
