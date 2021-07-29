package schema_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	// still config name because of artifact of go and old schema
	config := schema.Nodes["PickupLocationConfig"]
	assert.NotNil(t, config)

	nodeData := config.NodeData
	// no table name provided and one automatically generated
	assert.Equal(t, "pickup_locations", nodeData.TableName)

	// package name correct
	assert.Equal(t, "pickup_location", nodeData.PackageName)
	field, err := schema.GetFieldByName("PickupLocationConfig", "id")
	assert.Nil(t, err)
	assert.NotNil(t, field)
}

func TestParseInputWithOverridenTable(t *testing.T) {
	// rename of user -> accounts or something
	tableName := "accounts"
	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				TableName: &tableName,
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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	// still config name because of artifact of go and old schema
	eventConfig := schema.Nodes["EventConfig"]
	assert.NotNil(t, eventConfig)

	// hmm should there be a fieldEdge here? it seems like yes
	userEdge := eventConfig.NodeData.EdgeInfo.GetFieldEdgeByName("User")
	assert.NotNil(t, userEdge)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	eventsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Events")
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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

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

	// edge name is different since name was given
	createdEventsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("CreatedEvents")
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
	s, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)
	require.Error(t, err)
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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	// still config name because of artifact of go and old schema
	requestConfig := schema.Nodes["RequestConfig"]
	assert.NotNil(t, requestConfig)

	helperEdge := requestConfig.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, helperEdge)

	creatorEdge := requestConfig.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, creatorEdge)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	requestsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Requests")
	assert.NotNil(t, requestsEdge)

	helpedRequestsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("helpedRequests")
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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	// still config name because of artifact of go and old schema
	requestConfig := schema.Nodes["RequestConfig"]
	assert.NotNil(t, requestConfig)

	helperEdge := requestConfig.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, helperEdge)

	creatorEdge := requestConfig.NodeData.EdgeInfo.GetFieldEdgeByName("Helper")
	assert.NotNil(t, creatorEdge)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	requestsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("createdRequests")
	assert.NotNil(t, requestsEdge)

	helpedRequestsEdge := userConfig.NodeData.EdgeInfo.GetForeignKeyEdgeByName("helpedRequests")
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
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "CreatedEvents",
						SchemaName: "Event",
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
						FieldEdge: &input.FieldEdge{Schema: "User", InverseEdge: "CreatedEvents"},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.GoLang)

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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	addressCfg := schema.Nodes["AddressConfig"]
	assert.NotNil(t, addressCfg)

	ownerEdge := addressCfg.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
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
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressCfg := schema.Nodes["AddressConfig"]
	assert.NotNil(t, addressCfg)

	ownerEdge := addressCfg.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	assert.NotNil(t, ownerEdge)

	// this edge name doesn't make the most sense...
	addressesEdge := addressCfg.NodeData.EdgeInfo.GetEdgeQueryIndexedEdgeByName("Addresses")
	assert.NotNil(t, addressesEdge)
	assert.Equal(t, addressesEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")
	assert.Panics(t, func() {
		addressesEdge.GetGraphQLConnectionName()
	})

	userCfg := schema.Nodes["UserConfig"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.NotNil(t, indexedEdge)

	assert.Equal(t, indexedEdge.TsEdgeQueryName(), "OwnerToAddressesQuery")

	assert.Equal(t, indexedEdge.GetGraphQLConnectionName(), "UserToAddressesConnection")
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

	schema, err := schema.ParseFromInputSchema(inputSchema, base.TypeScript)

	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	addressCfg := schema.Nodes["AddressConfig"]
	assert.NotNil(t, addressCfg)

	ownerEdge := addressCfg.NodeData.EdgeInfo.GetFieldEdgeByName("owner")
	assert.NotNil(t, ownerEdge)

	userCfg := schema.Nodes["UserConfig"]
	assert.NotNil(t, userCfg)

	indexedEdge := userCfg.NodeData.EdgeInfo.GetIndexedEdgeByName("Addresses")
	assert.Nil(t, indexedEdge)
}
