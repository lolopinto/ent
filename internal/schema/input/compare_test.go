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

func marshallAndUnmarshallField(t *testing.T, field *Field) *Field {
	b, err := json.Marshal(field)
	require.Nil(t, err)

	f2 := &Field{}
	err = json.Unmarshal(b, f2)
	require.Nil(t, err)
	return f2
}

func marshallAndUnmarshallPattern(t *testing.T, p *Pattern) *Pattern {
	b, err := json.Marshal(p)
	require.Nil(t, err)

	p2 := &Pattern{}
	err = json.Unmarshal(b, p2)
	require.Nil(t, err)
	return p2
}

func marshallAndUnmarshallNode(t *testing.T, n *Node) *Node {
	b, err := json.Marshal(n)
	require.Nil(t, err)

	n2 := &Node{}
	err = json.Unmarshal(b, n2)
	require.Nil(t, err)
	return n2
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

func TestPKeyConstraint(t *testing.T) {
	c := &Constraint{
		Name:    "user_photos_pkey",
		Type:    PrimaryKeyConstraint,
		Columns: []string{"UserID", "PhotoID"},
	}

	b, err := json.Marshal(c)
	require.Nil(t, err)

	c2 := &Constraint{}
	err = json.Unmarshal(b, c2)
	require.Nil(t, err)
	require.True(t, constraintEqual(c, c2))
}

func TestForeignkeyConstraint(t *testing.T) {
	c := &Constraint{
		Name:    "contacts_user_fkey",
		Type:    ForeignKeyConstraint,
		Columns: []string{"UserID"},
		ForeignKey: &ForeignKeyInfo{
			TableName: "users",
			Columns:   []string{"id"},
		},
	}

	b, err := json.Marshal(c)
	require.Nil(t, err)

	c2 := &Constraint{}
	err = json.Unmarshal(b, c2)
	require.Nil(t, err)
	require.True(t, constraintEqual(c, c2))
}

func TestIndex(t *testing.T) {
	i := &Index{
		Name:    "contacts_name_index",
		Columns: []string{"first_name", "last_name"},
	}

	b, err := json.Marshal(i)
	require.Nil(t, err)

	i2 := &Index{}
	err = json.Unmarshal(b, i2)
	require.Nil(t, err)
	require.True(t, indexEqual(i, i2))
}

func TestForeignKey(t *testing.T) {
	fkey := &ForeignKey{
		Schema: "User",
		Column: "id",
		Name:   "users",
	}

	b, err := json.Marshal(fkey)
	require.Nil(t, err)

	fkey2 := &ForeignKey{}
	err = json.Unmarshal(b, fkey2)
	require.Nil(t, err)
	require.True(t, foreignKeyEqual(fkey, fkey2))
}

func TestFieldEdge(t *testing.T) {
	edge := &FieldEdge{
		Schema: "User",
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)

	edge2 := &FieldEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	require.True(t, fieldEdgeEqual(edge, edge2))
}

func TestInverseFieldEdge(t *testing.T) {
	edge := &FieldEdge{
		Schema: "User",
		InverseEdge: &InverseFieldEdge{
			EdgeConstName:   "Contacts",
			HideFromGraphQL: true,
		},
	}

	b, err := json.Marshal(edge)
	require.Nil(t, err)

	edge2 := &FieldEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	require.True(t, fieldEdgeEqual(edge, edge2))
}

func TestPolymorphicOptions(t *testing.T) {
	p := &PolymorphicOptions{
		Types:                  []string{"User", "Account"},
		HideFromInverseGraphQL: true,
	}

	b, err := json.Marshal(p)
	require.Nil(t, err)

	p2 := &PolymorphicOptions{}
	err = json.Unmarshal(b, p2)
	require.Nil(t, err)
	require.True(t, PolymorphicOptionsEqual(p, p2))
}

func TestField(t *testing.T) {
	f := &Field{
		Name: "city",
		Type: &FieldType{
			DBType: String,
		},
		Nullable:   true,
		StorageKey: "location",
	}

	f2 := marshallAndUnmarshallField(t, f)
	require.True(t, fieldEqual(f, f2))
}

func TestEnumField(t *testing.T) {
	f := &Field{
		Name: "AccountStatus",
		Type: &FieldType{
			DBType: StringEnum,
			Values: []string{
				"UNVERIFIED",
				"VERIFIED",
				"DEACTIVATED",
				"DISABLED",
			},
			Type:        "AccountStatus",
			GraphQLType: "AccountStatus",
		},
		Nullable: true,
	}

	f2 := marshallAndUnmarshallField(t, f)
	require.True(t, fieldEqual(f, f2))
}

func TestPolymorphicDerivedField(t *testing.T) {
	f := &Field{
		Name: "AccountStatus",
		Type: &FieldType{
			DBType: UUID,
		},
		Index: true,
		Polymorphic: &PolymorphicOptions{
			Types:                  []string{"User", "Location"},
			HideFromInverseGraphQL: true,
		},
		DerivedFields: []*Field{
			{
				Name: "OwnerType",
				Type: &FieldType{
					DBType: String,
				},
				HideFromGraphQL: true,
			},
		},
		Nullable: true,
	}

	f2 := marshallAndUnmarshallField(t, f)
	require.True(t, fieldEqual(f, f2))
}

func TestPattern(t *testing.T) {
	p := &Pattern{
		Name: "node",
		Fields: []*Field{
			{
				Name: "id",
				Type: &FieldType{
					DBType: UUID,
				},
			},
		},
	}

	p2 := marshallAndUnmarshallPattern(t, p)
	require.True(t, PatternEqual(p, p2))
}

func TestPatternWithEdges(t *testing.T) {
	p := &Pattern{
		Name: "node+feedback",
		Fields: []*Field{
			{
				Name: "id",
				Type: &FieldType{
					DBType: UUID,
				},
			},
		},
		AssocEdges: []*AssocEdge{
			{
				Name:       "likers",
				SchemaName: "User",
				InverseEdge: &InverseAssocEdge{
					Name:          "likes",
					EdgeConstName: "UserToLikes",
				},
				EdgeConstName: "ObjectToLikers",
				PatternName:   "feedback",
			},
		},
	}

	p2 := marshallAndUnmarshallPattern(t, p)
	require.True(t, PatternEqual(p, p2))
}

func TestNode(t *testing.T) {
	node := &Node{
		TableName: "auth_codes",
		Fields: []*Field{
			{
				Name: "code",
				Type: &FieldType{
					DBType: String,
				},
				HideFromGraphQL: true,
			},
		},
	}
	node2 := marshallAndUnmarshallNode(t, node)
	require.True(t, NodeEqual(node, node2))
}
