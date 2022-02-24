package edge

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/require"
)

func TestSimpleEdge(t *testing.T) {
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "CreatedEvents",
		SchemaName: "Event",
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshall(t, edge)

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

func TestSymmetricEdge(t *testing.T) {
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "Friends",
		SchemaName: "User",
		Symmetric:  true,
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshall(t, edge)

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

func TestInverseEdge(t *testing.T) {
	edge, err := AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "FriendRequestsSent",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name: "FriendRequestsReceived",
		},
	})
	require.Nil(t, err)

	edge2 := marshallAndUnmarshall(t, edge)

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

func TestWithPattern(t *testing.T) {
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

	edge2 := marshallAndUnmarshall(t, edge)

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

func marshallAndUnmarshall(t *testing.T, edge *AssociationEdge) *AssociationEdge {
	b, err := json.Marshal(edge)
	require.Nil(t, err)

	edge2 := &AssociationEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	return edge2
}
