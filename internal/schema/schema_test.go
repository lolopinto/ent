package schema_test

import (
	"database/sql"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInverseFieldEdge(t *testing.T) {
	s := testhelper.ParseSchemaForTestFixed(t,
		map[string]string{
			"account_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType} from "{schema}";

			const AccountSchema = new EntSchema({
				fields: {
					firstName: StringType(),
				},

				edges: [
					{
						name: 'Todos',
						schemaName: 'Todo',
					},
				],
			});
			export default AccountSchema;
			`),
			"todo_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, UUIDType} from "{schema}";

			const TodoSchema = new EntSchema({
				fields: {
					text: StringType(),
					accountID: UUIDType({
						fieldEdge: {
							schema: 'Account',
							inverseEdge: 'Todos',
						}
					}),
				},

				edges: [
					{
						name: 'Todos',
						schemaName: 'Todo',
					},
				],
			});
			export default TodoSchema;
			`),
		})
	textField := getFieldFromSchema(t, s, "Todo", "text")

	require.Nil(t, textField.GetInverseEdge(), "expected the text field to have no inverse edge. instead it did")

	// creating a fieldEdge above does 2 things:
	// 	1. it adds an inverse edge to the field
	accountField := getFieldFromSchema(t, s, "Todo", "accountID")
	inverseEdge := accountField.GetInverseEdge()
	require.NotNil(
		t,
		inverseEdge,
		"expected the account field to have an inverse edge. it didn't",
	)

	assert.Equal(
		t,
		"AccountToTodosEdge",
		inverseEdge.EdgeConst,
		"inverse edge const not as expected, expected %s, got %s",
		"AccountToTodosEdge",
		inverseEdge.EdgeConst,
	)
	assert.Equal(
		t,
		"Todos",
		inverseEdge.EdgeName,
		"inverse edge name not as expected, expected %s, got %s",
		"Todos",
		inverseEdge.EdgeName,
	)
	assert.Equal(
		t,
		"Account",
		inverseEdge.NodeInfo.Node,
		"Node at the end of inverse edge should be %s, got %s instead",
		"Account",
		inverseEdge.NodeInfo.Node,
	)

	// 2. adds a fieldEdge on source edgeInfo
	todo, err := s.GetNodeDataForNode("Todo")
	require.Nil(t, err)
	require.NotNil(t, todo)
	accountEdge := todo.EdgeInfo.GetFieldEdgeByName("account")
	require.NotNil(t, accountEdge)
	assert.Equal(t, "account", accountEdge.EdgeName)
	assert.Equal(t, "AccountConfig", accountEdge.GetEntConfig().ConfigName)
}

func TestForeignKey(t *testing.T) {
	s := testhelper.ParseSchemaForTestFixed(t,
		map[string]string{
			"account_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType} from "{schema}";

			const AccountSchema = new EntSchema({
				fields: {
					firstName: StringType(),
				},
			});
			export default AccountSchema;
			`),
			"todo_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, UUIDType} from "{schema}";

			const TodoSchema = new EntSchema({
				fields: {
					text: StringType(),
					accountID: UUIDType({
						foreignKey: {
							schema: 'Account',
							column: 'ID',
						}
					}),
				},
			});
			export default TodoSchema;
			`),
		})

	todo, err := s.GetNodeDataForNode("Todo")
	require.NotNil(t, todo)
	require.Nil(t, err)
	accountEdge := todo.EdgeInfo.GetFieldEdgeByName("account")
	require.NotNil(t, accountEdge)
	assert.Equal(t, "account", accountEdge.EdgeName)
	assert.Equal(t, "AccountConfig", accountEdge.GetEntConfig().ConfigName)

	// 2. adds a foreign key edge on inverse node
	account, err := s.GetNodeDataForNode("Account")
	require.NotNil(t, account)
	require.Nil(t, err)
	todosEdge := account.EdgeInfo.GetForeignKeyEdgeByName("Todos")
	require.NotNil(t, todosEdge)
	assert.Equal(t, "Todos", todosEdge.EdgeName)
	assert.Equal(t, "TodoConfig", todosEdge.GetEntConfig().ConfigName)
}

func TestForeignKeyInvalidKeys(t *testing.T) {
	_, err := testhelper.ParseSchemaForTestFullFixed(t,
		map[string]string{
			"todo_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, UUIDType} from "{schema}";

			const TodoSchema = new EntSchema({
				fields: {
					text: StringType(),
					accountID: UUIDType({
						foreignKey: {
							schema: 'Account',
							column: 'ID',
						}
					}),
				},
			});
			export default TodoSchema;
			`),
		})

	assert.Error(t, err)
}

func TestInverseAssocEdge(t *testing.T) {
	s := testhelper.ParseSchemaForTestFixed(t,
		map[string]string{
			"account_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType} from "{schema}";

			const AccountSchema = new EntSchema({
				fields: {
					firstName: StringType(),
				},

				edges: [
					{
						name: 'Todos',
						schemaName: 'Todo',
						inverseEdge: {
							name: 'Accounts',
						},
					},
				],
			});
			export default AccountSchema;
			`),
			"todo_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, UUIDType} from "{schema}";

			const TodoSchema = new EntSchema({
				fields: {
					text: StringType(),
				},
			});
			export default TodoSchema;
			`),
		})

	todos := getEdgeFromSchema(t, s, "Account", "Todos")

	require.NotNil(t, todos, "expected the todos edge to not be nil")

	require.NotNil(t, todos.InverseEdge, "expected the todos edge to have an inverse edge")

	accounts := getEdgeFromSchema(t, s, "Todo", "Accounts")

	require.NotNil(t, accounts, "expected the todo -> accounts edge to not be nil")

	require.Nil(t, accounts.InverseEdge, "expected the accounts inverse edge field to be nil")

	require.True(t, accounts.IsInverseEdge, "expected the todo -> todo accounts inverse edge field to be true")

	edges := s.GetEdges()

	accountTodosEdge := edges["AccountToTodosEdge"]
	todoAccountsEdge := edges["TodoToAccountsEdge"]
	require.NotNil(t, accountTodosEdge)
	require.NotNil(t, todoAccountsEdge)

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToTodosEdge",
		SymmetricEdge: false,
		InverseEdgeType: sql.NullString{
			String: string(todoAccountsEdge.EdgeType),
			Valid:  true,
		},
		EdgeTable: "account_todos_edges",
	}

	testEdge(t, accountTodosEdge, expectedEdge)

	expectedInverseEdge := &ent.AssocEdgeData{
		EdgeName:      "TodoToAccountsEdge",
		SymmetricEdge: false,
		InverseEdgeType: sql.NullString{
			String: string(accountTodosEdge.EdgeType),
			Valid:  true,
		},
		EdgeTable: "account_todos_edges",
	}
	testEdge(t, todoAccountsEdge, expectedInverseEdge)

	accountInfo := s.Nodes["AccountConfig"]
	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToTodosEdge": "",
			},
		},
	)

	todoInfo := s.Nodes["TodoConfig"]
	testConstants(
		t,
		todoInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"TodoType": "todo",
			},
			"ent.EdgeType": {
				"TodoToAccountsEdge": "",
			},
		},
	)
}

func TestEdgeGroup(t *testing.T) {
	s := testhelper.ParseSchemaForTestFixed(t,
		map[string]string{
			"account_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType} from "{schema}";

			const AccountSchema = new EntSchema({
				fields: {
					firstName: StringType(),
				},
			});
			export default AccountSchema;
			`),
			"event_schema.ts": testhelper.GetCodeWithSchema(`
			import {EntSchema, StringType, UUIDType, TimestampType} from "{schema}";

			const EventSchema = new EntSchema({
				fields: {
					startTime: TimestampType(),
				},

				edgeGroups: [
					{
						name: 'Rsvps',
						groupStatusName: 'Rsvp',
						assocEdges: [
							{
								name: 'AttendingUsers',
								schemaName: 'Account',
								inverseEdge: {
									name: 'EventsAttending',
								},
							},
							{
								name: 'DeclinedUsers',
								schemaName: 'Account',
								inverseEdge: {
									name: 'DeclinedEvents',
								},
							},
						],
					},
				],
			});
			export default EventSchema;
			`),
		})

	attendees := getEdgeFromSchema(t, s, "Event", "AttendingUsers")

	require.NotNil(t, attendees, "expected the attendees edge to not be nil")

	require.NotNil(t, attendees.InverseEdge, "expected the attendes edge to have an inverse edge")

	eventsAttending := getEdgeFromSchema(t, s, "Account", "EventsAttending")
	require.NotNil(t, eventsAttending, "expected the account -> events attending edge to not be nil")

	require.Nil(t, eventsAttending.InverseEdge, "expected the events attending inverse edge field to be nil")

	require.True(t, eventsAttending.IsInverseEdge, "expected the user -> events attending inverse edge field to be true")

	edges := s.GetEdges()

	expectedEdgeNames := []string{
		"EventToAttendingUsersEdge",
		"AccountToEventsAttendingEdge",
		"EventToDeclinedUsersEdge",
		"AccountToDeclinedEventsEdge",
	}

	for idx, edgeName := range expectedEdgeNames {
		edge := edges[edgeName]
		var inverseEdgeName string
		if idx%2 == 0 {
			inverseEdgeName = expectedEdgeNames[idx+1]
		} else {
			inverseEdgeName = expectedEdgeNames[idx-1]
		}

		inverseEdge := edges[inverseEdgeName]

		expectedEdge := &ent.AssocEdgeData{
			EdgeName:      edgeName,
			SymmetricEdge: false,
			InverseEdgeType: sql.NullString{
				String: string(inverseEdge.EdgeType),
				Valid:  true,
			},
			EdgeTable: "event_rsvps_edges",
		}
		testEdge(t, edge, expectedEdge)
	}

	accountInfo := s.Nodes["AccountConfig"]
	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToEventsAttendingEdge": "",
				"AccountToDeclinedEventsEdge":  "",
			},
		},
	)

	eventInfo := s.Nodes["EventConfig"]
	testConstants(
		t,
		eventInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"EventType": "event",
			},
			"ent.EdgeType": {
				"EventToAttendingUsersEdge": "",
				"EventToDeclinedUsersEdge":  "",
			},
		},
	)
}

func getEdgeFromSchema(t *testing.T, s *schema.Schema, configName, edgeName string) *edge.AssociationEdge {
	ret, err := s.GetAssocEdgeByName(configName, edgeName)
	require.Nil(t, err)
	return ret
}

func getFieldFromSchema(t *testing.T, s *schema.Schema, nodeName, fieldName string) *field.Field {
	ret, err := s.GetFieldByName(nodeName, fieldName)
	require.Nil(t, err)
	return ret
}

func testEdge(t *testing.T, edge, expectedEdge *ent.AssocEdgeData) {
	_, err := uuid.Parse(string(edge.EdgeType))
	require.Nil(t, err, "Expected an edge type of uuid. didn't get it, got %s instead", edge.EdgeType)

	assert.Equal(
		t,
		edge.EdgeName,
		expectedEdge.EdgeName,
		"name of edge was not as expected, expected %s, got %s instead",
		expectedEdge.EdgeName,
		edge.EdgeName,
	)

	assert.Equal(t,
		edge.SymmetricEdge,
		expectedEdge.SymmetricEdge,
		"symmetric edge value of edge was not as expected. expected %v got %v instead",
		expectedEdge.SymmetricEdge,
		edge.SymmetricEdge,
	)

	assert.Equal(
		t,
		expectedEdge.InverseEdgeType.Valid,
		edge.InverseEdgeType.Valid,

		"inverse edge validity of edge was not as expected. expected %v got %v instead",
		expectedEdge.InverseEdgeType.Valid,
		edge.InverseEdgeType.Valid,
	)

	if expectedEdge.InverseEdgeType.Valid {
		assert.Equal(
			t,
			expectedEdge.InverseEdgeType.String,
			edge.InverseEdgeType.String,
			"inverse edge value of edge was not as expected. expected %s got %s instead",
			expectedEdge.InverseEdgeType.String,
			edge.InverseEdgeType.String,
		)
	}

	assert.Equal(t,
		edge.EdgeTable,
		expectedEdge.EdgeTable,

		"invalid edge table in newly generated edge. expected %s, got %s instead",
		expectedEdge.EdgeTable,
		edge.EdgeTable,
	)
}

func testConstants(t *testing.T, info *schema.NodeDataInfo, constMap map[string]map[string]string) {
	numConsts := len(info.NodeData.ConstantGroups)
	require.Len(
		t,
		info.NodeData.ConstantGroups,
		len(constMap),
		"expected %d constants for %s node. got %d instead",
		len(constMap),
		info.NodeData.PackageName,
		numConsts,
	)

	for constType, constDeetsMap := range constMap {
		nodeGroup := info.NodeData.ConstantGroups[constType]
		require.NotNil(
			t,
			nodeGroup,
			"expected group of const type %s for node %s to exist. it doesn't",
			constType,
			info.NodeData.PackageName,
		)

		assert.Equal(
			t,
			nodeGroup.ConstType,
			constType,
			"expected const type of node %s to be %s. it was %s instead",
			info.NodeData.PackageName,
			constType,
			nodeGroup.ConstType,
		)

		for constName, constValue := range constDeetsMap {
			constant := nodeGroup.Constants[constName]
			require.NotNil(
				t,
				constant,
				"expected constant with name %s for node %s to exist. it doesn't",
				constName,
				info.NodeData.PackageName,
			)

			assert.Equal(
				t,
				constant.ConstName,
				constName,

				"unexpected constant name generated for %s node, got %s instead of expected %s",
				info.NodeData.PackageName,
				constant.ConstName,
				constName,
			)

			if constType == "ent.EdgeType" {
				_, err := uuid.Parse(constant.ConstValue)
				require.NoError(
					t,
					err,
					"expected uuid as constant value for edge, got %s with err %s parsing uuid instead",
					constant.ConstValue,
					err,
				)
			} else {
				assert.Equal(
					t,
					constant.ConstValue,
					strconv.Quote(constValue),
					"unexpected constant value for %s type constant, got %s",
					info.NodeData.PackageName,
					constant.ConstValue,
				)
			}
		}
	}
}
