package edge

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/require"
)

func TestSimpleAssocEdge(t *testing.T) {
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "CreatedEvents",
		SchemaName: "Event",
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshallAssocEdge(t, edge)

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

func TestSymmetricAssocEdge(t *testing.T) {
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "Friends",
		SchemaName: "User",
		Symmetric:  true,
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshallAssocEdge(t, edge)

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
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "FriendRequestsSent",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name: "FriendRequestsReceived",
		},
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshallAssocEdge(t, edge)

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

func TestAssocEdgeWithPattern(t *testing.T) {
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "likers",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name:          "likes",
			EdgeConstName: "UserToLikedObjects",
		},
		EdgeConstName: "LikedPostToLikers",
		PatternName:   "Likes",
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshallAssocEdge(t, edge)

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
		OverridenQueryName:   "UserToLikersQuery",
		OverridenEdgeName:    "UserToLikersEdge",
		OverridenGraphQLName: "UserToLikersConnection",
	})

	testAssocEdge(t, edge, edge2)

	l := CompareAssociationEdge(edge, edge2)
	require.Len(t, l, 0)
}

func marshallAndUnmarshallAssocEdge(t *testing.T, edge *AssociationEdge) *AssociationEdge {
	b, err := json.Marshal(edge)
	require.Nil(t, err)

	edge2 := &AssociationEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	return edge2
}

func TestForeignKeyEdge(t *testing.T) {
	edge := &ForeignKeyEdge{
		SourceNodeName: "Contact",
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				"users",
				schemaparser.GetEntConfigFromName("User"),
			),
			QuotedDbColNameField: "user_id",
		},
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)
	edge2 := &ForeignKeyEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)

	testForeignKeyEdge(t, edge, edge2)

	l := CompareForeignKeyEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestUniqueForeignKeyEdge(t *testing.T) {
	edge := &ForeignKeyEdge{
		SourceNodeName: "Contact",
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				"users",
				schemaparser.GetEntConfigFromName("User"),
			),
			QuotedDbColNameField: "user_id",
			UniqueField:          true,
		},
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)
	edge2 := &ForeignKeyEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)

	testForeignKeyEdge(t, edge, edge2)

	l := CompareForeignKeyEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestIndexedEdge(t *testing.T) {
	edge := &IndexedEdge{
		TsEdgeName: "Owners",
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				"users",
				schemaparser.GetEntConfigFromName("User"),
			),
			QuotedDbColNameField: "owner_id",
			UniqueField:          true,
		},
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)
	edge2 := &IndexedEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)

	testIndexedEdge(t, edge, edge2)

	l := CompareIndexedEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestFieldEdge(t *testing.T) {
	edge := &FieldEdge{
		FieldName:      "user_id",
		TSFieldName:    "userID",
		commonEdgeInfo: getCommonEdgeInfo("user_ids", schemaparser.GetEntConfigFromName("Contact")),
		Nullable:       true,
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)
	edge2 := &FieldEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)

	testFieldEdge(t, edge, edge2)

	l := CompareFieldEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestFieldEdgeWithInverse(t *testing.T) {
	edge := &FieldEdge{
		FieldName:      "user_id",
		TSFieldName:    "userID",
		commonEdgeInfo: getCommonEdgeInfo("user_ids", schemaparser.GetEntConfigFromName("User")),
		Nullable:       true,
		InverseEdge: &input.InverseFieldEdge{
			EdgeConstName: "Contacts",
		},
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)
	edge2 := &FieldEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)

	testFieldEdge(t, edge, edge2)

	l := CompareFieldEdge(edge, edge2)
	require.Len(t, l, 0)
}

func TestPolymorphicFieldEdge(t *testing.T) {
	edge := &FieldEdge{
		FieldName:      "user_id",
		TSFieldName:    "userID",
		commonEdgeInfo: getCommonEdgeInfo("user_ids", schemaparser.GetEntConfigFromName("User")),
		Nullable:       true,
		Polymorphic: &base.PolymorphicOptions{
			NodeTypeField: "Node",
			PolymorphicOptions: &input.PolymorphicOptions{
				Types: []string{"User", "Account"},
			},
		},
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)
	edge2 := &FieldEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)

	testFieldEdge(t, edge, edge2)

	l := CompareFieldEdge(edge, edge2)
	require.Len(t, l, 0)
}
