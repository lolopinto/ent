package testmodel

import (
	"sync"
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	testsync "github.com/lolopinto/ent/internal/testingutils/sync"

	"github.com/lolopinto/ent/ent"
	"github.com/stretchr/testify/require"
)

var rSchema *testsync.RunOnce

var schemaOnce sync.Once

func initSyncs() {
	schemaOnce.Do(func() {

		// this starts the process of converting the go model in internal/testdata/models/configs/ into new API format instead of storing as-is

		// TODO eventually kill this and inline everywhere. makes it easier to figure out what's going on
		// in each test
		rSchema = testsync.NewRunOnce(func(t *testing.T, _ string) interface{} {
			loginsServerDefault := "0"

			s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, &input.Schema{
				Nodes: map[string]*input.Node{
					"Account": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "FirstName",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
							{
								Name: "LastName",
								Type: &input.FieldType{
									DBType: input.String,
								},
								Index: true,
							},
							{
								Name: "PhoneNumber",
								Type: &input.FieldType{
									DBType: input.String,
								},
								Unique: true,
							},
							{
								Name: "NumberOfLogins",
								Type: &input.FieldType{
									DBType: input.Int,
								},
								HideFromGraphQL: true,
								ServerDefault:   &loginsServerDefault,
							},
							{
								Name: "LastLoginAt",
								Type: &input.FieldType{
									DBType: input.String,
								},
								StorageKey:  "last_login_time",
								GraphQLName: "lastLoginTime",
							},
							{
								Name: "Bio",
								Type: &input.FieldType{
									DBType: input.String,
								},
								Nullable: true,
							},
							{
								Name: "DateOfBirth",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								Nullable: true,
							},
							{
								Name: "ShowBioOnProfile",
								Type: &input.FieldType{
									DBType: input.Boolean,
								},
								Nullable: true,
							},
						},
						TableName: "accounts",
						Actions: []*input.Action{
							{
								Operation: ent.CreateAction,
							},
							{
								Operation: ent.EditAction,
							},
						},
						AssocEdges: []*input.AssocEdge{
							{
								Name:       "Folders",
								SchemaName: "Folder",
								EdgeActions: []*input.EdgeAction{
									{
										Operation:         ent.AddEdgeAction,
										CustomActionName:  "AccountAddFolderAction",
										CustomGraphQLName: "accountFolderAdd",
									},
									{
										Operation: ent.RemoveEdgeAction,
									},
								},
							},

							// TODO TodosAssoc
						},
						AssocEdgeGroups: []*input.AssocEdgeGroup{
							{
								Name:            "Friendships",
								GroupStatusName: "FriendshipStatus",
								AssocEdges: []*input.AssocEdge{
									{
										Name:       "FriendRequests",
										SchemaName: "Account",
										InverseEdge: &input.InverseAssocEdge{
											Name: "FriendRequestsReceived",
										},
									},
									{
										Name:       "Friends",
										SchemaName: "Account",
										Symmetric:  true,
									},
								},
								EdgeActions: []*input.EdgeAction{
									{
										Operation:         ent.AddEdgeAction,
										CustomActionName:  "AccountFriendshipStatusAction",
										CustomGraphQLName: "accountSetFriendshipStatus",
									},
								},
							},
						},
					},
					"Folder": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "Name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
							{
								Name: "AccountID",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								FieldEdge: &input.FieldEdge{
									Schema: "Account",
									InverseEdge: &input.InverseFieldEdge{
										Name: "Folders",
									},
								},
							},
							{
								Name: "NumberOfFiles",
								Type: &input.FieldType{
									DBType: input.Int,
								},
							},
						},
						AssocEdges: []*input.AssocEdge{
							{
								Name:       "Todos",
								SchemaName: "Todo",
								InverseEdge: &input.InverseAssocEdge{
									Name: "Folders",
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
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "Name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
							{
								Name: "UserID",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
							{
								Name: "StartTime",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "EndTime",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "Location",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						TableName: "events",
						AssocEdges: []*input.AssocEdge{
							{
								Name:       "Creator",
								SchemaName: "Account",
								Unique:     true,
							},
						},
						AssocEdgeGroups: []*input.AssocEdgeGroup{
							{
								Name:            "Rsvps",
								GroupStatusName: "RsvpStatus",
								TableName:       "event_rsvp_edges",
								ActionEdges:     []string{"Attending", "Declined"},
								AssocEdges: []*input.AssocEdge{
									{
										Name:       "Invited",
										SchemaName: "Account",
										InverseEdge: &input.InverseAssocEdge{
											Name: "InvitedEvents",
										},
									},
									{
										Name:       "Attending",
										SchemaName: "Account",
										InverseEdge: &input.InverseAssocEdge{
											Name: "Attending",
										},
									},
									{
										Name:       "Declined",
										SchemaName: "Account",
										InverseEdge: &input.InverseAssocEdge{
											Name: "DeclinedEvents",
										},
									},
								},
								EdgeActions: []*input.EdgeAction{
									{
										Operation:         ent.EdgeGroupAction,
										CustomActionName:  "EventRsvpAction",
										CustomGraphQLName: "eventRSVP",
									},
								},
							},
						},
					},
					"Todo": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "Completed",
								Type: &input.FieldType{
									DBType: input.Boolean,
								},
							},
							{
								Name: "Text",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
							{
								Name: "AccountID",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								ForeignKey: &input.ForeignKey{
									Schema: "Account",
									Column: "id",
								},
							},
						},
					},
				},
			}, base.TypeScript)
			require.Nil(t, err)
			return s
		})
	})
}

func GetSchema(t *testing.T) *schema.Schema {
	initSyncs()
	return rSchema.Get(t, "").(*schema.Schema)
}

func GetFieldFromSchema(t *testing.T, nodeName, fieldName string) *field.Field {
	s := GetSchema(t)
	info := s.Nodes[nodeName+"Config"]
	require.NotNil(t, info)
	f := info.NodeData.FieldInfo.GetFieldByName(fieldName)
	require.NotNil(t, f)
	return f
}

func GetActionFromSchema(t *testing.T, nodeName, actionName string) action.Action {
	s := GetSchema(t)
	info := s.Nodes[nodeName+"Config"]
	require.NotNil(t, info)
	a := info.NodeData.ActionInfo.GetByName(actionName)
	require.NotNil(t, a)
	return a
}

func GetActionInfoFromSchema(t *testing.T, nodeName string) *action.ActionInfo {
	s := GetSchema(t)
	info := s.Nodes[nodeName+"Config"]
	require.NotNil(t, info)
	actionInfo := info.NodeData.ActionInfo
	require.NotNil(t, actionInfo)
	return actionInfo
}

func GetEdgeFromSchema(t *testing.T, nodeName, edgeName string) *edge.AssociationEdge {
	s := GetSchema(t)
	info := s.Nodes[nodeName+"Config"]
	require.NotNil(t, info)
	edge := info.NodeData.EdgeInfo.GetAssociationEdgeByName(edgeName)
	require.NotNil(t, edge)
	return edge
}

func GetEdgeInfoFromSchema(t *testing.T, nodeName string) *edge.EdgeInfo {
	s := GetSchema(t)
	info := s.Nodes[nodeName+"Config"]
	require.NotNil(t, info)
	edgeInfo := info.NodeData.EdgeInfo
	require.NotNil(t, edgeInfo)
	return edgeInfo
}
