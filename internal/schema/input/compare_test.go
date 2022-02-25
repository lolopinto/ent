package input

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/stretchr/testify/require"
)

func marshallAndUnmarshallAssocEdge(t *testing.T, edge *AssocEdge) *AssocEdge {
	b, err := json.Marshal(edge)
	require.Nil(t, err)

	edge2 := &AssocEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	return edge2
}

func TestSimpleAssocEdge(t *testing.T) {
	edge := &AssocEdge{
		Name:       "CreatedEvents",
		SchemaName: "Event",
	}
	edge2 := marshallAndUnmarshallAssocEdge(t, edge)
	require.True(t, assocEdgeEqual(edge, edge2))
}

func TestSymmetricAssocEdge(t *testing.T) {
	edge := &AssocEdge{
		Name:       "Friends",
		SchemaName: "User",
		Symmetric:  true,
	}
	edge2 := marshallAndUnmarshallAssocEdge(t, edge)
	require.True(t, assocEdgeEqual(edge, edge2))
}

func TestInverseAssocEdge(t *testing.T) {
	edge := &AssocEdge{
		Name:       "FriendRequestsSent",
		SchemaName: "User",
		InverseEdge: &InverseAssocEdge{
			Name: "FriendRequestsReceived",
		},
		Unique:          true,
		HideFromGraphQL: true,
	}
	edge2 := marshallAndUnmarshallAssocEdge(t, edge)
	require.True(t, assocEdgeEqual(edge, edge2))
}

func TestAssocEdgeWithPattern(t *testing.T) {
	edge := &AssocEdge{
		Name:       "likers",
		SchemaName: "User",
		InverseEdge: &InverseAssocEdge{
			Name:          "likes",
			EdgeConstName: "UserToLikedObjects",
		},
		EdgeConstName: "LikedPostToLikers",
		PatternName:   "Likes",
		TableName:     "foo_table",
	}
	edge2 := marshallAndUnmarshallAssocEdge(t, edge)
	require.True(t, assocEdgeEqual(edge, edge2))
}

func TestAssocEdgeWithActions(t *testing.T) {
	edge := &AssocEdge{
		Name:       "friends",
		SchemaName: "User",
		Symmetric:  true,
		EdgeActions: []*EdgeAction{
			{
				Operation: ent.AddEdgeAction,
			},
			{
				Operation: ent.RemoveEdgeAction,
				ActionOnlyFields: []*ActionField{
					{
						Name:     "foo",
						Type:     "String",
						Nullable: true,
					},
					{
						Name:             "bar",
						Type:             "int",
						list:             true,
						nullableContents: true,
					},
				},
			},
		},
	}
	edge2 := marshallAndUnmarshallAssocEdge(t, edge)
	require.True(t, assocEdgeEqual(edge, edge2))
}

func TestAssocEdgeGroup(t *testing.T) {
	group := &AssocEdgeGroup{
		Name:            "friendships",
		GroupStatusName: "friendshipStatus",
		NullStates:      []string{"canRequest", "cannotRequest"},
		NullStateFn:     "friendshipStatus",
		AssocEdges: []*AssocEdge{
			{
				Name:       "outgoingRequest",
				SchemaName: "User",
				InverseEdge: &InverseAssocEdge{
					Name: "incomingRequest",
				},
			},
			{
				Name:       "friends",
				SchemaName: "User",
				Symmetric:  true,
			},
		},
		EdgeActions: []*EdgeAction{
			{
				Operation: ent.EdgeGroupAction,
				ActionOnlyFields: []*ActionField{
					{
						Name: "blah",
						Type: ActionTypeString,
					},
				},
			},
		},
	}

	b, err := json.Marshal(group)
	require.Nil(t, err)

	group2 := &AssocEdgeGroup{}
	err = json.Unmarshal(b, group2)
	require.Nil(t, err)
	require.True(t, assocEdgeGroupEqual(group, group2))
}

func TestSimpleAction(t *testing.T) {
	action := &Action{
		Operation: ent.EditAction,
		Fields:    []string{"first_name", "last_name"},
		ActionOnlyFields: []*ActionField{
			{
				Name: "blah",
				Type: ActionTypeString,
			},
		},
	}

	b, err := json.Marshal(action)
	require.Nil(t, err)

	action2 := &Action{}
	err = json.Unmarshal(b, action2)
	require.Nil(t, err)
	require.True(t, actionEqual(action, action2))
}

func TestForiegnKeyInfo(t *testing.T) {
	fkey := &ForeignKeyInfo{
		TableName: "users",
		Columns:   []string{"id"},
		OnDelete:  Cascade,
	}

	b, err := json.Marshal(fkey)
	require.Nil(t, err)

	fkey2 := &ForeignKeyInfo{}
	err = json.Unmarshal(b, fkey2)
	require.Nil(t, err)
	require.True(t, foreignKeyInfoEqual(fkey, fkey2))
}
