package schema_test

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schema/testhelper"
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
					},
					{
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
					},
					{
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

// tests constraints and tests first step in validation
func TestPrimaryKeyFieldConstraint(t *testing.T) {
	testConstraints(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`,
			),
		},
		map[string]*schema.NodeData{
			"User": {
				Constraints: constraintsWithNodeConstraints("users"),
			},
		},
	)
}

func TestForeignKeyFieldConstraint(t *testing.T) {
	testConstraints(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`,
			),
			"contact.ts": testhelper.GetCodeWithSchema(
				`import {Field, StringType, BaseEntSchema, UUIDType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
						UUIDType({
							name: "ownerID",
							foreignKey: ["User", "ID"],
						}),
					];
				}
			`,
			),
		},
		map[string]*schema.NodeData{
			"User": {
				Constraints: constraintsWithNodeConstraints("users"),
			},
			"Contact": {
				Constraints: constraintsWithNodeConstraints(
					"contacts",
					&input.Constraint{
						Name:    "users_id_fkey",
						Type:    input.ForeignKey,
						Columns: []string{"ownerID"},
						ForeignKey: &input.ForeignKeyInfo{
							TableName: "users",
							Columns:   []string{"id"},
							OnDelete:  "CASCADE",
						},
					}),
			},
		},
	)
}

func TestUniqueFieldConstraint(t *testing.T) {
	testConstraints(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
						StringType({
							name: "emailAddress",
							unique: true,
						})
					];
				}
			`,
			),
		},
		map[string]*schema.NodeData{
			"User": {
				Constraints: constraintsWithNodeConstraints("users",
					&input.Constraint{
						Name:    "users_unique_email_address",
						Type:    input.Unique,
						Columns: []string{"emailAddress"},
					},
				),
			},
		},
	)
}

func TestConstraints(t *testing.T) {
	testCases := map[string]testCase{
		"multi-column-primary key": {
			code: map[string]string{
				"user_photo.ts": testhelper.GetCodeWithSchema(`
					import {Schema, Field, UUIDType, Constraint, ConstraintType} from "{schema}";

					export default class UserPhoto implements Schema {
						fields: Field[] = [
							UUIDType({
								name: 'UserID',
							}),
							UUIDType({
								name: 'PhotoID',
							}),
						];

						constraints: Constraint[] = [
							{
								name: "user_photos_pkey",
								type: ConstraintType.PrimaryKey,
								columns: ["UserID", "PhotoID"],
							},
						];
					}
				`),
			},
			expectedMap: map[string]*schema.NodeData{
				"UserPhoto": {
					Constraints: []*input.Constraint{
						{
							Name:    "user_photos_pkey",
							Type:    input.PrimaryKey,
							Columns: []string{"UserID", "PhotoID"},
						},
					},
				},
			},
		},
		"multi-column-unique key": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {Field, StringType, BaseEntSchema} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
						];
					}
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
								foreignKey: ["User", "ID"],
							}),
						];

						constraints: Constraint[] = [
							{
								name: "contacts_unique_email",
								type: ConstraintType.Unique,
								columns: ["emailAddress", "userID"],
							},
						];
					}
				`),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
				},
				"Contact": {
					Constraints: constraintsWithNodeConstraints("contacts",
						&input.Constraint{
							Name:    "users_id_fkey",
							Type:    input.ForeignKey,
							Columns: []string{"userID"},
							ForeignKey: &input.ForeignKeyInfo{
								TableName: "users",
								Columns:   []string{"id"},
								OnDelete:  "CASCADE",
							},
						},
						&input.Constraint{
							Name:    "contacts_unique_email",
							Type:    input.Unique,
							Columns: []string{"emailAddress", "userID"},
						}),
				},
			},
		},
		"multi-column-foreign key": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {Field, StringType, BaseEntSchema} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
							StringType({
								name: 'emailAddress',
								unique: true,
							}),
						];
					}
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
							}),
						];

						constraints: Constraint[] = [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID", "emailAddress"],
								fkey: {
									tableName: "users", // hmm TODO not a tableName...
									ondelete: "CASCADE",
									columns: ["ID", "emailAddress"],
								}
							},
						];
					}
				`),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users", &input.Constraint{
						Name:    "users_unique_email_address",
						Type:    input.Unique,
						Columns: []string{"emailAddress"},
					}),
				},
				"Contact": {
					Constraints: constraintsWithNodeConstraints("contacts",
						&input.Constraint{
							Name:    "contacts_user_fkey",
							Type:    input.ForeignKey,
							Columns: []string{"userID", "emailAddress"},
							ForeignKey: &input.ForeignKeyInfo{
								TableName: "users",
								Columns:   []string{"ID", "emailAddress"},
								OnDelete:  "CASCADE",
							},
						},
					),
				},
			},
		},
		"check constraint no columns": {
			code: map[string]string{
				"item.ts": testhelper.GetCodeWithSchema(`
					import {Field, FloatType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class Item extends BaseEntSchema {
						fields: Field[] = [
							FloatType({
								name: 'price',
							}),
						];

						constraints: Constraint[] = [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								condition: 'price > 0',
								columns: [],
							},
						];
					}`),
			},
			expectedMap: map[string]*schema.NodeData{
				"Item": {
					Constraints: constraintsWithNodeConstraints("items", &input.Constraint{
						Name:      "item_positive_price",
						Type:      input.Check,
						Columns:   []string{},
						Condition: "price > 0",
					}),
				},
			},
		},
		"check constraint multiple columns": {
			code: map[string]string{
				"item.ts": testhelper.GetCodeWithSchema(`
					import {Field, FloatType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class Item extends BaseEntSchema {
						fields: Field[] = [
							FloatType({
								name: 'price',
							}),
							FloatType({
								name: 'discount_price',
							}),
						];

						constraints: Constraint[] = [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								// TODO condition is required when type == Check
								condition: 'price > 0',
								// TODO need to test this later when we have mixed everything in since we may not
								// want this...
								columns: ['price'],
							},
							{
								name: "item_positive_discount_price",
								type: ConstraintType.Check,
								// TODO condition is required when type == Check
								condition: 'discount_price > 0',
								columns: ['discount_price'],
							},
							{
								name: "item_price_greater_than_discount",
								type: ConstraintType.Check,
								// TODO condition is required when type == Check
								condition: 'price > discount_price',
								columns: ['price', 'discount_price'],
							},
						];
					}`),
			},
			expectedMap: map[string]*schema.NodeData{
				"Item": {
					Constraints: constraintsWithNodeConstraints("items", &input.Constraint{
						Name:      "item_positive_price",
						Type:      input.Check,
						Columns:   []string{"price"},
						Condition: "price > 0",
					},
						&input.Constraint{
							Name:      "item_positive_discount_price",
							Type:      input.Check,
							Columns:   []string{"discount_price"},
							Condition: "discount_price > 0",
						},
						&input.Constraint{
							Name:      "item_price_greater_than_discount",
							Type:      input.Check,
							Columns:   []string{"price", "discount_price"},
							Condition: "price > discount_price",
						}),
				},
			},
		},
	}

	runTestCases(t, testCases)
}

type testCase struct {
	code        map[string]string
	expectedMap map[string]*schema.NodeData
}

func runTestCases(t *testing.T, testCases map[string]testCase) {
	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			testConstraints(t, tt.code, tt.expectedMap)
		})
	}
}

func testConstraints(t *testing.T, code map[string]string, expectedMap map[string]*schema.NodeData) {
	absPath, err := filepath.Abs(".")
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(
		t,
		absPath,
		code,
		base.TypeScript,
	)

	for k, expNodeData := range expectedMap {
		info := schema.Nodes[k+"Config"]
		require.NotNil(t, info, "expected %s to exist in schema", k)
		nodeData := info.NodeData

		expConstraints := expNodeData.Constraints
		constraints := nodeData.Constraints

		assert.Len(t, constraints, len(expConstraints))

		for i, expConstraint := range expConstraints {
			constraint := constraints[i]

			assert.Equal(t, expConstraint.Name, constraint.Name)
			assert.Equal(t, expConstraint.Columns, constraint.Columns)
			assert.Equal(t, expConstraint.Type, constraint.Type)
			assert.Equal(t, expConstraint.Condition, constraint.Condition)

			if expConstraint.ForeignKey == nil {
				require.Nil(t, constraint.ForeignKey)
			} else {
				require.NotNil(t, constraint.ForeignKey)

				assert.Equal(t, expConstraint.ForeignKey.TableName, constraint.ForeignKey.TableName)
				assert.Equal(t, expConstraint.ForeignKey.OnDelete, constraint.ForeignKey.OnDelete)
				assert.Equal(t, expConstraint.ForeignKey.Columns, constraint.ForeignKey.Columns)
			}
		}
	}
}

func constraintsWithNodeConstraints(tableName string, constraints ...*input.Constraint) []*input.Constraint {
	return append([]*input.Constraint{
		{
			Name:    fmt.Sprintf("%s_id_pkey", tableName),
			Type:    input.PrimaryKey,
			Columns: []string{"ID"},
		},
	}, constraints...)
}
