package action

import (
	"sync"
	"testing"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/edge"
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

func TestEdgeActions(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetAssociationEdgeByName("Folders")
	assert.NotNil(t, edge)
	// 2 actions!
	assert.Equal(t, len(edge.EdgeActions), 2)

	actionInfo := getTestActionInfo(t, "account")

	var testCases = []struct {
		actionName       string
		exposeToGraphQL  bool
		graphQLName      string
		actionMethodName string
	}{
		{
			// these 2 are custom
			"AccountAddFolderAction",
			true,
			"accountFolderAdd",
			"AccountAddFolder",
		},
		{
			// these 2 are defaults
			"RemoveFolderAction",
			true,
			"accountRemoveFolder",
			"RemoveFolder",
		},
	}

	for _, tt := range testCases {
		action := actionInfo.GetByName(tt.actionName)

		assert.NotNil(
			t,
			action,
			"expected there to be an action with name %s ",
			tt.actionName,
		)

		actionFromGraphQL := actionInfo.GetByGraphQLName(tt.graphQLName)
		if tt.exposeToGraphQL {
			assert.NotNil(
				t,
				actionFromGraphQL,
				"expected there to be an action with graphql name %s ",
				tt.graphQLName,
			)
		} else {
			assert.Nil(
				t,
				actionFromGraphQL,
				"expected there to not be an action with graphql name %s ",
				tt.graphQLName,
			)
		}

		assert.Equal(
			t,
			tt.actionMethodName,
			GetActionMethodName(action),
		)
	}
}

func TestEdgeGroupActions(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")
	assert.NotNil(t, edgeGroup)

	assert.Equal(t, len(edgeGroup.EdgeActions), 1)

	actionInfo := getTestActionInfo(t, "account")

	assert.NotNil(
		t,
		actionInfo.GetByName("AccountFriendshipStatusAction"),
		"expected there to be an action with AccountFriendshipStatusAction",
	)

	assert.NotNil(
		t,
		actionInfo.GetByGraphQLName("accountSetFriendshipStatus"),
		"expected there to be an action with graphql name accountSetFriendshipStatus",
	)
}

func getParsedConfig(t *testing.T) *parsehelper.FileConfigData {
	return parsehelper.ParseFilesForTest(t, parsehelper.ParseFuncs(parsehelper.ParseStruct|parsehelper.ParseEdges|parsehelper.ParseActions))
}

// this is slightly confusing but we have multi-caching going on here
// similar to field_test, edge_test, we're caching the results of parsing fields, edges, actions into separate
// instances of RunOnce.
// They all use getParsedConfig() which has its own caching based on flags passed above.
var rF *testsync.RunOnce
var rA *testsync.RunOnce
var rE *testsync.RunOnce

var once sync.Once

func initSyncs() {
	once.Do(func() {
		rF = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)
			fieldInfo := field.GetFieldInfoForStruct(data.StructMap[configName], data.Info)
			assert.NotNil(t, fieldInfo, "invalid fieldInfo retrieved")
			return fieldInfo
		})

		rE = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)
			fn := data.GetEdgesFn(configName)
			assert.NotNil(t, fn, "GetEdges fn was unexpectedly nil")
			edgeInfo := edge.ParseEdgesFunc(configName, fn)
			assert.NotNil(t, edgeInfo, "invalid edgeInfo retrieved")
			return edgeInfo
		})

		rA = testsync.NewRunOnce(func(t *testing.T, configName string) interface{} {
			data := getParsedConfig(t)

			fn := data.GetActionsFn(configName)
			assert.NotNil(t, fn, "GetActions fn was unexpectedly nil")

			// TODO need to fix this dissonance...
			fieldInfo := getTestFieldInfo(t, strcase.ToCamel(configName)+"Config")
			edgeInfo := getTestEdgeInfo(t, configName)
			actionInfo := ParseActions("Account", fn, fieldInfo, edgeInfo)
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

func getEdgeInfoMap() *testsync.RunOnce {
	initSyncs()
	return rE
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

func getTestEdgeInfo(t *testing.T, configName string) *edge.EdgeInfo {
	return getEdgeInfoMap().Get(t, configName).(*edge.EdgeInfo)
}

func getTestFieldByName(t *testing.T, configName string, fieldName string) *field.Field {
	fieldInfo := getTestFieldInfo(t, configName)
	return fieldInfo.GetFieldByName(fieldName)
}
