package schema_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseFromInputSchema(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": &input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
					&input.Field{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	// no table name provided and one automatically generated
	assert.Equal(t, "users", userConfig.NodeData.TableName)
	field, err := schema.GetFieldByName("UserConfig", "id")
	assert.Nil(t, err)
	assert.NotNil(t, field)
}

func TestParseInputWithOverridenTable(t *testing.T) {
	// rename of user -> accounts or something
	tableName := "accounts"
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": &input.Node{
				TableName: &tableName,
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	assert.Equal(t, "accounts", userConfig.NodeData.TableName)
}

func TestParseInputWithForeignKey(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": &input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
				},
			},
			"Event": &input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
					&input.Field{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &[2]string{"User", "id"},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	// still config name because of artifact of go and old schema
	eventConfig := schema.Nodes["EventConfig"]
	assert.NotNil(t, eventConfig)

	userEdge := eventConfig.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	eventsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Events")
	assert.NotNil(t, eventsEdge)
}

func TestParseInputWithFieldEdge(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": &input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
				},
				AssocEdges: []*input.AssocEdge{
					&input.AssocEdge{
						Name:       "CreatedEvents",
						SchemaName: "Event",
					},
				},
			},
			"Event": &input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
					&input.Field{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &[2]string{"User", "CreatedEvents"},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	// still config name because of artifact of go and old schema
	eventConfig := schema.Nodes["EventConfig"]
	assert.NotNil(t, eventConfig)

	userEdge := eventConfig.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	eventsEdge := userConfig.NodeData.EdgeInfo.GetAssociationEdgeByName("CreatedEvents")
	assert.NotNil(t, eventsEdge)
}

// has symmetric and inverse edge!
func TestParseInputWithAssocEdgeGroup(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": &input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
				},
				AssocEdgeGroups: []*input.AssocEdgeGroup{
					&input.AssocEdgeGroup{
						Name:            "Friendships",
						GroupStatusName: "FriendshipStatus",
						AssocEdges: []*input.AssocEdge{
							&input.AssocEdge{
								Name:       "Friends",
								SchemaName: "User",
								Symmetric:  true,
							},
							// has inverse too!
							&input.AssocEdge{
								Name:       "FriendRequestsSent",
								SchemaName: "User",
								InverseEdge: &input.InverseAssocEdge{
									Name: "FriendRequestsReceived",
								},
							},
						},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	edgeGroup := userConfig.NodeData.EdgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")
	require.NotNil(t, edgeGroup)

	friendsEdge := userConfig.NodeData.EdgeInfo.GetAssociationEdgeByName("Friends")
	require.NotNil(t, friendsEdge)
	assert.True(t, friendsEdge.Symmetric)
	require.NotNil(t, edgeGroup.GetAssociationByName("Friends"))

	friendsRequestSentEdge := userConfig.NodeData.EdgeInfo.GetAssociationEdgeByName("FriendRequestsSent")
	require.NotNil(t, friendsRequestSentEdge)
	assert.NotNil(t, friendsRequestSentEdge.InverseEdge)
	require.NotNil(t, edgeGroup.GetAssociationByName("FriendRequestsSent"))

	friendRequestsReceivedEdge := userConfig.NodeData.EdgeInfo.GetAssociationEdgeByName("FriendRequestsReceived")
	require.NotNil(t, friendRequestsReceivedEdge)
	// inverse edge not added to map
	//	require.NotNil(t, edgeGroup.GetAssociationByName("FriendRequestsReceived"))
}
