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
	schema, err := schema.ParseFromInputSchema(inputSchema, base.TypeScript)
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

	userCfg := schema.Nodes["UserConfig"]
	// user node and inverse edge
	testConsts(t, userCfg.NodeData.ConstantGroups, 1, 1)

	// likes edge added
	likesEdge := userCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likes")
	require.NotNil(t, likesEdge)
	assert.Len(t, userCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "UserToLikedObjects", likesEdge.TsEdgeConst)
	assert.Equal(t, "AssocEdge", likesEdge.AssocEdgeBase())
	assert.Equal(t, "UserToLikedObjectsQueryBase", likesEdge.EdgeQueryBase())
	assert.Equal(t, "UserToLikedObjectsEdge", likesEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "UserToLikedObjectsQuery", likesEdge.TsEdgeQueryName())
	assert.False(t, likesEdge.CreateEdge())
	assert.True(t, likesEdge.PolymorphicEdge())

	postCfg := schema.Nodes["PostConfig"]
	//	post node and no edge
	testConsts(t, postCfg.NodeData.ConstantGroups, 1, 0)
	likersEdge := postCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge)
	assert.Len(t, postCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "LikedPostToLikers", likersEdge.TsEdgeConst)
	assert.Equal(t, "LikedPostToLikersEdge", likersEdge.AssocEdgeBase())
	assert.Equal(t, "LikedPostToLikersQuery", likersEdge.EdgeQueryBase())
	assert.Equal(t, "PostToLikersEdge", likersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "PostToLikersQuery", likersEdge.TsEdgeQueryName())
	assert.False(t, likersEdge.CreateEdge())
	assert.False(t, likersEdge.PolymorphicEdge())

	// group node and no edge
	groupCfg := schema.Nodes["GroupConfig"]
	testConsts(t, groupCfg.NodeData.ConstantGroups, 1, 0)
	likersEdge2 := groupCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge2)
	assert.Len(t, groupCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "LikedPostToLikers", likersEdge2.TsEdgeConst)
	assert.Equal(t, "LikedPostToLikersEdge", likersEdge2.AssocEdgeBase())
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
	assert.Equal(t, "AssocEdge", patternLikersEdge.AssocEdgeBase())
	assert.Equal(t, "LikedPostToLikersQueryBase", patternLikersEdge.EdgeQueryBase())
	assert.Equal(t, "LikedPostToLikersEdge", patternLikersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "LikedPostToLikersQuery", patternLikersEdge.TsEdgeQueryName())
	assert.True(t, patternLikersEdge.CreateEdge())
	assert.False(t, patternLikersEdge.PolymorphicEdge())
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
	schema, err := schema.ParseFromInputSchema(inputSchema, base.TypeScript)
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

	userCfg := schema.Nodes["UserConfig"]
	// user node and inverse edge
	testConsts(t, userCfg.NodeData.ConstantGroups, 1, 1)

	// likes edge added
	likesEdge := userCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likes")
	require.NotNil(t, likesEdge)
	assert.Len(t, userCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "UserToLikes", likesEdge.TsEdgeConst)
	assert.Equal(t, "AssocEdge", likesEdge.AssocEdgeBase())
	assert.Equal(t, "UserToLikesQueryBase", likesEdge.EdgeQueryBase())
	assert.Equal(t, "UserToLikesEdge", likesEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "UserToLikesQuery", likesEdge.TsEdgeQueryName())
	assert.False(t, likesEdge.CreateEdge())
	assert.True(t, likesEdge.PolymorphicEdge())

	postCfg := schema.Nodes["PostConfig"]
	//	post node and no edge
	testConsts(t, postCfg.NodeData.ConstantGroups, 1, 0)
	likersEdge := postCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge)
	assert.Len(t, postCfg.NodeData.EdgeInfo.Associations, 1)
	// these 3 are wrong and lead to codegen issues
	assert.Equal(t, "ObjectToLikers", likersEdge.TsEdgeConst)
	assert.Equal(t, "ObjectToLikersEdge", likersEdge.AssocEdgeBase())
	assert.Equal(t, "ObjectToLikersQuery", likersEdge.EdgeQueryBase())
	assert.Equal(t, "PostToLikersEdge", likersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "PostToLikersQuery", likersEdge.TsEdgeQueryName())
	assert.False(t, likersEdge.CreateEdge())
	assert.False(t, likersEdge.PolymorphicEdge())

	// group node and no edge
	groupCfg := schema.Nodes["GroupConfig"]
	testConsts(t, groupCfg.NodeData.ConstantGroups, 1, 0)
	likersEdge2 := groupCfg.NodeData.EdgeInfo.GetAssociationEdgeByName("likers")
	require.NotNil(t, likersEdge2)
	assert.Len(t, groupCfg.NodeData.EdgeInfo.Associations, 1)
	assert.Equal(t, "ObjectToLikers", likersEdge2.TsEdgeConst)
	assert.Equal(t, "ObjectToLikersEdge", likersEdge2.AssocEdgeBase())
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
	assert.Equal(t, "AssocEdge", patternLikersEdge.AssocEdgeBase())
	assert.Equal(t, "ObjectToLikersQueryBase", patternLikersEdge.EdgeQueryBase())
	assert.Equal(t, "ObjectToLikersEdge", patternLikersEdge.TsEdgeQueryEdgeName())
	assert.Equal(t, "ObjectToLikersQuery", patternLikersEdge.TsEdgeQueryName())
	assert.True(t, patternLikersEdge.CreateEdge())
	assert.False(t, patternLikersEdge.PolymorphicEdge())
}
