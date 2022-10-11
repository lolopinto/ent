package edge_test

import (
	"sort"
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/testingutils/testmodel"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAssociationEdge(t *testing.T) {
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Account")
	e := edgeInfo.GetAssociationEdgeByName("Folders")

	expectedAssocEdge := (&edge.AssociationEdge{
		EdgeConst:   "AccountToFoldersEdge",
		TsEdgeConst: "AccountToFolders",
		TableName:   "account_folders_edges",
		EdgeActions: []*edge.EdgeAction{
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
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
		"Folders",
		schemaparser.GetEntConfigFromName("folder"),
	))

	testAssocEdge(t, e, expectedAssocEdge)

	// singular version of edge
	assert.Equal(t, "Folder", e.Singular())
}

func TestSymmetricAssociationEdge(t *testing.T) {
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Account")
	e := edgeInfo.GetAssociationEdgeByName("Friends")

	expectedAssocEdge := (&edge.AssociationEdge{
		EdgeConst:   "AccountToFriendsEdge",
		TsEdgeConst: "AccountToFriends",
		Symmetric:   true,
		TableName:   "account_friendships_edges",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
		"Friends",
		schemaparser.GetEntConfigFromName("account"),
	))

	testAssocEdge(t, e, expectedAssocEdge)

	// singular version of edge
	assert.Equal(t, "Friend", e.Singular())
}

func TestUniqueAssociationEdge(t *testing.T) {
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Event")
	e := edgeInfo.GetAssociationEdgeByName("Creator")

	expectedAssocEdge := (&edge.AssociationEdge{
		EdgeConst:   "EventToCreatorEdge",
		TsEdgeConst: "EventToCreator",
		Unique:      true,
		TableName:   "event_creator_edges",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
		"Creator",
		schemaparser.GetEntConfigFromName("account"),
	))

	testAssocEdge(t, e, expectedAssocEdge)

	// singular version is same as plural when edge is singular
	assert.Equal(t, "Creator", e.Singular())
}

func TestInverseAssociationEdge(t *testing.T) {
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Folder")
	e := edgeInfo.GetAssociationEdgeByName("Todos")

	expectedAssocEdge := (&edge.AssociationEdge{
		EdgeConst:   "FolderToTodosEdge",
		TsEdgeConst: "FolderToTodos",

		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "TodoToFoldersEdge",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
			"Folders",
			schemaparser.GetEntConfigFromName("folder"),
		)),
		TableName: "folder_todos_edges",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
		"Todos",
		schemaparser.GetEntConfigFromName("todo"),
	))

	testAssocEdge(t, e, expectedAssocEdge)
}

func TestEdgeGroup(t *testing.T) {
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Account")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")

	friendRequestsEdge := edgeInfo.GetAssociationEdgeByName("FriendRequests")
	friendsEdge := edgeInfo.GetAssociationEdgeByName("Friends")

	expectedFriendRequestsEdge := (&edge.AssociationEdge{
		EdgeConst:   "AccountToFriendRequestsEdge",
		TsEdgeConst: "AccountToFriendRequests",

		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "AccountToFriendRequestsReceivedEdge",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
			"FriendRequestsReceived",
			schemaparser.GetEntConfigFromName("account"),
		)),
		TableName: "account_friendships_edges",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
		"FriendRequests",
		schemaparser.GetEntConfigFromName("account"),
	))

	testAssocEdge(t, friendRequestsEdge, expectedFriendRequestsEdge)

	expectedAssocEdgeGroup := &edge.AssociationEdgeGroup{
		GroupName:       "Friendships",
		GroupStatusName: "FriendshipStatus",
		ConstType:       "AccountFriendshipStatus",
		Edges: map[string]*edge.AssociationEdge{
			"FriendRequests": friendRequestsEdge,
			"Friends":        friendsEdge,
		},
		EdgeActions: []*edge.EdgeAction{
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
	edgeInfo := testmodel.GetEdgeInfoFromSchema(t, "Event")
	edgeGroup := edgeInfo.GetAssociationEdgeGroupByStatusName("RsvpStatus")

	invitedEdge := edgeInfo.GetAssociationEdgeByName("Invited")
	attendingEdge := edgeInfo.GetAssociationEdgeByName("Attending")
	declinedEdge := edgeInfo.GetAssociationEdgeByName("Declined")

	expectedInvitedEdge := (&edge.AssociationEdge{
		EdgeConst:   "EventToInvitedEdge",
		TsEdgeConst: "EventToInvited",

		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "AccountToInvitedEventsEdge",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
			"InvitedEvents",
			schemaparser.GetEntConfigFromName("event"),
		)),
		// custom table name!
		TableName: "event_rsvp_edges",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest(
		"Invited",
		schemaparser.GetEntConfigFromName("account"),
	))

	testAssocEdge(t, invitedEdge, expectedInvitedEdge)

	expectedAssocEdgeGroup := &edge.AssociationEdgeGroup{
		GroupName:       "Rsvps",
		GroupStatusName: "RsvpStatus",
		ConstType:       "EventRsvpStatus",
		Edges: map[string]*edge.AssociationEdge{
			"Invited":   invitedEdge,
			"Attending": attendingEdge,
			"Declined":  declinedEdge,
		},
		EdgeActions: []*edge.EdgeAction{
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

func TestViewerBasedEdgeGroupWithNoNullStates(t *testing.T) {
	group, err := edge.AssocEdgeGroupFromInput(
		&codegenapi.DummyConfig{},
		"User",
		&input.Node{},
		&input.AssocEdgeGroup{
			Name:            "rsvps",
			GroupStatusName: "RsvpStatus",
			ViewerBased:     true,
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Attending",
					SchemaName: "Event",
				},
				{
					Name:       "Declined",
					SchemaName: "Event",
				},
			},
		},
		edge.NewEdgeInfo("User"))

	require.Error(t, err)
	require.Nil(t, group)
	require.Equal(t, err.Error(), "ViewerBased edge group must have NullStates")
}

func TestViewerBasedEdgeGroupWithNullStates(t *testing.T) {
	group, err := edge.AssocEdgeGroupFromInput(
		&codegenapi.DummyConfig{},
		"User",
		&input.Node{},
		&input.AssocEdgeGroup{
			Name:            "rsvps",
			GroupStatusName: "RsvpStatus",
			ViewerBased:     true,
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Attending",
					SchemaName: "Event",
				},
				{
					Name:       "Declined",
					SchemaName: "Event",
				},
			},
			NullStates: []string{"CanRsvp", "CannotRsvp"},
		},
		edge.NewEdgeInfo("User"))

	require.Nil(t, err)
	require.NotNil(t, group)
}

func TestNonViewerBasedEdgeGroupWithNoNullStates(t *testing.T) {
	group, err := edge.AssocEdgeGroupFromInput(
		&codegenapi.DummyConfig{},
		"User",
		&input.Node{},
		&input.AssocEdgeGroup{
			Name:            "rsvps",
			GroupStatusName: "RsvpStatus",
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Attending",
					SchemaName: "Event",
				},
				{
					Name:       "Declined",
					SchemaName: "Event",
				},
			},
		},
		edge.NewEdgeInfo("User"))

	require.Nil(t, err)
	require.NotNil(t, group)
}

func testAssocEdge(t *testing.T, e, expectedAssocEdge *edge.AssociationEdge) {
	require.NotNil(t, e)
	assert.Equal(
		t,
		expectedAssocEdge.EdgeName,
		e.GetEdgeName(),
		"name of edge was not as expected, expected %s, got %s instead",
		expectedAssocEdge.EdgeName,
		e.EdgeName,
	)

	edgeName := e.GetEdgeName()

	assert.Equal(
		t,
		expectedAssocEdge.EdgeConst,
		e.EdgeConst,
		"edge const of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.EdgeConst,
		e.EdgeConst,
	)

	assert.Equal(
		t,
		expectedAssocEdge.TsEdgeConst,
		e.TsEdgeConst,
		"TS edge const of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.TsEdgeConst,
		e.TsEdgeConst,
	)

	assert.Equal(
		t,
		expectedAssocEdge.TableName,
		e.TableName,
		"table name of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.TableName,
		e.TableName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.PatternName,
		e.PatternName,
		"pattern name of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.PatternName,
		e.PatternName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.GetOverridenQueryName(),
		e.GetOverridenQueryName(),
		"overriden query name field of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.GetOverridenQueryName(),
		e.GetOverridenQueryName(),
	)

	assert.Equal(
		t,
		expectedAssocEdge.GetOverridenEdgeName(),
		e.GetOverridenEdgeName(),
		"override edge name field of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.GetOverridenEdgeName(),
		e.GetOverridenEdgeName(),
	)

	assert.Equal(
		t,
		expectedAssocEdge.GetOverridenGraphQLName(),
		e.GetOverridenGraphQLName(),
		"overriden graphql name field of edge %s was not as expected, expected %s, got %s instead",
		edgeName,
		expectedAssocEdge.GetOverridenGraphQLName(),
		e.GetOverridenGraphQLName(),
	)

	assert.Equal(
		t,
		expectedAssocEdge.Symmetric,
		e.Symmetric,
		"assoc edge with name %s symmetric value was not as expected",
		edgeName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.Unique,
		e.Unique,
		"assoc edge with name %s unique value was not as expected",
		edgeName,
	)

	assert.Equal(
		t,
		expectedAssocEdge.IsInverseEdge,
		e.IsInverseEdge,
		"is inverse edge flag for assoc edge with name %s was not as expected, expected %v, got %v instead",
		edgeName,
		expectedAssocEdge.IsInverseEdge,
		e.IsInverseEdge,
	)

	testInverseAssociationEdge(t, edgeName, e, expectedAssocEdge)

	testEdgeActions(t, edgeName, e.EdgeActions, expectedAssocEdge.EdgeActions)

	testEntConfig(t, e.GetEntConfig(), expectedAssocEdge.GetEntConfig())

	testNodeInfo(t, e.NodeInfo, expectedAssocEdge.NodeInfo.Node)
}

func testInverseAssociationEdge(t *testing.T, edgeName string, e, expectedAssocEdge *edge.AssociationEdge) {
	inverseEdge := e.InverseEdge
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

	testEntConfig(t, inverseEdge.GetEntConfig(), inverseEdge.GetEntConfig())

	testNodeInfo(t, inverseEdge.NodeInfo, expectedInverseEdge.NodeInfo.Node)
}

func testEdgeActions(t *testing.T, edgeName string, edgeActions, expectedEdgeActions []*edge.EdgeAction) {
	require.Equal(t, len(expectedEdgeActions), len(edgeActions))

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

func testAssocEdgeGroup(t *testing.T, edgeGroup, expectedAssocEdgeGroup *edge.AssociationEdgeGroup, actionEdges []string) {
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

func testForeignKeyEdge(t *testing.T, edge, expectedEdge *edge.ForeignKeyEdge) {
	assert.Equal(t, expectedEdge.SourceNodeName, edge.SourceNodeName)

	testDestinationEdge(t, expectedEdge.GetDestinationEdge(), edge.GetDestinationEdge())
}

func testIndexedEdge(t *testing.T, e, expectedEdge *edge.IndexedEdge) {
	assert.Equal(t, expectedEdge.SourceNodeName, e.SourceNodeName)
	assert.Equal(t, expectedEdge.GetTsEdgeName(), e.GetTsEdgeName())
	assert.Equal(t, expectedEdge.GetForeignNode(), e.GetForeignNode())

	testDestinationEdge(t, expectedEdge.GetDestinationEdge(), e.GetDestinationEdge())
}

func testDestinationEdge(t *testing.T, e, expectedEdge edge.DestinationEdgeInterface) {
	assert.Equal(t, expectedEdge.QuotedDBColName(), e.QuotedDBColName())

	assert.Equal(t, expectedEdge.UniqueEdge(), e.UniqueEdge())

	testEntConfig(t, e.GetEntConfig(), expectedEdge.GetEntConfig())

	testNodeInfo(t, e.GetNodeInfo(), expectedEdge.GetNodeInfo().Node)
}

func testFieldEdge(t *testing.T, e, expectedEdge *edge.FieldEdge) {
	assert.Equal(t, expectedEdge.FieldName, e.FieldName)

	assert.Equal(t, expectedEdge.TSFieldName, e.TSFieldName)

	assert.Equal(t, expectedEdge.Nullable, e.Nullable)

	if expectedEdge.InverseEdge == nil {
		require.Nil(t, e.InverseEdge)
	} else {
		assert.Equal(t, expectedEdge.InverseEdge.EdgeConstName, e.InverseEdge.EdgeConstName)
		assert.Equal(t, expectedEdge.InverseEdge.HideFromGraphQL, e.InverseEdge.HideFromGraphQL)
		assert.Equal(t, expectedEdge.InverseEdge.Name, e.InverseEdge.Name)
		assert.Equal(t, expectedEdge.InverseEdge.TableName, e.InverseEdge.TableName)
	}

	if expectedEdge.Polymorphic == nil {
		require.Nil(t, e.Polymorphic)
	} else {
		assert.Equal(t, expectedEdge.Polymorphic.DisableBuilderType, e.Polymorphic.DisableBuilderType)
		assert.Equal(t, expectedEdge.Polymorphic.HideFromInverseGraphQL, e.Polymorphic.HideFromInverseGraphQL)
		assert.Equal(t, expectedEdge.Polymorphic.NodeTypeField, e.Polymorphic.NodeTypeField)
		assert.Equal(t, expectedEdge.Polymorphic.Types, e.Polymorphic.Types)
		assert.Equal(t, expectedEdge.Polymorphic.Unique, e.Polymorphic.Unique)
	}

	assert.Equal(t, expectedEdge.GetTSGraphQLTypeImports(), e.GetTSGraphQLTypeImports())

	testEntConfig(t, e.GetEntConfig(), expectedEdge.GetEntConfig())

	testNodeInfo(t, e.NodeInfo, expectedEdge.NodeInfo.Node)
}
