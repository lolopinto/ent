package edge_test

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func TestSimpleAssocEdge(t *testing.T) {
	edge1, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "CreatedEvents",
		SchemaName: "Event",
	})

	testAssocEdge(t, edge1, (&edge.AssociationEdge{
		EdgeConst:   "UserToCreatedEventsEdge",
		TsEdgeConst: "UserToCreatedEvents",
		TableName:   "user_created_events_edges",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("CreatedEvents", edge.GetEntConfigFromName("Event"))))

	testAssocEdge(t, edge1, edge2)

	l := edge.CompareAssociationEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestUnequalAssocEdge(t *testing.T) {
	edge1 := (&edge.AssociationEdge{
		EdgeConst:   "UserToCreatedEventsEdge",
		TsEdgeConst: "UserToCreatedEvents",
		TableName:   "user_created_events_edges",
	}).SetCommonEdgeInfo(
		edge.GetCommonEdgeInfoForTest("CreatedEvents", edge.GetEntConfigFromName("Event")),
	)
	edge2 := (&edge.AssociationEdge{
		EdgeConst:   "UserToCreatedEventsEdge",
		TsEdgeConst: "UserToCreatedEvents",
		TableName:   "user_created_events_edges2",
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("CreatedEvents", edge.GetEntConfigFromName("Event")))

	l := edge.CompareAssociationEdge(edge1, edge2)
	require.Len(t, l, 1)
}

func TestSymmetricAssocEdge(t *testing.T) {
	edge1, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "Friends",
		SchemaName: "User",
		Symmetric:  true,
	})

	testAssocEdge(t, edge1, (&edge.AssociationEdge{
		EdgeConst:   "UserToFriendsEdge",
		TsEdgeConst: "UserToFriends",
		TableName:   "user_friends_edges",
		Symmetric:   true,
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("Friends", edge.GetEntConfigFromName("User"))))

	testAssocEdge(t, edge1, edge2)

	l := edge.CompareAssociationEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestInverseAssocEdge(t *testing.T) {
	edge1, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "FriendRequestsSent",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name: "FriendRequestsReceived",
		},
	})

	testAssocEdge(t, edge1, (&edge.AssociationEdge{
		EdgeConst:   "UserToFriendRequestsSentEdge",
		TsEdgeConst: "UserToFriendRequestsSent",
		TableName:   "user_friend_requests_sent_edges",
		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "UserToFriendRequestsReceivedEdge",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("FriendRequestsReceived", edge.GetEntConfigFromName("User"))),
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("FriendRequestsSent", edge.GetEntConfigFromName("User"))))

	testAssocEdge(t, edge1, edge2)

	l := edge.CompareAssociationEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestUnequalInverseAssocEdge(t *testing.T) {
	edge1 := (&edge.AssociationEdge{
		EdgeConst:   "UserToFriendRequestsSentEdge",
		TsEdgeConst: "UserToFriendRequestsSent",
		TableName:   "user_friend_requests_sent_edges",
		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "UserToFriendRequestsReceivedEdge",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("FriendRequestsReceived", edge.GetEntConfigFromName("User"))),
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("FriendRequestsSent", edge.GetEntConfigFromName("User")))

	edge2 := (&edge.AssociationEdge{
		EdgeConst:   "UserToFriendRequestsSentEdge",
		TsEdgeConst: "UserToFriendRequestsSent",
		TableName:   "user_friend_requests_sent_edges",
		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "UserToFriendRequestsReceivedEdge2",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("FriendRequestsReceived", edge.GetEntConfigFromName("User"))),
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("FriendRequestsSent", edge.GetEntConfigFromName("User")))

	l := edge.CompareAssociationEdge(edge1, edge2)
	require.Len(t, l, 1)
}

func TestAssocEdgeWithPattern(t *testing.T) {
	edge1, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "likers",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name:          "likes",
			EdgeConstName: "UserToLikedObjects",
		},
		EdgeConstName: "LikedPostToLikers",
		PatternName:   "Likes",
	})

	testAssocEdge(t, edge1, (&edge.AssociationEdge{
		// legacy hence confusing
		EdgeConst:   "UserToLikersEdge",
		TsEdgeConst: "LikedPostToLikers",
		TableName:   "user_likers_edges",
		PatternName: "Likes",
		InverseEdge: (&edge.InverseAssocEdge{
			EdgeConst: "UserToLikedObjectsEdge",
		}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("likes", edge.GetEntConfigFromName("User"))),
	}).SetCommonEdgeInfo(edge.GetCommonEdgeInfoForTest("likers", edge.GetEntConfigFromName("User"))).
		SetOverridenEdgeName("UserToLikersEdge").
		SetOverridenGraphQLName("UserToLikersConnection").
		SetOverridenQueryName("UserToLikersQuery"),
	)

	testAssocEdge(t, edge1, edge2)

	l := edge.CompareAssociationEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func marshallAndUnmarshallInputAssocEdge(t *testing.T, inputEdge *input.AssocEdge) *input.AssocEdge {
	b, err := json.Marshal(inputEdge)
	require.Nil(t, err)
	edge2 := &input.AssocEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	return edge2
}

func createDuplicateAssocEdgeFromInput(t *testing.T, packageName string, inputEdge *input.AssocEdge) (*edge.AssociationEdge, *edge.AssociationEdge) {
	edge1, err := edge.AssocEdgeFromInput(&codegenapi.DummyConfig{}, packageName, inputEdge)
	require.Nil(t, err)
	inputEdge2 := marshallAndUnmarshallInputAssocEdge(t, inputEdge)
	edge2, err := edge.AssocEdgeFromInput(&codegenapi.DummyConfig{}, packageName, inputEdge2)
	require.Nil(t, err)

	return edge1, edge2
}

func getForeignKeyEdgeForTest(dbColName, edgeName, nodeName, sourceNodeName string) *edge.ForeignKeyEdge {
	return edge.GetForeignKeyEdge(&codegenapi.DummyConfig{}, dbColName, edgeName, nodeName, sourceNodeName)
}

func getIndexedEdgeForTest(tsFieldName, quotedDBColName, nodeName string, polymorphic *base.PolymorphicOptions, foreignNode string) *edge.IndexedEdge {
	return edge.GetIndexedEdge(&codegenapi.DummyConfig{}, tsFieldName, quotedDBColName, nodeName, polymorphic, foreignNode)
}

func TestForeignKeyEdge(t *testing.T) {
	edge1 := getForeignKeyEdgeForTest("user_id", "users", "User", "Contact")
	edge2 := getForeignKeyEdgeForTest("user_id", "users", "User", "Contact")

	testForeignKeyEdge(t, edge1, edge2)

	l := edge.CompareForeignKeyEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestUnequalForeignKeyEdge(t *testing.T) {
	edge1 := getForeignKeyEdgeForTest("user_id", "users", "User", "Contact")
	edge2 := getForeignKeyEdgeForTest("user_id", "users", "User2", "Contact")

	l := edge.CompareForeignKeyEdge(edge1, edge2)
	require.Len(t, l, 1)
}

func TestIndexedEdge(t *testing.T) {
	edge1 := getIndexedEdgeForTest("ownerId", "owner_id", "User", nil, "Contact")
	edge2 := getIndexedEdgeForTest("ownerId", "owner_id", "User", nil, "Contact")

	testIndexedEdge(t, edge1, edge2)

	l := edge.CompareIndexedEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestPolymorphicIndexedEdge(t *testing.T) {
	edge1 := getIndexedEdgeForTest("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
		NodeTypeField:      "Node",
		Unique:             true,
	}, "Contact")
	edge2 := getIndexedEdgeForTest("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
		NodeTypeField:      "Node",
		Unique:             true,
	}, "Contact")

	testIndexedEdge(t, edge1, edge2)

	l := edge.CompareIndexedEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestUnEqualPolymorphicIndexedEdge(t *testing.T) {
	edge1 := getIndexedEdgeForTest("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
		NodeTypeField:      "Node",
		Unique:             true,
	}, "Contact")
	edge2 := getIndexedEdgeForTest("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{
			// only 2 fields we care about here are HideFromInverseGraphQL and Unique
			HideFromInverseGraphQL: true,
		},
		NodeTypeField: "Node",
		Unique:        true,
	}, "Contact")

	l := edge.CompareIndexedEdge(edge1, edge2)
	require.Len(t, l, 1)
}

func TestFieldEdge(t *testing.T) {
	edge1, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id",
		&base.FieldEdgeInfo{
			Schema: "Contact",
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge1)
	edge2, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id",
		&base.FieldEdgeInfo{
			Schema: "Contact",
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	testFieldEdge(t, edge1, edge2)

	l := edge.CompareFieldEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestUnequalFieldEdge(t *testing.T) {
	edge1, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id", &base.FieldEdgeInfo{
			Schema: "Contact",
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge1)
	edge2, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id", &base.FieldEdgeInfo{
			Schema: "Contact",
		}, false, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	l := edge.CompareFieldEdge(edge1, edge2)
	require.Len(t, l, 1)
}

func TestFieldEdgeWithInverse(t *testing.T) {
	edge1, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id", &base.FieldEdgeInfo{
			Schema: "Contact",
			InverseEdge: &input.InverseFieldEdge{
				EdgeConstName: "Contacts",
			},
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge1)
	edge2, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id", &base.FieldEdgeInfo{
			Schema: "Contact",
			InverseEdge: &input.InverseFieldEdge{
				EdgeConstName: "Contacts",
			},
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	testFieldEdge(t, edge1, edge2)

	l := edge.CompareFieldEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestPolymorphicFieldEdge(t *testing.T) {
	edge1, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id", &base.FieldEdgeInfo{
			Schema: "Contact",
			Polymorphic: &base.PolymorphicOptions{
				NodeTypeField: "Node",
				PolymorphicOptions: &input.PolymorphicOptions{
					Types: []string{"User", "Account"},
				},
			},
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge1)
	edge2, err := edge.GetFieldEdge(
		&codegenapi.DummyConfig{},
		"user_id", &base.FieldEdgeInfo{
			Schema: "Contact",
			Polymorphic: &base.PolymorphicOptions{
				NodeTypeField: "Node",
				PolymorphicOptions: &input.PolymorphicOptions{
					Types: []string{"User", "Account"},
				},
			},
		}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	testFieldEdge(t, edge1, edge2)

	l := edge.CompareFieldEdge(edge1, edge2)
	require.Len(t, l, 0)
}

func TestAssociationEdgeGroup(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput(&codegenapi.DummyConfig{}, "Event", &input.AssocEdge{
		Name:       "Attending",
		SchemaName: "User",
	})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput(&codegenapi.DummyConfig{}, "Event", &input.AssocEdge{
		Name:       "Declined",
		SchemaName: "User",
	})
	require.Nil(t, err)

	g := (&edge.AssociationEdgeGroup{
		GroupName:         "rsvps",
		GroupStatusName:   "RsvpStatus",
		TSGroupStatusName: "rsvpStatus",
		NodeInfo:          nodeinfo.GetNodeInfo("Event"),
		DestNodeInfo:      nodeinfo.GetNodeInfo("User"),
		Edges: map[string]*edge.AssociationEdge{
			"Attending": edge1,
			"Declined":  edge2,
		},
		StatusEnums: []string{"Attending", "Declined"},
	}).SetStatusEdges([]*edge.AssociationEdge{edge1, edge2})

	g2 := (&edge.AssociationEdgeGroup{
		GroupName:         "rsvps",
		GroupStatusName:   "RsvpStatus",
		TSGroupStatusName: "rsvpStatus",
		NodeInfo:          nodeinfo.GetNodeInfo("Event"),
		DestNodeInfo:      nodeinfo.GetNodeInfo("User"),
		Edges: map[string]*edge.AssociationEdge{
			"Attending": edge1,
			"Declined":  edge2,
		},
		StatusEnums: []string{"Attending", "Declined"},
	}).SetStatusEdges([]*edge.AssociationEdge{edge1, edge2})

	require.True(t, edge.AssocEdgeGroupEqual(g, g2))
}
