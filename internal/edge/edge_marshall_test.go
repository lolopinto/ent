package edge

import (
	"encoding/json"
	"testing"

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
		CommonEdgeInfo: getCommonEdgeInfo("CreatedEvents", schemaparser.GetEntConfigFromName("Event")),
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
		CommonEdgeInfo: getCommonEdgeInfo("Friends", schemaparser.GetEntConfigFromName("User")),
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
		CommonEdgeInfo: getCommonEdgeInfo("FriendRequestsSent", schemaparser.GetEntConfigFromName("User")),
		EdgeConst:      "UserToFriendRequestsSentEdge",
		TsEdgeConst:    "UserToFriendRequestsSent",
		TableName:      "user_friend_requests_sent_edges",
		InverseEdge: &InverseAssocEdge{
			CommonEdgeInfo: getCommonEdgeInfo("FriendRequestsReceived", schemaparser.GetEntConfigFromName("User")),
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
		CommonEdgeInfo: getCommonEdgeInfo("likers", schemaparser.GetEntConfigFromName("User")),
		// legacy hence confusing
		EdgeConst:   "UserToLikersEdge",
		TsEdgeConst: "LikedPostToLikers",
		TableName:   "user_likers_edges",
		PatternName: "Likes",
		InverseEdge: &InverseAssocEdge{
			CommonEdgeInfo: getCommonEdgeInfo("likes", schemaparser.GetEntConfigFromName("User")),
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
			CommonEdgeInfo: getCommonEdgeInfo(
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
			CommonEdgeInfo: getCommonEdgeInfo(
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
