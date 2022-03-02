package edge

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/require"
)

func TestSimpleAssocEdge(t *testing.T) {
	edge, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "CreatedEvents",
		SchemaName: "Event",
	})

	testAssocEdge(t, edge, &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("CreatedEvents", schemaparser.GetEntConfigFromName("Event")),
		EdgeConst:      "UserToCreatedEventsEdge",
		TsEdgeConst:    "UserToCreatedEvents",
		TableName:      "user_created_events_edges",
	})

	testAssocEdge(t, edge, edge2)

	l := CompareAssociationEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestUnequalAssocEdge(t *testing.T) {
	edge := &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("CreatedEvents", schemaparser.GetEntConfigFromName("Event")),
		EdgeConst:      "UserToCreatedEventsEdge",
		TsEdgeConst:    "UserToCreatedEvents",
		TableName:      "user_created_events_edges",
	}
	edge2 := &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("CreatedEvents", schemaparser.GetEntConfigFromName("Event")),
		EdgeConst:      "UserToCreatedEventsEdge",
		TsEdgeConst:    "UserToCreatedEvents",
		TableName:      "user_created_events_edges2",
	}

	l := CompareAssociationEdge(edge, edge2)
	require.Len(t, l, 1)
}

func TestSymmetricAssocEdge(t *testing.T) {
	edge, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "Friends",
		SchemaName: "User",
		Symmetric:  true,
	})

	testAssocEdge(t, edge, &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("Friends", schemaparser.GetEntConfigFromName("User")),
		EdgeConst:      "UserToFriendsEdge",
		TsEdgeConst:    "UserToFriends",
		TableName:      "user_friends_edges",
		Symmetric:      true,
	})

	testAssocEdge(t, edge, edge2)

	l := CompareAssociationEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestInverseAssocEdge(t *testing.T) {
	edge, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "FriendRequestsSent",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name: "FriendRequestsReceived",
		},
	})

	testAssocEdge(t, edge, &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("FriendRequestsSent", schemaparser.GetEntConfigFromName("User")),
		EdgeConst:      "UserToFriendRequestsSentEdge",
		TsEdgeConst:    "UserToFriendRequestsSent",
		TableName:      "user_friend_requests_sent_edges",
		InverseEdge: &InverseAssocEdge{
			commonEdgeInfo: getCommonEdgeInfo("FriendRequestsReceived", schemaparser.GetEntConfigFromName("User")),
			EdgeConst:      "UserToFriendRequestsReceivedEdge",
		},
	})

	testAssocEdge(t, edge, edge2)

	l := CompareAssociationEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestUnequalInverseAssocEdge(t *testing.T) {
	edge := &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("FriendRequestsSent", schemaparser.GetEntConfigFromName("User")),
		EdgeConst:      "UserToFriendRequestsSentEdge",
		TsEdgeConst:    "UserToFriendRequestsSent",
		TableName:      "user_friend_requests_sent_edges",
		InverseEdge: &InverseAssocEdge{
			commonEdgeInfo: getCommonEdgeInfo("FriendRequestsReceived", schemaparser.GetEntConfigFromName("User")),
			EdgeConst:      "UserToFriendRequestsReceivedEdge",
		},
	}

	edge2 := &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("FriendRequestsSent", schemaparser.GetEntConfigFromName("User")),
		EdgeConst:      "UserToFriendRequestsSentEdge",
		TsEdgeConst:    "UserToFriendRequestsSent",
		TableName:      "user_friend_requests_sent_edges",
		InverseEdge: &InverseAssocEdge{
			commonEdgeInfo: getCommonEdgeInfo("FriendRequestsReceived", schemaparser.GetEntConfigFromName("User")),
			EdgeConst:      "UserToFriendRequestsReceivedEdge2",
		},
	}

	l := CompareAssociationEdge(edge, edge2)
	require.Len(t, l, 1)
}

func TestAssocEdgeWithPattern(t *testing.T) {
	edge, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "likers",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name:          "likes",
			EdgeConstName: "UserToLikedObjects",
		},
		EdgeConstName: "LikedPostToLikers",
		PatternName:   "Likes",
	})

	testAssocEdge(t, edge, &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo("likers", schemaparser.GetEntConfigFromName("User")),
		// legacy hence confusing
		EdgeConst:   "UserToLikersEdge",
		TsEdgeConst: "LikedPostToLikers",
		TableName:   "user_likers_edges",
		PatternName: "Likes",
		InverseEdge: &InverseAssocEdge{
			commonEdgeInfo: getCommonEdgeInfo("likes", schemaparser.GetEntConfigFromName("User")),
			EdgeConst:      "UserToLikedObjectsEdge",
		},
		overridenQueryName:   "UserToLikersQuery",
		overridenEdgeName:    "UserToLikersEdge",
		overridenGraphQLName: "UserToLikersConnection",
	})

	testAssocEdge(t, edge, edge2)

	l := CompareAssociationEdge(edge, edge2)
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

func createDuplicateAssocEdgeFromInput(t *testing.T, packageName string, inputEdge *input.AssocEdge) (*AssociationEdge, *AssociationEdge) {
	edge, err := AssocEdgeFromInput(packageName, inputEdge)
	require.Nil(t, err)
	inputEdge2 := marshallAndUnmarshallInputAssocEdge(t, inputEdge)
	edge2, err := AssocEdgeFromInput(packageName, inputEdge2)
	require.Nil(t, err)

	return edge, edge2
}

func TestForeignKeyEdge(t *testing.T) {
	edge := getForeignKeyEdge("user_id", "users", "User", "Contact")
	edge2 := getForeignKeyEdge("user_id", "users", "User", "Contact")

	testForeignKeyEdge(t, edge, edge2)

	l := compareForeignKeyEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestUnequalForeignKeyEdge(t *testing.T) {
	edge := getForeignKeyEdge("user_id", "users", "User", "Contact")
	edge2 := getForeignKeyEdge("user_id", "users", "User2", "Contact")

	l := compareForeignKeyEdge(edge, edge2)
	require.Len(t, l, 1)
}

func TestIndexedEdge(t *testing.T) {
	edge := getIndexedEdge("ownerId", "owner_id", "User", nil, "Contact")
	edge2 := getIndexedEdge("ownerId", "owner_id", "User", nil, "Contact")

	testIndexedEdge(t, edge, edge2)

	l := compareIndexedEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestPolymorphicIndexedEdge(t *testing.T) {
	edge := getIndexedEdge("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
		NodeTypeField:      "Node",
		Unique:             true,
	}, "Contact")
	edge2 := getIndexedEdge("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
		NodeTypeField:      "Node",
		Unique:             true,
	}, "Contact")

	testIndexedEdge(t, edge, edge2)

	l := compareIndexedEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestUnEqualPolymorphicIndexedEdge(t *testing.T) {
	edge := getIndexedEdge("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
		NodeTypeField:      "Node",
		Unique:             true,
	}, "Contact")
	edge2 := getIndexedEdge("ownerId", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{
			// only 2 fields we care about here are HideFromInverseGraphQL and Unique
			HideFromInverseGraphQL: true,
		},
		NodeTypeField: "Node",
		Unique:        true,
	}, "Contact")

	l := compareIndexedEdge(edge, edge2)
	require.Len(t, l, 1)
}

func TestFieldEdge(t *testing.T) {
	edge, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
	}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge)
	edge2, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
	}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	testFieldEdge(t, edge, edge2)

	l := compareFieldEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestUnequalFieldEdge(t *testing.T) {
	edge, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
	}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge)
	edge2, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
	}, false, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	l := compareFieldEdge(edge, edge2)
	require.Len(t, l, 1)
}

func TestFieldEdgeWithInverse(t *testing.T) {
	edge, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
		InverseEdge: &input.InverseFieldEdge{
			EdgeConstName: "Contacts",
		},
	}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge)
	edge2, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
		InverseEdge: &input.InverseFieldEdge{
			EdgeConstName: "Contacts",
		},
	}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge2)

	testFieldEdge(t, edge, edge2)

	l := compareFieldEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestPolymorphicFieldEdge(t *testing.T) {
	edge, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
		Schema: "Contact",
		Polymorphic: &base.PolymorphicOptions{
			NodeTypeField: "Node",
			PolymorphicOptions: &input.PolymorphicOptions{
				Types: []string{"User", "Account"},
			},
		},
	}, true, nil)
	require.Nil(t, err)
	require.NotNil(t, edge)
	edge2, err := getFieldEdge("user_id", &base.FieldEdgeInfo{
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

	testFieldEdge(t, edge, edge2)

	l := compareFieldEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestAssociationEdgeGroup(t *testing.T) {

	edge1, err := AssocEdgeFromInput("Event", &input.AssocEdge{
		Name:       "Attending",
		SchemaName: "User",
	})
	require.Nil(t, err)
	edge2, err := AssocEdgeFromInput("Event", &input.AssocEdge{
		Name:       "Declined",
		SchemaName: "User",
	})
	require.Nil(t, err)

	g := &AssociationEdgeGroup{
		GroupName:         "rsvps",
		GroupStatusName:   "RsvpStatus",
		TSGroupStatusName: "rsvpStatus",
		NodeInfo:          nodeinfo.GetNodeInfo("Event"),
		DestNodeInfo:      nodeinfo.GetNodeInfo("User"),
		statusEdges:       []*AssociationEdge{edge1, edge2},
		Edges: map[string]*AssociationEdge{
			"Attending": edge1,
			"Declined":  edge2,
		},
		StatusEnums: []string{"Attending", "Declined"},
	}

	g2 := &AssociationEdgeGroup{
		GroupName:         "rsvps",
		GroupStatusName:   "RsvpStatus",
		TSGroupStatusName: "rsvpStatus",
		NodeInfo:          nodeinfo.GetNodeInfo("Event"),
		DestNodeInfo:      nodeinfo.GetNodeInfo("User"),
		statusEdges:       []*AssociationEdge{edge1, edge2},
		Edges: map[string]*AssociationEdge{
			"Attending": edge1,
			"Declined":  edge2,
		},
		StatusEnums: []string{"Attending", "Declined"},
	}

	require.True(t, AssocEdgeGroupEqual(g, g2))
}
