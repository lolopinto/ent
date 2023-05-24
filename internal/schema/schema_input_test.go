package schema_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func parseFromInputSchema(inputSchema *input.Schema, lang base.Language) (*schema.Schema, error) {
	return schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, lang)
}

func TestParseFromInputSchema(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	user := schema.Nodes["User"]
	assert.NotNil(t, user)

	// no table name provided and one automatically generated
	assert.Equal(t, "users", user.NodeData.TableName)
	field, err := schema.GetFieldByName("User", "id")
	assert.Nil(t, err)
	assert.NotNil(t, field)
}

func TestCompoundName(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"PickupLocation": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "name",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	// still pickupLocation name because of artifact of go and old schema
	pickupLocation := schema.Nodes["PickupLocation"]
	assert.NotNil(t, pickupLocation)

	nodeData := pickupLocation.NodeData
	// no table name provided and one automatically generated
	assert.Equal(t, "pickup_locations", nodeData.TableName)

	// package name correct
	assert.Equal(t, "pickup_location", nodeData.PackageName)
	field, err := schema.GetFieldByName("PickupLocation", "id")
	assert.Nil(t, err)
	assert.NotNil(t, field)
}

func TestParseInputWithOverridenTable(t *testing.T) {
	// rename of user -> accounts or something
	tableName := "accounts"
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				TableName: tableName,
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	user := schema.Nodes["User"]
	assert.NotNil(t, user)

	assert.Equal(t, "accounts", user.NodeData.TableName)
}

func TestParseInputWithForeignKey(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id"},
						Index:      true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	event := schema.Nodes["Event"]
	assert.NotNil(t, event)

	userEdge := event.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)

	user := schema.Nodes["User"]
	assert.NotNil(t, user)

	eventsEdge := user.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Events")
	assert.NotNil(t, eventsEdge)
}

func TestParseInputWithInvalidForeignKeySchema(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "FakeUser", Column: "id"},
						Index:      true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Error(t, err)
	require.Equal(t, err.Error(), "invalid schema FakeUser for foreign key ")
	require.Nil(t, schema)
}

func TestParseInputWithForeignKeyIndexDisabled(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id", DisableIndex: true},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	// hmm should there be a fieldEdge here? it seems like yes
	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	eventsEdge := userInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Events")
	assert.Nil(t, eventsEdge)
}

func TestParseInputWithForeignKeyWithCustomName(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id", Name: "CreatedEvents"},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	// edge name is different since name was given
	createdEventsEdge := userInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("CreatedEvents")
	assert.NotNil(t, createdEventsEdge)
}

func TestMultipleForeignKeysDuplicateEdgeName(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Request": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "CreatorID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id"},
					},
					{
						Name: "HelperID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id"},
					},
				},
			},
		},
	}

	// errors because duplicate edge name since edgeName wasn't given for either
	s, err := parseFromInputSchema(inputSchema, base.GoLang)
	require.Error(t, err)
	require.Regexp(t, "to have multiple ForeignKey Edges", err.Error())
	require.Nil(t, s)
}

func TestMultipleForeignKeysOneEdgeName(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Request": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "CreatorID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id"},
					},
					{
						Name: "HelperID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id", Name: "helpedRequests"},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	requestInfo := schema.Nodes["Request"]
	assert.NotNil(t, requestInfo)

	helperEdge := requestInfo.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, helperEdge)

	creatorEdge := requestInfo.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, creatorEdge)

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	requestsEdge := userInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Requests")
	assert.NotNil(t, requestsEdge)

	helpedRequestsEdge := userInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("helpedRequests")
	assert.NotNil(t, helpedRequestsEdge)
}

func TestMultipleForeignKeys(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Request": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "CreatorID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id", Name: "createdRequests"},
					},
					{
						Name: "HelperID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{Schema: "User", Column: "id", Name: "helpedRequests"},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	requestInfo := schema.Nodes["Request"]
	assert.NotNil(t, requestInfo)

	helperEdge := requestInfo.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, helperEdge)

	creatorEdge := requestInfo.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, creatorEdge)

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	requestsEdge := userInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("createdRequests")
	assert.NotNil(t, requestsEdge)

	helpedRequestsEdge := userInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("helpedRequests")
	assert.NotNil(t, helpedRequestsEdge)
}

func TestParseInputWithFieldEdge(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{Schema: "User", InverseEdge: &input.InverseFieldEdge{Name: "CreatedEvents"}},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)
	assert.Equal(t, userEdge.NodeInfo.Node, "User")
	assert.Equal(t, userEdge.InverseEdge.Name, "CreatedEvents")

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	eventsEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("CreatedEvents")
	assert.NotNil(t, eventsEdge)
	assert.Equal(t, eventsEdge.NodeInfo.Node, "Event")

	// 2 nodes, 1 edge
	testConsts(t, eventInfo.NodeData.ConstantGroups, 1, 0)
	testConsts(t, userInfo.NodeData.ConstantGroups, 1, 1)
}

func TestParseInputWitPrivateFieldEdge(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{
							Schema: "User",
						},
						Private: &input.PrivateOptions{},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.Nil(t, userEdge)
}

func TestParseInputWithInvalidFieldEdgeSchema(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{Schema: "FakeUser", InverseEdge: &input.InverseFieldEdge{Name: "CreatedEvents"}},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Error(t, err)
	require.Equal(t, err.Error(), "invalid schema FakeUser")
	require.Nil(t, schema)
}

func TestParseInputWithFieldEdgeAndNoEdgeInSource(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{Schema: "User", InverseEdge: &input.InverseFieldEdge{Name: "CreatedEvents"}},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)
	assert.Equal(t, userEdge.NodeInfo.Node, "User")
	assert.Equal(t, userEdge.InverseEdge.Name, "CreatedEvents")

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	eventsEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("CreatedEvents")
	assert.NotNil(t, eventsEdge)
	assert.Equal(t, eventsEdge.NodeInfo.Node, "Event")
	assert.Equal(t, eventsEdge.HideFromGraphQL(), false)
	assert.Equal(t, eventsEdge.EdgeConst, "UserToCreatedEventsEdge")

	// 2 nodes, 1 edge
	testConsts(t, eventInfo.NodeData.ConstantGroups, 1, 0)
	testConsts(t, userInfo.NodeData.ConstantGroups, 1, 1)
}

func TestParseInputWithFieldEdgeAndNoEdgeInSourceMoreOptions(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{Schema: "User", InverseEdge: &input.InverseFieldEdge{Name: "CreatedEvents", HideFromGraphQL: true, EdgeConstName: "ProfileToCreatedEvents"}},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventConfig := schema.Nodes["Event"]
	assert.NotNil(t, eventConfig)

	userEdge := eventConfig.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)
	assert.Equal(t, userEdge.NodeInfo.Node, "User")
	assert.Equal(t, userEdge.InverseEdge.Name, "CreatedEvents")

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	eventsEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("CreatedEvents")
	assert.NotNil(t, eventsEdge)
	assert.Equal(t, eventsEdge.NodeInfo.Node, "Event")
	// these 2 are different from above test
	assert.Equal(t, eventsEdge.HideFromGraphQL(), true)
	assert.Equal(t, eventsEdge.EdgeConst, "ProfileToCreatedEventsEdge")

	// 2 nodes, 1 edge
	testConsts(t, eventConfig.NodeData.ConstantGroups, 1, 0)
	testConsts(t, userInfo.NodeData.ConstantGroups, 1, 1)
}

// has symmetric and inverse edge!
func TestParseInputWithAssocEdgeGroup(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
				AssocEdgeGroups: []*input.AssocEdgeGroup{
					{
						Name:            "Friendships",
						GroupStatusName: "FriendshipStatus",
						AssocEdges: []*input.AssocEdge{
							{
								Name:       "Friends",
								SchemaName: "User",
								Symmetric:  true,
							},
							// has inverse too!
							{
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

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	edgeGroup := userInfo.NodeData.EdgeInfo.GetAssociationEdgeGroupByStatusName("FriendshipStatus")
	require.NotNil(t, edgeGroup)

	friendsEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("Friends")
	require.NotNil(t, friendsEdge)
	assert.True(t, friendsEdge.Symmetric)
	require.NotNil(t, edgeGroup.GetAssociationByName("Friends"))

	friendsRequestSentEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("FriendRequestsSent")
	require.NotNil(t, friendsRequestSentEdge)
	assert.NotNil(t, friendsRequestSentEdge.InverseEdge)
	require.NotNil(t, edgeGroup.GetAssociationByName("FriendRequestsSent"))

	friendRequestsReceivedEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("FriendRequestsReceived")
	require.NotNil(t, friendRequestsReceivedEdge)
	// inverse edge not added to map
	//	require.NotNil(t, edgeGroup.GetAssociationByName("FriendRequestsReceived"))
}

func TestParseInputWithPolymorphicFieldEdge(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						DerivedFields: []*input.Field{
							{
								Name: "ownerType",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						Polymorphic: &input.PolymorphicOptions{},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	addressInfo := schema.Nodes["Address"]
	assert.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	assert.NotNil(t, ownerEdge)
}

func TestParseInputWithPolymorphicFieldEdgeInverseTypes(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "location",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						DerivedFields: []*input.Field{
							{
								Name: "ownerType",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						Polymorphic: &input.PolymorphicOptions{
							Types: []string{"user", "event"},
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 3)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Equal(t, "OwnerToAddressesConnection", addressesEdge.GetGraphQLConnectionName())
	assert.Equal(t, "OwnerToAddresses", addressesEdge.GetGraphQLEdgePrefix())

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.NotNil(t, indexedEdge)

	assert.Equal(t, indexedEdge.TsEdgeQueryName(), "OwnersFromUserToAddressesQuery")

	assert.Equal(t, indexedEdge.GetGraphQLConnectionName(), "OwnersFromUserToAddressesConnection")
	assert.Equal(t, indexedEdge.GetGraphQLEdgePrefix(), "OwnersFromUserToAddresses")

	eventCfg := schema.Nodes["Event"]
	assert.NotNil(t, eventCfg)

	indexedEdge2 := eventCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.NotNil(t, indexedEdge2)

	assert.Equal(t, indexedEdge2.TsEdgeQueryName(), "OwnersFromEventToAddressesQuery")

	assert.Equal(t, indexedEdge2.GetGraphQLConnectionName(), "OwnersFromEventToAddressesConnection")
	assert.Equal(t, indexedEdge2.GetGraphQLEdgePrefix(), "OwnersFromEventToAddresses")
}

func TestParseInputWithMultiplePolymorphicFieldEdgeInverseTypes(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						DerivedFields: []*input.Field{
							{
								Name: "ownerType",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						Polymorphic: &input.PolymorphicOptions{
							Types: []string{"user"},
						},
					},
					{
						Name: "fooID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						DerivedFields: []*input.Field{
							{
								Name: "fooType",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						// need a name for inverseEdge...
						Polymorphic: &input.PolymorphicOptions{
							Types: []string{"user"},
							Name:  "FooAddresses",
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Equal(t, "OwnerToAddressesConnection", addressesEdge.GetGraphQLConnectionName())
	assert.Equal(t, "OwnerToAddresses", addressesEdge.GetGraphQLEdgePrefix())

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.NotNil(t, indexedEdge)

	assert.Equal(t, indexedEdge.TsEdgeQueryName(), "OwnersFromUserToAddressesQuery")

	assert.Equal(t, indexedEdge.GetGraphQLConnectionName(), "OwnersFromUserToAddressesConnection")
	assert.Equal(t, indexedEdge.GetGraphQLEdgePrefix(), "OwnersFromUserToAddresses")

	fooEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("fooIDS")
	require.NotNil(t, fooEdge)
	assert.Equal(t, fooEdge.TsEdgeQueryName(), "FooToAddressesQuery")
	assert.Equal(t, "FooToAddressesConnection", fooEdge.GetGraphQLConnectionName())
	assert.Equal(t, "FooToAddresses", fooEdge.GetGraphQLEdgePrefix())

	indexedEdge2 := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("FooAddresses")
	assert.NotNil(t, indexedEdge2)

	assert.Equal(t, indexedEdge2.TsEdgeQueryName(), "FoosFromUserToAddressesQuery")

	assert.Equal(t, indexedEdge2.GetGraphQLConnectionName(), "FoosFromUserToAddressesConnection")
	assert.Equal(t, indexedEdge2.GetGraphQLEdgePrefix(), "FoosFromUserToAddresses")
}

func TestParseInputWithPolymorphicFieldEdgeNotIndexed(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						DerivedFields: []*input.Field{
							{
								Name: "ownerType",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						Polymorphic: &input.PolymorphicOptions{
							Types: []string{"user"},
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	assert.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	assert.NotNil(t, ownerEdge)

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("ownerIDS")
	assert.Nil(t, indexedEdge)
	assert.Len(t, userCfg.NodeData.EdgeInfo.DestinationEdges, 0)
}

func TestWithPatterns(t *testing.T) {
	n := &input.Node{
		Fields: []*input.Field{
			{
				Name: "id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				PrimaryKey: true,
			},
		},
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "likers",
				SchemaName: "User",
				InverseEdge: &input.InverseAssocEdge{
					Name: "likes",
					// using non-default names
					EdgeConstName: "UserToLikedObjects",
				},
				// using non-default names
				// TODO should throw if we reuse names. this was originally PostToLikers and we have PostToLikers based on object using this
				EdgeConstName: "LikedPostToLikers",
				PatternName:   "Likes",
			},
		},
	}

	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Post":  n,
			"Group": n,
		},
		Patterns: map[string]*input.Pattern{
			"node": {
				Name: "node",
			},
			"likes": {
				Name: "likes",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "likers",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name:          "likes",
							EdgeConstName: "UserToLikedObjects",
						},
						EdgeConstName: "LikedPostToLikers",
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 3)

	assert.Len(t, schema.Patterns, 2)

	newEdges := schema.GetNewEdges()
	// 2 new edges. inverse and not inverse
	// regardless of how many things use the pattern

	assert.Len(t, newEdges, 2)

	edge0 := newEdges[0]
	assert.Equal(t, edge0.EdgeName, "LikedPostToLikersEdge")
	assert.False(t, edge0.SymmetricEdge)
	assert.NotNil(t, edge0.InverseEdgeType)
	assert.Equal(t, edge0.EdgeTable, "object_likers_edges")

	edge1 := newEdges[1]
	assert.Equal(t, edge1.EdgeName, "UserToLikedObjectsEdge")
	assert.False(t, edge1.SymmetricEdge)
	assert.NotNil(t, edge1.InverseEdgeType)
	assert.Equal(t, edge1.EdgeTable, "object_likers_edges")

	assert.Equal(t, edge0.InverseEdgeType.String, string(edge1.EdgeType))
	assert.Equal(t, edge1.InverseEdgeType.String, string(edge0.EdgeType))

	userCfg := schema.Nodes["User"]
	// user node and inverse edge
	testConsts(t, userCfg.NodeData.ConstantGroups, 1, 1)

	// likes edge added
	likesEdge := userCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likes")
	require.NotNil(t, likesEdge)
	assert.Len(t, userCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "UserToLikedObjects", likesEdge.TsEdgeConst)

	assert.Equal(t, tsimport.NewEntImportPath("AssocEdge"), likesEdge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "UserToLikedObjectsQueryBase", likesEdge.EdgeQueryBase())
	assert.Equal(t, "UserToLikedObjectsEdge", likesEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "UserToLikedObjectsQuery", likesEdge.TsEdgeQueryName())
	assert.False(t, likesEdge.CreateEdge())
	assert.True(t, likesEdge.PolymorphicEdge())

	postInfo := schema.Nodes["Post"]
	//	post node and no edge
	testConsts(t, postInfo.NodeData.ConstantGroups, 1, 0)
	likersEdge := postInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge)
	assert.Len(t, postInfo.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "LikedPostToLikers", likersEdge.TsEdgeConst)
	assert.Equal(t, tsimport.NewLocalEntImportPath("LikedPostToLikersEdge"), likersEdge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "LikedPostToLikersQuery", likersEdge.EdgeQueryBase())
	assert.Equal(t, "PostToLikersEdge", likersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "PostToLikersQuery", likersEdge.TsEdgeQueryName())
	assert.False(t, likersEdge.CreateEdge())
	assert.False(t, likersEdge.PolymorphicEdge())

	// group node and no edge
	groupInfo := schema.Nodes["Group"]
	testConsts(t, groupInfo.NodeData.ConstantGroups, 1, 0)
	likersEdge2 := groupInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge2)
	assert.Len(t, groupInfo.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "LikedPostToLikers", likersEdge2.TsEdgeConst)
	assert.Equal(t, tsimport.NewLocalEntImportPath("LikedPostToLikersEdge"), likersEdge2.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "LikedPostToLikersQuery", likersEdge2.EdgeQueryBase())
	assert.Equal(t, "GroupToLikersEdge", likersEdge2.TsEdgeQueryEdgeName())
	assert.Equal(t, "GroupToLikersQuery", likersEdge2.TsEdgeQueryName())
	assert.False(t, likersEdge2.CreateEdge())
	assert.False(t, likersEdge2.PolymorphicEdge())

	// nothing for node
	testConsts(t, schema.Patterns["node"].ConstantGroups, 0, 0)

	// no node and 1 edge
	likersPattern := schema.Patterns["likes"]
	testConsts(t, likersPattern.ConstantGroups, 0, 1)
	patternLikersEdge := likersPattern.AssocEdges["likers"]
	require.NotNil(t, patternLikersEdge)
	assert.Equal(t, "LikedPostToLikers", patternLikersEdge.TsEdgeConst)
	assert.Equal(t, tsimport.NewEntImportPath("AssocEdge"), patternLikersEdge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "LikedPostToLikersQueryBase", patternLikersEdge.EdgeQueryBase())
	assert.Equal(t, "LikedPostToLikersEdge", patternLikersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "LikedPostToLikersQuery", patternLikersEdge.TsEdgeQueryName())
	assert.True(t, patternLikersEdge.CreateEdge())
	assert.False(t, patternLikersEdge.PolymorphicEdge())
}

func TestWithMultipleEnumsInPattern(t *testing.T) {
	n := &input.Node{
		Fields: []*input.Field{
			{
				Name: "id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				PrimaryKey: true,
			},
			{
				Name: "DayOfWeek",
				Type: &input.FieldType{
					Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
					DBType:      input.StringEnum,
					Type:        "DayOfWeek",
					GraphQLType: "DayOfWeek",
				},
				PatternName: "days",
			},
			{
				Name: "DayOfWeekAlt",
				Type: &input.FieldType{
					Values:      []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"},
					DBType:      input.StringEnum,
					Type:        "DayOfWeekAlt",
					GraphQLType: "DayOfWeekAlt",
				},
				PatternName: "days",
				Nullable:    true,
			},
		},
	}

	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"Event": n,
			"Group": n,
		},
		Patterns: map[string]*input.Pattern{
			"days": {
				Name: "days",
				Fields: []*input.Field{
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
							DBType:      input.StringEnum,
							Type:        "DayOfWeek",
							GraphQLType: "DayOfWeek",
						},
						PatternName: "days",
					},
					{
						Name: "DayOfWeekAlt",
						Type: &input.FieldType{
							Values:      []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"},
							DBType:      input.StringEnum,
							Type:        "DayOfWeekAlt",
							GraphQLType: "DayOfWeekAlt",
						},
						PatternName: "days",
						Nullable:    true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	assert.Len(t, schema.Patterns, 1)

	assert.Len(t, schema.Enums, 2)
	for _, info := range schema.Enums {
		assert.NotNil(t, info.GQLEnum)
		assert.Regexp(t, info.GQLEnum.Name, "DayOfWeekAlt")
	}
}

func TestWithEnumInPatternHiddenFromGraphQL(t *testing.T) {
	n := &input.Node{
		Fields: []*input.Field{
			{
				Name: "id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				PrimaryKey: true,
			},
			{
				Name: "DayOfWeek",
				Type: &input.FieldType{
					Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
					DBType:      input.StringEnum,
					Type:        "DayOfWeek",
					GraphQLType: "DayOfWeek",
				},
				HideFromGraphQL: true,
				PatternName:     "days",
			},
		},
	}

	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"Event": n,
			"Group": n,
		},
		Patterns: map[string]*input.Pattern{
			"days": {
				Name: "days",
				Fields: []*input.Field{
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
							DBType:      input.StringEnum,
							Type:        "DayOfWeek",
							GraphQLType: "DayOfWeek",
						},
						PatternName:     "days",
						HideFromGraphQL: true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	assert.Len(t, schema.Patterns, 1)

	assert.Len(t, schema.Enums, 1)
	for _, info := range schema.Enums {
		assert.Nil(t, info.GQLEnum)
		assert.Equal(t, info.Enum.Name, "DayOfWeek")
	}
}

func TestWithEnumFromField(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
							DBType:      input.StringEnum,
							Type:        "DayOfWeek",
							GraphQLType: "DayOfWeek",
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	assert.Len(t, schema.Patterns, 0)

	assert.Len(t, schema.Enums, 1)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.NotNil(t, enum.GQLEnum)
		assert.Equal(t, enum.Enum.Name, "DayOfWeek")
		assert.Equal(t, enum.GQLEnum.Name, "DayOfWeek")
	}
	tsEnums := schema.Nodes["Event"].NodeData.GetTSEnums()
	require.Len(t, tsEnums, 1)
}

func TestWithEnumFromFieldHiddenFromGraphQL(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
							DBType:      input.StringEnum,
							Type:        "DayOfWeek",
							GraphQLType: "DayOfWeek",
						},
						HideFromGraphQL: true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	assert.Len(t, schema.Patterns, 0)

	assert.Len(t, schema.Enums, 1)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.Equal(t, enum.Enum.Name, "DayOfWeek")
		assert.Nil(t, enum.GQLEnum)
	}
	tsEnums := schema.Nodes["Event"].NodeData.GetTSEnums()
	require.Len(t, tsEnums, 1)
}

func TestWithInverseFieldEdgeInPatterns(t *testing.T) {
	n := &input.Node{
		Fields: []*input.Field{
			{
				Name: "id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				PrimaryKey: true,
			},
			{
				Name: "foo_id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				FieldEdge: &input.FieldEdge{
					Schema: "User",
					InverseEdge: &input.InverseFieldEdge{
						Name: "foos",
					},
				},
				PatternName: "foo_pattern",
			},
		},
		Patterns: []string{"foo_pattern"},
	}

	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Post":  n,
			"Group": n,
		},
		Patterns: map[string]*input.Pattern{
			"node": {
				Name: "node",
			},
			"foo_pattern": {
				Name: "foo_pattern",
				Fields: []*input.Field{
					{
						Name: "foo_id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							InverseEdge: &input.InverseFieldEdge{
								Name: "foos",
							},
						},
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 3)

	assert.Len(t, schema.Patterns, 2)

	newEdges := schema.GetNewEdges()
	// 1 new edge. the inverse edge created

	assert.Len(t, newEdges, 1)

	edge0 := newEdges[0]
	assert.Equal(t, edge0.EdgeName, "UserToFoosEdge")
	assert.False(t, edge0.SymmetricEdge)
	assert.False(t, edge0.InverseEdgeType.Valid)
	assert.Equal(t, edge0.EdgeTable, "user_foos_edges")

	userCfg := schema.Nodes["User"]
	// user node and edge
	testConsts(t, userCfg.NodeData.ConstantGroups, 1, 1)

	// real edge
	edge := userCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("foos")
	require.NotNil(t, edge)
	assert.Len(t, userCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "UserToFoos", edge.TsEdgeConst)
	assert.Equal(t, tsimport.NewEntImportPath("AssocEdge"), edge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "UserToFoosQueryBase", edge.EdgeQueryBase())
	assert.Equal(t, "UserToFoosEdge", edge.TsEdgeQueryEdgeName())
	assert.Equal(t, "UserToFoosQuery", edge.TsEdgeQueryName())
	// edge created from field. needs to return true
	assert.True(t, edge.CreateEdge())
	// polymorphic because id2 can be anything since contained in pattern
	assert.True(t, edge.PolymorphicEdge())
	assert.Equal(t, "UserToFoosConnection", edge.GetGraphQLConnectionName())
	assert.Equal(t, edge.GetTSGraphQLTypeImports(), []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalEntConnectionImportPath("UserToFoosConnection"),
	})
	assert.Equal(t, "Foos", edge.CamelCaseEdgeName())
	assert.Equal(t, "Ent", edge.NodeInfo.Node)

	postInfo := schema.Nodes["Post"]
	//	post node and no edge
	testConsts(t, postInfo.NodeData.ConstantGroups, 1, 0)

	// group node and no edge
	groupInfo := schema.Nodes["Group"]
	testConsts(t, groupInfo.NodeData.ConstantGroups, 1, 0)

	// nothing for node
	testConsts(t, schema.Patterns["node"].ConstantGroups, 0, 0)

	// no node and 0 edge
	p1 := schema.Patterns["foo_pattern"]
	testConsts(t, p1.ConstantGroups, 0, 0)
}

func testConsts(t *testing.T, cg map[string]*schema.ConstGroupInfo, nodeCt, edgeCt int) {
	if cg == nil {
		assert.Equal(t, nodeCt, 0)
		assert.Equal(t, edgeCt, 0)
		return
	}

	node := cg["ent.NodeType"]
	if nodeCt == 0 {
		assert.Nil(t, node, 0)
	} else {
		require.NotNil(t, node)
		assert.Len(t, node.Constants, nodeCt)
	}
	edge := cg["ent.EdgeType"]
	if edgeCt == 0 {
		assert.Nil(t, edge, 0)
	} else {
		require.NotNil(t, edge)
		assert.Len(t, edge.Constants, edgeCt)
	}
}

func TestWithPatternsNoEdgeConstName(t *testing.T) {
	n := &input.Node{
		Fields: []*input.Field{
			{
				Name: "id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				PrimaryKey: true,
			},
		},
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "likers",
				SchemaName: "User",
				InverseEdge: &input.InverseAssocEdge{
					Name: "likes",
				},
				PatternName: "Likes",
			},
		},
	}

	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Post":  n,
			"Group": n,
		},
		Patterns: map[string]*input.Pattern{
			"node": {
				Name: "node",
			},
			"likes": {
				Name: "likes",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "likers",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "likes",
						},
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 3)

	assert.Len(t, schema.Patterns, 2)
	newEdges := schema.GetNewEdges()
	// 2 new edges. inverse and not inverse
	// regardless of how many things use the pattern

	assert.Len(t, newEdges, 2)
	edge0 := newEdges[0]
	assert.Equal(t, edge0.EdgeName, "ObjectToLikersEdge")
	assert.False(t, edge0.SymmetricEdge)
	assert.NotNil(t, edge0.InverseEdgeType)
	assert.Equal(t, edge0.EdgeTable, "object_likers_edges")

	edge1 := newEdges[1]
	assert.Equal(t, edge1.EdgeName, "UserToLikesEdge")
	assert.False(t, edge1.SymmetricEdge)
	assert.NotNil(t, edge1.InverseEdgeType)
	assert.Equal(t, edge1.EdgeTable, "object_likers_edges")

	assert.Equal(t, edge0.InverseEdgeType.String, string(edge1.EdgeType))
	assert.Equal(t, edge1.InverseEdgeType.String, string(edge0.EdgeType))

	userCfg := schema.Nodes["User"]
	// user node and inverse edge
	testConsts(t, userCfg.NodeData.ConstantGroups, 1, 1)

	// likes edge added
	likesEdge := userCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likes")
	require.NotNil(t, likesEdge)
	assert.Len(t, userCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "UserToLikes", likesEdge.TsEdgeConst)
	assert.Equal(t, tsimport.NewEntImportPath("AssocEdge"), likesEdge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "UserToLikesQueryBase", likesEdge.EdgeQueryBase())
	assert.Equal(t, "UserToLikesEdge", likesEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "UserToLikesQuery", likesEdge.TsEdgeQueryName())
	assert.False(t, likesEdge.CreateEdge())
	assert.True(t, likesEdge.PolymorphicEdge())

	postInfo := schema.Nodes["Post"]
	//	post node and no edge
	testConsts(t, postInfo.NodeData.ConstantGroups, 1, 0)
	likersEdge := postInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge)
	assert.Len(t, postInfo.NodeData.EdgeInfo.Associations, 1)
	// these 3 are wrong and lead to codegen issues
	assert.Equal(t, "ObjectToLikers", likersEdge.TsEdgeConst)
	assert.Equal(t, tsimport.NewLocalEntImportPath("ObjectToLikersEdge"), likersEdge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "ObjectToLikersQuery", likersEdge.EdgeQueryBase())
	assert.Equal(t, "PostToLikersEdge", likersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "PostToLikersQuery", likersEdge.TsEdgeQueryName())
	assert.False(t, likersEdge.CreateEdge())
	assert.False(t, likersEdge.PolymorphicEdge())

	// group node and no edge
	groupInfo := schema.Nodes["Group"]
	testConsts(t, groupInfo.NodeData.ConstantGroups, 1, 0)
	likersEdge2 := groupInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge2)
	assert.Len(t, groupInfo.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "ObjectToLikers", likersEdge2.TsEdgeConst)
	assert.Equal(t, tsimport.NewLocalEntImportPath("ObjectToLikersEdge"), likersEdge2.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "ObjectToLikersQuery", likersEdge2.EdgeQueryBase())
	assert.Equal(t, "GroupToLikersEdge", likersEdge2.TsEdgeQueryEdgeName())
	assert.Equal(t, "GroupToLikersQuery", likersEdge2.TsEdgeQueryName())
	assert.False(t, likersEdge2.CreateEdge())
	assert.False(t, likersEdge2.PolymorphicEdge())

	// nothing for node
	testConsts(t, schema.Patterns["node"].ConstantGroups, 0, 0)

	// no node and 1 edge
	likersPattern := schema.Patterns["likes"]
	testConsts(t, likersPattern.ConstantGroups, 0, 1)
	patternLikersEdge := likersPattern.AssocEdges["likers"]
	require.NotNil(t, patternLikersEdge)
	assert.Equal(t, "ObjectToLikers", patternLikersEdge.TsEdgeConst)
	assert.Equal(t, tsimport.NewEntImportPath("AssocEdge"), patternLikersEdge.AssocEdgeBaseImport(&codegenapi.DummyConfig{}))
	assert.Equal(t, "ObjectToLikersQueryBase", patternLikersEdge.EdgeQueryBase())
	assert.Equal(t, "ObjectToLikersEdge", patternLikersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "ObjectToLikersQuery", patternLikersEdge.TsEdgeQueryName())
	assert.True(t, patternLikersEdge.CreateEdge())
	assert.False(t, patternLikersEdge.PolymorphicEdge())
}

func TestDuplicateNames(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"Profile": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "userPrefs",
						Type: &input.FieldType{
							DBType: input.JSONB,
							// should conflict
							Type:        "Profile",
							GraphQLType: "Profile",
							SubFields: []*input.Field{
								{
									Name: "finishedNux",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "enableNotifs",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "notifTypes",
									Type: &input.FieldType{
										DBType: input.List,
										ListElemType: &input.FieldType{
											Type:        "NotifType",
											GraphQLType: "NotifType",
											DBType:      input.StringEnum,
											Values:      []string{"MOBILE", "WEB", "EMAIL"},
										},
									},
									Nullable: true,
								},
							},
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation: ent.CreateAction,
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, base.GoLang)
	require.Nil(t, schema)
	require.Equal(t, err.Error(), "there's already an entity with GraphQL name ProfileType")
}

func TestMultipleActionsHiddenFromGraphQL(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation: ent.CreateAction,
					},
					{
						Operation:        ent.CreateAction,
						HideFromGraphQL:  true,
						CustomInputName:  "CustomCreateUserInput",
						CustomActionName: "CustomCreateHolidayAction",
					},
				},
			},
			"Note": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "body",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation:       ent.DeleteAction,
						HideFromGraphQL: true,
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	user := schema.Nodes["User"]
	assert.NotNil(t, user)

	note := schema.Nodes["Note"]
	assert.NotNil(t, note)

	assert.Len(t, user.NodeData.ActionInfo.Actions, 2)
	assert.Len(t, note.NodeData.ActionInfo.Actions, 1)
}

func TestParseInputWithIndexedEdgeTypeNoOptIn(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Equal(t, "OwnerToAddressesConnection", addressesEdge.GetGraphQLConnectionName())
	assert.Equal(t, "OwnerToAddresses", addressesEdge.GetGraphQLEdgePrefix())

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.Nil(t, indexedEdge)
}

func TestParseInputWithIndexedEdgeType(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							IndexEdge: &input.IndexEdgeOptions{
								Name: "Addresses",
							},
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Equal(t, "OwnerToAddressesConnection", addressesEdge.GetGraphQLConnectionName())
	assert.Equal(t, "OwnerToAddresses", addressesEdge.GetGraphQLEdgePrefix())

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.NotNil(t, indexedEdge)

	assert.Equal(t, indexedEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")

	assert.Equal(t, indexedEdge.GetGraphQLConnectionName(), "OwnerToAddressesConnection")
	assert.Equal(t, "OwnerToAddresses", indexedEdge.GetGraphQLEdgePrefix())
}

func TestParseInputWithMultipleIndexedEdgeType(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							IndexEdge: &input.IndexEdgeOptions{
								Name: "Addresses",
							},
						},
					},
					{
						Name: "fooID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							IndexEdge: &input.IndexEdgeOptions{
								Name: "FooAddresses",
							},
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Equal(t, "OwnerToAddressesConnection", addressesEdge.GetGraphQLConnectionName())
	assert.Equal(t, "OwnerToAddresses", addressesEdge.GetGraphQLEdgePrefix())

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.NotNil(t, indexedEdge)

	assert.Equal(t, indexedEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")

	assert.Equal(t, indexedEdge.GetGraphQLConnectionName(), "OwnerToAddressesConnection")
	assert.Equal(t, "OwnerToAddresses", indexedEdge.GetGraphQLEdgePrefix())

	fooEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("fooIDS")
	require.NotNil(t, fooEdge)
	assert.Equal(t, fooEdge.TsEdgeQueryName(), "FooToAddressesQuery")

	assert.Equal(t, fooEdge.GetGraphQLConnectionName(), "FooToAddressesConnection")
	assert.Equal(t, "FooToAddresses", fooEdge.GetGraphQLEdgePrefix())

	indexedEdge2 := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("FooAddresses")
	assert.NotNil(t, indexedEdge2)

	assert.Equal(t, indexedEdge2.TsEdgeQueryName(), "FooToAddressesQuery")

	assert.Equal(t, indexedEdge2.GetGraphQLConnectionName(), "FooToAddressesConnection")
	assert.Equal(t, "FooToAddresses", indexedEdge2.GetGraphQLEdgePrefix())
}

func TestParseInputWithMultipleIndexedEdgeNoOptIn(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
						},
					},
					{
						Name: "fooID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Equal(t, "OwnerToAddressesConnection", addressesEdge.GetGraphQLConnectionName())
	assert.Equal(t, "OwnerToAddresses", addressesEdge.GetGraphQLEdgePrefix())

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.Nil(t, indexedEdge)
}

func TestParseInputWithMultipleIndexedEdgeTypeCollision(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							IndexEdge: &input.IndexEdgeOptions{
								Name: "Addresses",
							},
						},
					},
					{
						Name: "fooID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							IndexEdge: &input.IndexEdgeOptions{
								Name: "Addresses",
							},
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Error(t, err)
	require.Nil(t, schema)
}

func TestParseInputWithNonIndexedFieldEdgeType(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Address": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "ownerID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						FieldEdge: &input.FieldEdge{
							Schema: "User",
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressInfo := schema.Nodes["Address"]
	require.NotNil(t, addressInfo)

	ownerEdge := addressInfo.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	require.NotNil(t, ownerEdge)
	addressesEdge := addressInfo.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("ownerIDS")
	require.Nil(t, addressesEdge)

	userCfg := schema.Nodes["User"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.Nil(t, indexedEdge)
}

func TestParseInputWithIndexedFieldEdge(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index:     true,
						FieldEdge: &input.FieldEdge{Schema: "User", InverseEdge: &input.InverseFieldEdge{Name: "CreatedEvents"}},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)
	assert.Equal(t, userEdge.NodeInfo.Node, "User")
	assert.Equal(t, userEdge.InverseEdge.Name, "CreatedEvents")

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	eventsEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("CreatedEvents")
	assert.NotNil(t, eventsEdge)
	assert.Equal(t, eventsEdge.NodeInfo.Node, "Event")

	// 2 nodes, 1 edge
	testConsts(t, eventInfo.NodeData.ConstantGroups, 1, 0)
	testConsts(t, userInfo.NodeData.ConstantGroups, 1, 1)
}

func TestParseInputWithIndexedFieldEdgeAndIndexEdge(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
				},
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						Index: true,
						FieldEdge: &input.FieldEdge{
							Schema: "User",
							// no reason to do this twice lol...
							InverseEdge: &input.InverseFieldEdge{Name: "CreatedEvents"},
							IndexEdge: &input.IndexEdgeOptions{
								Name: "createdEvents2",
							},
						},
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	eventInfo := schema.Nodes["Event"]
	assert.NotNil(t, eventInfo)

	userEdge := eventInfo.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)
	assert.Equal(t, userEdge.NodeInfo.Node, "User")
	assert.Equal(t, userEdge.InverseEdge.Name, "CreatedEvents")

	userInfo := schema.Nodes["User"]
	assert.NotNil(t, userInfo)

	eventsEdge := userInfo.NodeData.EdgeInfo.GetAssociationEdgeByName("CreatedEvents")
	assert.NotNil(t, eventsEdge)
	assert.Equal(t, eventsEdge.NodeInfo.Node, "Event")

	// 2 nodes, 1 edge
	testConsts(t, eventInfo.NodeData.ConstantGroups, 1, 0)
	testConsts(t, userInfo.NodeData.ConstantGroups, 1, 1)

	eventsEdge2 := userInfo.NodeData.EdgeInfo.GetIndexedEdgeByName("createdEvents2")
	require.NotNil(t, eventsEdge2)
	assert.Equal(t, eventsEdge2.TsEdgeQueryName(), "UserToEventsQuery")
	assert.Equal(t, "UserToEventsConnection", eventsEdge2.GetGraphQLConnectionName())
	assert.Equal(t, "UserToEvents", eventsEdge2.GetGraphQLEdgePrefix())
}
