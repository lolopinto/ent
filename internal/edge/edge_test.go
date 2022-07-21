package edge

import (
	"sort"
	"sync"
	"testing"

	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schemaparser"
	testsync "github.com/lolopinto/ent/internal/testingutils/sync"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEdgeInfo(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")

	testEdgeInfo(t, edgeInfo, 4)

	edgeInfo = getTestEdgeInfo(t, "todo")

	testEdgeInfo(t, edgeInfo, 0)

	edgeInfo = getTestEdgeInfo(t, "folder")

	testEdgeInfo(t, edgeInfo, 1)
}

func TestAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetAssociationEdgeByName("Folders")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst:   "AccountToFoldersEdge",
		TsEdgeConst: "AccountToFolders",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"Folders",
			schemaparser.GetEntConfigFromName("folder"),
		),
		TableName: "account_folders_edges",
		EdgeActions: []*EdgeAction{
			{
				Action:            "ent.AddEdgeAction",
				CustomActionName:  "AccountAddFolderAction",
				CustomGraphQLName: "accountFolderAdd",
				ExposeToGraphQL:   true,
			},
			{
				Action:          "ent.RemoveEdgeAction",
				ExposeToGraphQL: true,
			},
		},
	}

	testAssocEdge(t, edge, expectedAssocEdge)

	// singular version of edge
	assert.Equal(t, "Folder", edge.Singular())
}

func TestSymmetricAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetAssociationEdgeByName("Friends")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst:   "AccountToFriendsEdge",
		TsEdgeConst: "AccountToFriends",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"Friends",
			schemaparser.GetEntConfigFromName("account"),
		),
		Symmetric: true,
		TableName: "account_friendships_edges",
	}

	testAssocEdge(t, edge, expectedAssocEdge)

	// singular version of edge
	assert.Equal(t, "Friend", edge.Singular())
}

func TestUniqueAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "event")
	edge := edgeInfo.GetAssociationEdgeByName("Creator")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst:   "EventToCreatorEdge",
		TsEdgeConst: "EventToCreator",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"Creator",
			schemaparser.GetEntConfigFromName("account"),
		),
		Unique:    true,
		TableName: "event_creator_edges",
	}

	testAssocEdge(t, edge, expectedAssocEdge)

	// singular version is same as plural when edge is singular
	assert.Equal(t, "Creator", edge.Singular())
}

func TestInverseAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "folder")
	edge := edgeInfo.GetAssociationEdgeByName("Todos")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst:   "FolderToTodosEdge",
		TsEdgeConst: "FolderToTodos",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"Todos",
			schemaparser.GetEntConfigFromName("todo"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "TodoToFoldersEdge",
			commonEdgeInfo: getCommonEdgeInfoForTest(
				"Folders",
				schemaparser.GetEntConfigFromName("folder"),
			),
		},
		TableName: "folder_todos_edges",
	}

	testAssocEdge(t, edge, expectedAssocEdge)
}

func TestAddingInverseEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "folder")
	edge := edgeInfo.GetAssociationEdgeByName("Todos")

	inverseEdgeInfo := getTestEdgeInfo(t, "todo")

	require.Len(t, inverseEdgeInfo.Associations, 0, "expected no associations since nothing is defined for Todo")

	err := edge.AddInverseEdge(inverseEdgeInfo)
	require.Nil(t, err)
	require.Len(t, inverseEdgeInfo.Associations, 1, "expected 1 association since edge.AddInverseEdge was called")
	edge2 := inverseEdgeInfo.GetAssociationEdgeByName("Folders")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst:   "TodoToFoldersEdge",
		TsEdgeConst: "TodoToFolders",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"Folders",
			schemaparser.GetEntConfigFromName("folder"),
		),
		IsInverseEdge: true,
		TableName:     "folder_todos_edges",
	}

	testAssocEdge(t, edge2, expectedAssocEdge)
}

func TestEdgeGroup(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")

	friendRequestsEdge := edgeInfo.GetAssociationEdgeByName("FriendRequests")
	friendsEdge := edgeInfo.GetAssociationEdgeByName("Friends")

	expectedFriendRequestsEdge := &AssociationEdge{
		EdgeConst:   "AccountToFriendRequestsEdge",
		TsEdgeConst: "AccountToFriendRequests",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"FriendRequests",
			schemaparser.GetEntConfigFromName("account"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "AccountToFriendRequestsReceivedEdge",
			commonEdgeInfo: getCommonEdgeInfoForTest(
				"FriendRequestsReceived",
				schemaparser.GetEntConfigFromName("account"),
			),
		},
		TableName: "account_friendships_edges",
	}

	testAssocEdge(t, friendRequestsEdge, expectedFriendRequestsEdge)

	expectedAssocEdgeGroup := &AssociationEdgeGroup{
		GroupName:       "Friendships",
		GroupStatusName: "FriendshipStatus",
		ConstType:       "AccountFriendshipStatus",
		Edges: map[string]*AssociationEdge{
			"FriendRequests": friendRequestsEdge,
			"Friends":        friendsEdge,
		},
		EdgeActions: []*EdgeAction{
			{
				Action:            "ent.AddEdgeAction",
				CustomActionName:  "AccountFriendshipStatusAction",
				CustomGraphQLName: "accountSetFriendshipStatus",
				ExposeToGraphQL:   true,
			},
		},
	}

	testAssocEdgeGroup(
		t,
		edgeGroup,
		expectedAssocEdgeGroup,
		[]string{"FriendRequests", "Friends"},
	)
}

func TestEdgeGroupWithCustomActionEdges(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "event")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("RsvpStatus")

	invitedEdge := edgeInfo.GetAssociationEdgeByName("Invited")
	attendingEdge := edgeInfo.GetAssociationEdgeByName("Attending")
	declinedEdge := edgeInfo.GetAssociationEdgeByName("Declined")

	expectedInvitedEdge := &AssociationEdge{
		EdgeConst:   "EventToInvitedEdge",
		TsEdgeConst: "EventToInvited",
		commonEdgeInfo: getCommonEdgeInfoForTest(
			"Invited",
			schemaparser.GetEntConfigFromName("account"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "AccountToInvitedEventsEdge",
			commonEdgeInfo: getCommonEdgeInfoForTest(
				"InvitedEvents",
				schemaparser.GetEntConfigFromName("event"),
			),
		},
		// custom table name!
		TableName: "event_rsvp_edges",
	}

	testAssocEdge(t, invitedEdge, expectedInvitedEdge)

	expectedAssocEdgeGroup := &AssociationEdgeGroup{
		GroupName:       "Rsvps",
		GroupStatusName: "RsvpStatus",
		ConstType:       "EventRsvpStatus",
		Edges: map[string]*AssociationEdge{
			"Invited":   invitedEdge,
			"Attending": attendingEdge,
			"Declined":  declinedEdge,
		},
		EdgeActions: []*EdgeAction{
			{
				Action:            "ent.EdgeGroupAction",
				ExposeToGraphQL:   true,
				CustomActionName:  "EventRsvpAction",
				CustomGraphQLName: "eventRSVP",
			},
		},
	}

	testAssocEdgeGroup(
		t,
		edgeGroup,
		expectedAssocEdgeGroup,
		[]string{
			"Attending",
			"Declined",
		})
}

func testAssocEdge(t *testing.T, edge, expectedAssocEdge *AssociationEdge) {
	require.NotNil(t, edge)
	assert.Equal(
		t,
		expectedAssocEdge.EdgeName,
		edge.GetEdgeName(),
		"name of edge was not as expected, expected %s, got %s instead",
		expectedAssocEdge.EdgeName,
		edge.EdgeName,
	)

	edgeName := edge.GetEdgeName()

	assert.Equal(
		t,
		expectedAssocEdge.EdgeConst,
		edge.EdgeConst,
		"edge const of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.EdgeConst,
		edge.EdgeConst,
	)

	assert.Equal(
		t,
		expectedAssocEdge.TsEdgeConst,
		edge.TsEdgeConst,
		"TS edge const of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.TsEdgeConst,
		edge.TsEdgeConst,
	)

	assert.Equal(
		t,
		expectedAssocEdge.TableName,
		edge.TableName,
		"table name of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.TableName,
		edge.TableName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.PatternName,
		edge.PatternName,
		"pattern name of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.PatternName,
		edge.PatternName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.overridenQueryName,
		edge.overridenQueryName,
		"overriden query name field of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.overridenQueryName,
		edge.overridenQueryName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.overridenEdgeName,
		edge.overridenEdgeName,
		"override edge name field of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.overridenEdgeName,
		edge.overridenEdgeName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.overridenGraphQLName,
		edge.overridenGraphQLName,
		"overriden graphql name field of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.overridenGraphQLName,
		edge.overridenGraphQLName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.Symmetric,
		edge.Symmetric,
		"assoc edge with name %s symmetric value was not as expected",
		edgeName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.Unique,
		edge.Unique,
		"assoc edge with name %s unique value was not as expected",
		edgeName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.IsInverseEdge,
		edge.IsInverseEdge,
		"is inverse edge flag for assoc edge with name %s was not as expected, expected %v, got %v instead",
		edgeName,
		expectedAssocEdge.IsInverseEdge,
		edge.IsInverseEdge,
	)

	testInverseAssociationEdge(t, edgeName, edge, expectedAssocEdge)

	testEdgeActions(t, edgeName, edge.EdgeActions, expectedAssocEdge.EdgeActions)

	testEntConfig(t, edge.entConfig, expectedAssocEdge.entConfig)

	testNodeInfo(t, edge.NodeInfo, expectedAssocEdge.NodeInfo.Node)
}

func testInverseAssociationEdge(t *testing.T, edgeName string, edge, expectedAssocEdge *AssociationEdge) {
	inverseEdge := edge.InverseEdge
	expectedInverseEdge := expectedAssocEdge.InverseEdge

	require.False(
		t,
		expectedInverseEdge == nil && inverseEdge != nil,
		"expected inverse edge with edge name %s to be nil and it was not nil",
		edgeName,
	)

	require.False(
		t,
		expectedInverseEdge != nil && inverseEdge == nil,
		"expected inverse edge with edge name %s to be non-nil and it was nil",
		edgeName,
	)

	if expectedInverseEdge == nil && inverseEdge == nil {
		return
	}

	assert.Equal(
		t,
		expectedInverseEdge.EdgeName,
		inverseEdge.GetEdgeName(),
		"name of inverse edge for edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedInverseEdge.EdgeName,
		inverseEdge.EdgeName,
	)

	assert.Equal(
		t,
		expectedInverseEdge.EdgeConst,
		inverseEdge.EdgeConst,
		"edge const of inverse edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		inverseEdge.EdgeConst,
		expectedInverseEdge.EdgeConst,
	)

	testEntConfig(t, inverseEdge.entConfig, inverseEdge.entConfig)

	testNodeInfo(t, inverseEdge.NodeInfo, expectedInverseEdge.NodeInfo.Node)
}

func testEdgeActions(t *testing.T, edgeName string, edgeActions, expectedEdgeActions []*EdgeAction) {
	assert.Equal(t, len(expectedEdgeActions), len(edgeActions))

	// let's assume we go through them in order and don't need to sort.
	for idx, expectedEdgeAction := range expectedEdgeActions {
		edgeAction := edgeActions[idx]

		require.False(
			t,
			expectedEdgeAction == nil && edgeAction != nil,
			"expected edge action with edge name %s to be nil and it was not nil",
			edgeName,
		)

		require.False(
			t,
			expectedEdgeAction != nil && edgeAction == nil,
			"expected edge action with edge name %s to be non-nil and it was nil",
			edgeName,
		)

		if expectedEdgeAction == nil && edgeAction == nil {
			continue
		}

		assert.Equal(
			t,
			expectedEdgeAction.Action,
			edgeAction.Action,
			"action for edge action with edge name %s was not as expected, expected %s, got %s",
			edgeName,
			expectedEdgeAction.Action,
			edgeAction.Action,
		)

		assert.Equal(
			t,
			expectedEdgeAction.CustomActionName,
			edgeAction.CustomActionName,
			"custom action for edge action with edge name %s was not as expected, expected %s, got %s",
			edgeName,
			expectedEdgeAction.CustomActionName,
			edgeAction.CustomActionName,
		)

		assert.Equal(
			t,
			expectedEdgeAction.CustomGraphQLName,
			edgeAction.CustomGraphQLName,
			"custom graphql name for edge action with edge name %s was not as expected, expected %s, got %s",
			edgeName,
			expectedEdgeAction.CustomGraphQLName,
			edgeAction.CustomGraphQLName,
		)

		assert.Equal(
			t,
			expectedEdgeAction.ExposeToGraphQL,
			edgeAction.ExposeToGraphQL,
			"expose to graphql value for edge action with edge name %s was not as expected. expected %v, got %v",
			edgeName,
			expectedEdgeAction.ExposeToGraphQL,
			edgeAction.ExposeToGraphQL,
		)
	}
}

func testEdgeInfo(t *testing.T, edgeInfo *EdgeInfo, expAssocs int) {
	// field edges are never passed in. they are generated in node_map
	assert.Len(t,
		edgeInfo.FieldEdges,
		0,
		"expected %d field edges. got %d instead", 0, len(edgeInfo.FieldEdges),
	)

	// foreign keys are never passed in. they are generated in node_map
	assert.Len(
		t,
		edgeInfo.DestinationEdges,
		0,
		"expected %d foreign key edges. got %d instead",
		0,
		len(edgeInfo.DestinationEdges),
	)

	assert.Len(
		t,
		edgeInfo.Associations,
		expAssocs,
		"expected %d association edges. got %d instead",
		expAssocs,
		len(edgeInfo.Associations),
	)
}

func testEntConfig(t *testing.T, entConfig, expectedEntConfig *schemaparser.EntConfigInfo) {
	// apparently, this is how it should work?
	if entConfig == nil {
		require.Nil(t, expectedEntConfig)
		return
	}
	expectedPackageName := expectedEntConfig.PackageName
	expectedConfigName := expectedEntConfig.ConfigName

	// TODO PackageName is useless and we should fix it/remove it in this instance
	assert.Equal(
		t,
		expectedPackageName,
		entConfig.PackageName,
		"package name for ent config was not as expected. expected %s, got %s instead",
		expectedPackageName,
		entConfig.PackageName,
	)

	assert.Equal(
		t,
		expectedConfigName,
		entConfig.ConfigName,
		"config name for ent config was not as expected. expected %s, got %s instead",
		expectedConfigName,
		entConfig.ConfigName,
	)
}

func testNodeInfo(t *testing.T, nodeInfo nodeinfo.NodeInfo, expectedNodename string) {
	assert.Equal(
		t,
		expectedNodename,
		nodeInfo.Node,
		"node info for ent config was not as expected, expected %s, got %s instead",
		expectedNodename,
		nodeInfo.Node,
	)
}

func testAssocEdgeGroup(t *testing.T, edgeGroup, expectedAssocEdgeGroup *AssociationEdgeGroup, actionEdges []string) {
	assert.Equal(
		t,
		expectedAssocEdgeGroup.GroupName,
		edgeGroup.GroupName,
		"group name of edge group was not as expected, expected %s, got %s instead",
		expectedAssocEdgeGroup.GroupName,
		edgeGroup.GroupName,
	)

	assert.Equal(
		t,
		expectedAssocEdgeGroup.GroupStatusName,
		edgeGroup.GroupStatusName,
		"group status name of edge group was not as expected, expected %s, got %s instead",
		expectedAssocEdgeGroup.GroupStatusName,
		edgeGroup.GroupStatusName,
	)

	assert.Equal(
		t,
		expectedAssocEdgeGroup.ConstType,
		edgeGroup.ConstType,
		"const type of edge group was not as expected, expected %s, got %s instead",
		expectedAssocEdgeGroup.ConstType,
		edgeGroup.ConstType,
	)

	assert.Len(
		t,
		edgeGroup.Edges,
		len(expectedAssocEdgeGroup.Edges),
		"number of edges for edge group was not as expected, expected %d, got %d instead",
		len(expectedAssocEdgeGroup.Edges),
		len(edgeGroup.Edges),
	)

	for edgeName, expectedAssocEdge := range expectedAssocEdgeGroup.Edges {
		assocEdge := edgeGroup.Edges[edgeName]

		require.NotNil(
			t,
			assocEdge,
			"expected an assoc edge of name %s to exist. it didn't",
			edgeName,
		)
		testAssocEdge(t, assocEdge, expectedAssocEdge)

		// confirm that edgeGroup.UseEdgeInStatusAction() is correct.
		// sort.SearchStrings() returns the index we should insert into if not found, not -1 so checking for that...
		idx := sort.SearchStrings(actionEdges, edgeName)
		assert.Equal(t, edgeGroup.UseEdgeInStatusAction(edgeName), idx != len(actionEdges), edgeName)
	}

	testEdgeActions(t, edgeGroup.GroupName, edgeGroup.EdgeActions, expectedAssocEdgeGroup.EdgeActions)
}

func testForeignKeyEdge(t *testing.T, edge, expectedEdge *ForeignKeyEdge) {
	assert.Equal(t, expectedEdge.SourceNodeName, edge.SourceNodeName)

	testDestinationEdge(t, expectedEdge.destinationEdge, edge.destinationEdge)
}

func testIndexedEdge(t *testing.T, edge, expectedEdge *IndexedEdge) {
	assert.Equal(t, expectedEdge.SourceNodeName, edge.SourceNodeName)
	assert.Equal(t, expectedEdge.tsEdgeName, edge.tsEdgeName)
	assert.Equal(t, expectedEdge.foreignNode, edge.foreignNode)

	testDestinationEdge(t, expectedEdge.destinationEdge, edge.destinationEdge)
}

func testDestinationEdge(t *testing.T, edge, expectedEdge destinationEdge) {
	assert.Equal(t, expectedEdge.quotedDbColName, edge.quotedDbColName)

	assert.Equal(t, expectedEdge.unique, edge.unique)

	testEntConfig(t, edge.entConfig, expectedEdge.entConfig)

	testNodeInfo(t, edge.NodeInfo, expectedEdge.NodeInfo.Node)
}

func testFieldEdge(t *testing.T, edge, expectedEdge *FieldEdge) {
	assert.Equal(t, expectedEdge.FieldName, edge.FieldName)

	assert.Equal(t, expectedEdge.TSFieldName, edge.TSFieldName)

	assert.Equal(t, expectedEdge.Nullable, edge.Nullable)

	if expectedEdge.InverseEdge == nil {
		require.Nil(t, edge.InverseEdge)
	} else {
		assert.Equal(t, expectedEdge.InverseEdge.EdgeConstName, edge.InverseEdge.EdgeConstName)
		assert.Equal(t, expectedEdge.InverseEdge.HideFromGraphQL, edge.InverseEdge.HideFromGraphQL)
		assert.Equal(t, expectedEdge.InverseEdge.Name, edge.InverseEdge.Name)
		assert.Equal(t, expectedEdge.InverseEdge.TableName, edge.InverseEdge.TableName)
	}

	if expectedEdge.Polymorphic == nil {
		require.Nil(t, edge.Polymorphic)
	} else {
		assert.Equal(t, expectedEdge.Polymorphic.DisableBuilderType, edge.Polymorphic.DisableBuilderType)
		assert.Equal(t, expectedEdge.Polymorphic.HideFromInverseGraphQL, edge.Polymorphic.HideFromInverseGraphQL)
		assert.Equal(t, expectedEdge.Polymorphic.NodeTypeField, edge.Polymorphic.NodeTypeField)
		assert.Equal(t, expectedEdge.Polymorphic.Types, edge.Polymorphic.Types)
		assert.Equal(t, expectedEdge.Polymorphic.Unique, edge.Polymorphic.Unique)
	}

	assert.Equal(t, expectedEdge.GetTSGraphQLTypeImports(), edge.GetTSGraphQLTypeImports())

	testEntConfig(t, edge.entConfig, expectedEdge.entConfig)

	testNodeInfo(t, edge.NodeInfo, expectedEdge.NodeInfo.Node)

}

var r *testsync.RunOnce
var once sync.Once

func getEdgeInfoMap() *testsync.RunOnce {
	once.Do(func() {
		r = testsync.NewRunOnce(func(t *testing.T, packageName string) interface{} {
			data := parsehelper.ParseFilesForTest(t, parsehelper.ParseFuncs(parsehelper.ParseEdges))
			fn := data.GetEdgesFn(packageName)

			// allowed to be nil
			if fn == nil {
				return NewEdgeInfo(packageName)
			}

			edgeInfo, err := ParseEdgesFunc(packageName, fn)
			require.Nil(t, err)
			assert.NotNil(t, edgeInfo, "invalid edgeInfo retrieved")
			return edgeInfo
		})
	})
	return r
}

func getTestEdgeInfo(t *testing.T, packageName string) *EdgeInfo {
	return getEdgeInfoMap().Get(t, packageName).(*EdgeInfo)
}
