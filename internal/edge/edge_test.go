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
		EdgeConst: "AccountToFoldersEdge",
		commonEdgeInfo: getCommonEdgeInfo(
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
		EdgeConst: "AccountToFriendsEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Friends",
			schemaparser.GetEntConfigFromName("account"),
		),
		Symmetric: true,
		TableName: "account_friends_edges",
	}

	testAssocEdge(t, edge, expectedAssocEdge)

	// singular version of edge
	assert.Equal(t, "Friend", edge.Singular())
}

func TestUniqueAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "event")
	edge := edgeInfo.GetAssociationEdgeByName("Creator")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst: "EventToCreatorEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Creator",
			schemaparser.GetEntConfigFromName("account"),
		),
		Unique:    true,
		TableName: "account_creator_edges",
	}

	testAssocEdge(t, edge, expectedAssocEdge)

	// singular version is same as plural when edge is singular
	assert.Equal(t, "Creator", edge.Singular())
}

func TestInverseAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "folder")
	edge := edgeInfo.GetAssociationEdgeByName("Todos")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst: "FolderToTodosEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Todos",
			schemaparser.GetEntConfigFromName("todo"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "TodoToFoldersEdge",
			commonEdgeInfo: getCommonEdgeInfo(
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

	if len(inverseEdgeInfo.Associations) != 0 {
		t.Errorf("expected no associations since nothing is defined for Todo")
	}

	edge.AddInverseEdge(inverseEdgeInfo)
	if len(inverseEdgeInfo.Associations) != 1 {
		t.Errorf("expected 1 association since edge.AddInverseEdge was called")
	}
	edge2 := inverseEdgeInfo.GetAssociationEdgeByName("Folders")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst: "TodoToFoldersEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Folders",
			schemaparser.GetEntConfigFromName("folder"),
		),
		IsInverseEdge: true,
		TableName:     "folder_tods_edges",
	}

	testAssocEdge(t, edge2, expectedAssocEdge)
}

func TestEdgeGroup(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")

	friendRequestsEdge := edgeInfo.GetAssociationEdgeByName("FriendRequests")
	friendsEdge := edgeInfo.GetAssociationEdgeByName("Friends")

	expectedFriendRequestsEdge := &AssociationEdge{
		EdgeConst: "AccountToFriendRequestsEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"FriendRequests",
			schemaparser.GetEntConfigFromName("account"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "AccountToFriendRequestsReceivedEdge",
			commonEdgeInfo: getCommonEdgeInfo(
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
		EdgeConst: "EventToInvitedEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Invited",
			schemaparser.GetEntConfigFromName("account"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "AccountToInvitedEventsEdge",
			commonEdgeInfo: getCommonEdgeInfo(
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
	if edge.GetEdgeName() != expectedAssocEdge.EdgeName {
		t.Errorf(
			"name of edge was not as expected, expected %s, got %s instead",
			expectedAssocEdge.EdgeName,
			edge.EdgeName,
		)
	}

	edgeName := edge.GetEdgeName()

	if edge.EdgeConst != expectedAssocEdge.EdgeConst {
		t.Errorf(
			"edge const of edge %s was not as expected, expected %s, got %s instead",
			edgeName,
			expectedAssocEdge.EdgeConst,
			edge.EdgeConst,
		)
	}

	if edge.Symmetric != expectedAssocEdge.Symmetric {
		t.Errorf("assoc edge with name %s symmetric value was not as expected", edgeName)
	}

	if edge.Unique != expectedAssocEdge.Unique {
		t.Errorf("assoc edge with name %s unique value was not as expected", edgeName)
	}

	if edge.IsInverseEdge != expectedAssocEdge.IsInverseEdge {
		t.Errorf(
			"is inverse edge flag for assoc edge with name %s was not as expected, expected %v, got %v instead",
			edgeName,
			expectedAssocEdge.IsInverseEdge,
			edge.IsInverseEdge,
		)
	}

	testInverseAssociationEdge(t, edgeName, edge, expectedAssocEdge)

	testEdgeActions(t, edgeName, edge.EdgeActions, expectedAssocEdge.EdgeActions)

	expectedPackageName := expectedAssocEdge.entConfig.PackageName
	expectedConfigName := expectedAssocEdge.entConfig.ConfigName
	testEntConfig(t, edge.entConfig, expectedPackageName, expectedConfigName)

	testNodeInfo(t, edge.NodeInfo, expectedAssocEdge.NodeInfo.Node)
}

func testInverseAssociationEdge(t *testing.T, edgeName string, edge, expectedAssocEdge *AssociationEdge) {
	inverseEdge := edge.InverseEdge
	expectedInverseEdge := expectedAssocEdge.InverseEdge

	if expectedInverseEdge == nil && inverseEdge != nil {
		t.Errorf("expected inverse edge with edge name %s to be nil and it was not nil", edgeName)
		return
	}

	if expectedInverseEdge != nil && inverseEdge == nil {
		t.Errorf("expected inverse edge with edge name %s to be non-nil and it was nil", edgeName)
		return
	}

	if expectedInverseEdge == nil && inverseEdge == nil {
		return
	}

	if inverseEdge.GetEdgeName() != expectedInverseEdge.EdgeName {
		t.Errorf(
			"name of inverse edge for edge %s was not as expected, expected %s, got %s instead",
			edgeName,
			expectedInverseEdge.EdgeName,
			inverseEdge.EdgeName,
		)
	}

	if inverseEdge.EdgeConst != expectedInverseEdge.EdgeConst {
		t.Errorf(
			"edge const of inverse edge %s was not as expected, expected %s, got %s instead",
			edgeName,
			inverseEdge.EdgeConst,
			expectedInverseEdge.EdgeConst,
		)
	}

	expectedPackageName := inverseEdge.entConfig.PackageName
	expectedConfigName := inverseEdge.entConfig.ConfigName
	testEntConfig(t, inverseEdge.entConfig, expectedPackageName, expectedConfigName)

	testNodeInfo(t, inverseEdge.NodeInfo, expectedInverseEdge.NodeInfo.Node)
}

func testEdgeActions(t *testing.T, edgeName string, edgeActions, expectedEdgeActions []*EdgeAction) {
	assert.Equal(t, len(expectedEdgeActions), len(edgeActions))

	// let's assume we go through them in order and don't need to sort.
	for idx, expectedEdgeAction := range expectedEdgeActions {
		edgeAction := edgeActions[idx]

		if expectedEdgeAction == nil && edgeAction != nil {
			t.Errorf("expected edge action with edge name %s to be nil and it was not nil", edgeName)
			continue
		}

		if expectedEdgeAction != nil && edgeAction == nil {
			t.Errorf("expected edge action with edge name %s to be non-nil and it was nil", edgeName)
			continue
		}

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
	if len(edgeInfo.FieldEdges) != 0 {
		t.Errorf("expected %d field edges. got %d instead", 0, len(edgeInfo.FieldEdges))
	}

	// foreign keys are never passed in. they are generated in node_map
	if len(edgeInfo.ForeignKeys) != 0 {
		t.Errorf("expected %d foreign key edges. got %d instead", 0, len(edgeInfo.ForeignKeys))
	}

	if len(edgeInfo.Associations) != expAssocs {
		t.Errorf("expected %d association edges. got %d instead", expAssocs, len(edgeInfo.Associations))
	}
}

func testEntConfig(t *testing.T, entConfig schemaparser.EntConfigInfo, expectedPackageName, expectedConfigName string) {
	// TODO PackageName is useless and we should fix it/remove it in this instance
	if entConfig.PackageName != expectedPackageName {
		t.Errorf(
			"package name for ent config was not as expected. expected %s, got %s instead",
			expectedPackageName,
			entConfig.PackageName,
		)
	}
	if entConfig.ConfigName != expectedConfigName {
		t.Errorf(
			"config name for ent config was not as expected. expected %s, got %s instead",
			expectedConfigName,
			entConfig.ConfigName,
		)
	}
}

func testNodeInfo(t *testing.T, nodeInfo nodeinfo.NodeInfo, expectedNodename string) {
	if nodeInfo.Node != expectedNodename {
		t.Errorf(
			"node info for ent config was not as expected, expected %s, got %s instead",
			expectedNodename,
			nodeInfo.Node,
		)
	}
}

func testAssocEdgeGroup(t *testing.T, edgeGroup, expectedAssocEdgeGroup *AssociationEdgeGroup, actionEdges []string) {
	if edgeGroup.GroupName != expectedAssocEdgeGroup.GroupName {
		t.Errorf(
			"group name of edge group was not as expected, expected %s, got %s instead",
			expectedAssocEdgeGroup.GroupName,
			edgeGroup.GroupName,
		)
	}

	if edgeGroup.GroupStatusName != expectedAssocEdgeGroup.GroupStatusName {
		t.Errorf(
			"group status name of edge group was not as expected, expected %s, got %s instead",
			expectedAssocEdgeGroup.GroupStatusName,
			edgeGroup.GroupStatusName,
		)
	}

	if edgeGroup.ConstType != expectedAssocEdgeGroup.ConstType {
		t.Errorf(
			"const type of edge group was not as expected, expected %s, got %s instead",
			expectedAssocEdgeGroup.ConstType,
			edgeGroup.ConstType,
		)
	}

	if len(edgeGroup.Edges) != len(expectedAssocEdgeGroup.Edges) {
		t.Errorf(
			"number of edges for edge group was not as expected, expected %d, got %d instead",
			len(expectedAssocEdgeGroup.Edges),
			len(edgeGroup.Edges),
		)
	}

	for edgeName, expectedAssocEdge := range expectedAssocEdgeGroup.Edges {
		assocEdge := edgeGroup.Edges[edgeName]

		if assocEdge == nil {
			t.Errorf(
				"expected an assoc edge of name %s to exist. it didn't",
				edgeName,
			)
		}
		testAssocEdge(t, assocEdge, expectedAssocEdge)

		// confirm that edgeGroup.UseEdgeInStatusAction() is correct.
		// sort.SearchStrings() returns the index we should insert into if not found, not -1 so checking for that...
		idx := sort.SearchStrings(actionEdges, edgeName)
		assert.Equal(t, edgeGroup.UseEdgeInStatusAction(edgeName), idx != len(actionEdges), edgeName)
	}

	testEdgeActions(t, edgeGroup.GroupName, edgeGroup.EdgeActions, expectedAssocEdgeGroup.EdgeActions)
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
				return NewEdgeInfo()
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
