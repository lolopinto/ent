package schema_test

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/testingutils/test_db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func TestInverseFieldEdge(t *testing.T) {
	sources := make(map[string]string)

	sources["account_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"

type AccountConfig struct {
	FirstName string
}

	func (config *AccountConfig) GetTableName() string {
		return "accounts"
	}

	func (config *AccountConfig) GetEdges() ent.EdgeMap{
		return ent.EdgeMap{
			"Todos": ent.AssociationEdge{
				EntConfig:   TodoConfig{},
			},
		}
	}
	`

	sources["todo_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

type TodoConfig struct {}

func (config *TodoConfig) GetFields() ent.FieldMap {
	return ent.FieldMap {
		"Text": field.F(field.StringType()),
		"AccountID": field.F(field.StringType(), field.FieldEdge("AccountConfig", "Todos")),
	}
}

	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`
	s := parseSchema(t, sources, "InverseFieldEdge")
	textField := getFieldFromSchema(t, s, "TodoConfig", "Text")

	require.Nil(t, textField.GetInverseEdge(), "expected the text field to have no inverse edge. instead it did")

	// creating a fieldEdge above does 2 things:
	// 	1. it adds an inverse edge to the field
	accountField := getFieldFromSchema(t, s, "TodoConfig", "AccountID")
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
	todoInfo := s.Nodes["TodoConfig"]
	require.NotNil(t, todoInfo)
	accountEdge := todoInfo.NodeData.EdgeInfo.GetFieldEdgeByName("Account")
	require.NotNil(t, accountEdge)
	assert.Equal(t, "Account", accountEdge.EdgeName)
	assert.Equal(t, "AccountConfig", accountEdge.GetEntConfig().ConfigName)
}

func TestForeignKey(t *testing.T) {
	sources := make(map[string]string)

	sources["account_config.go"] = `
	package configs

type AccountConfig struct {
	FirstName string
}

	func (config *AccountConfig) GetTableName() string {
		return "accounts"
	}
	`

	sources["todo_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

type TodoConfig struct {}

func (config *TodoConfig) GetFields() ent.FieldMap {
	return ent.FieldMap {
		"Text": field.F(field.StringType()),
		"AccountID": field.F(field.StringType(), field.ForeignKey("AccountConfig", "ID")),
	}
}

	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	// creating a foreign key also does 2 things:
	// 1. adds a fieldedge on source edge
	s := parseSchema(t, sources, "ForeignKeyEdge")
	todoInfo := s.Nodes["TodoConfig"]
	require.NotNil(t, todoInfo)
	accountEdge := todoInfo.NodeData.EdgeInfo.GetFieldEdgeByName("Account")
	require.NotNil(t, accountEdge)
	assert.Equal(t, "Account", accountEdge.EdgeName)
	assert.Equal(t, "AccountConfig", accountEdge.GetEntConfig().ConfigName)

	// 2. adds a foreign key edge on inverse node
	accountInfo := s.Nodes["AccountConfig"]
	require.NotNil(t, accountInfo)
	todosEdge := accountInfo.NodeData.EdgeInfo.GetForeignKeyEdgeByName("Todos")
	require.NotNil(t, todosEdge)
	assert.Equal(t, "Todos", todosEdge.EdgeName)
	assert.Equal(t, "TodoConfig", todosEdge.GetEntConfig().ConfigName)
}

func TestForeignKeyInvalidKeys(t *testing.T) {
	sources := make(map[string]string)

	sources["account_config.go"] = `
	package configs

type AccountConfig struct {
	FirstName string
}

	func (config *AccountConfig) GetTableName() string {
		return "accounts"
	}
	`

	sources["todo_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

type TodoConfig struct {}

func (config *TodoConfig) GetFields() ent.FieldMap {
	return ent.FieldMap {
		"Text": field.F(field.StringType()),
		"AccountID": field.F(field.StringType(), field.ForeignKey("Accounts", "ID")),
	}
}

	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	_, err := parseSchemaPlusError(t, sources, "ForeignKeyEdgeInvalid")
	assert.Error(t, err)
}

func verifyInverseAssocEdgeSameEnt(t *testing.T, s *schema.Schema) {
	friendRequests := getEdgeFromSchema(t, s, "AccountConfig", "FriendRequests")

	require.NotNil(t, friendRequests, "expected the friend requests edge to not be nil")

	assert.NotNil(t, friendRequests.InverseEdge, "expected the friend requests edge to have an inverse edge")

	friendRequestsReceived := getEdgeFromSchema(t, s, "AccountConfig", "FriendRequestsReceived")
	require.NotNil(t, friendRequestsReceived, "expected the friend requests received edge to not be nil")

	assert.Nil(t, friendRequestsReceived.InverseEdge, "expected the friend requests inverse edge field to be nil")

	assert.True(t, friendRequestsReceived.IsInverseEdge, "expected the friend request is inverse edge field to be true")

	edges := s.GetEdges()

	assert.Len(t, edges, 2, "Expected 2 edges generated in schema, got %d instead", len(edges))

	friendRequestsEdge := edges["AccountToFriendRequestsEdge"]
	friendRequestsReceivedEdge := edges["AccountToFriendRequestsReceivedEdge"]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToFriendRequestsEdge",
		SymmetricEdge: false,
		InverseEdgeType: sql.NullString{
			String: string(friendRequestsReceivedEdge.EdgeType),
			Valid:  true,
		},
		EdgeTable: "account_friend_requests_edges",
	}

	testEdge(t, friendRequestsEdge, expectedEdge)

	expectedInverseEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToFriendRequestsReceivedEdge",
		SymmetricEdge: false,
		InverseEdgeType: sql.NullString{
			String: string(friendRequestsEdge.EdgeType),
			Valid:  true,
		},
		EdgeTable: "account_friend_requests_edges",
	}
	testEdge(t, friendRequestsReceivedEdge, expectedInverseEdge)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToFriendRequestsEdge":         "",
				"AccountToFriendRequestsReceivedEdge": "",
			},
		},
	)
}

func TestInverseAssocEdge(t *testing.T) {
	sources := make(map[string]string)

	sources["account_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"

type AccountConfig struct {
	FirstName string
}

	func (config *AccountConfig) GetTableName() string {
		return "accounts"
	}

	func (config *AccountConfig) GetEdges() ent.EdgeMap{
		return ent.EdgeMap{
			"Todos": ent.AssociationEdge{
				EntConfig:   TodoConfig{},
				InverseEdge: &ent.InverseAssocEdge{
					EdgeName: "Accounts",
				},
			},
		}
	}
	`

	sources["todo_config.go"] = `
	package configs

type TodoConfig struct {
	Text string
}

	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`
	s := parseSchema(t, sources, "InverseAssocEdge")
	todos := getEdgeFromSchema(t, s, "AccountConfig", "Todos")

	require.NotNil(t, todos, "expected the todos edge to not be nil")

	require.NotNil(t, todos.InverseEdge, "expected the todos edge to have an inverse edge")

	accounts := getEdgeFromSchema(t, s, "TodoConfig", "Accounts")

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
	sources := make(map[string]string)

	sources["account_config.go"] = `
	package configs

type AccountConfig struct {
	FirstName string
}

	func (config *AccountConfig) GetTableName() string {
		return "accounts"
	}
	`

	sources["event_config.go"] = `
	package configs

	import "time"
	import "github.com/lolopinto/ent/ent"

type EventConfig struct {
	StartTime time.Time
}

	func (config *EventConfig) GetTableName() string {
		return "events"
	}

	func (config *EventConfig) GetEdges() ent.EdgeMap {
		return ent.EdgeMap {
			"Rsvps": ent.AssociationEdgeGroup {
				GroupStatusName: "Rsvp",
				EdgeGroups: ent.AssocEdgeMap{
					"AttendingUsers": &ent.AssociationEdge{
						EntConfig: AccountConfig{},
						InverseEdge: &ent.InverseAssocEdge{
							EdgeName: "EventsAttending",
						},
					},
					"DeclinedUsers": &ent.AssociationEdge{
						EntConfig: AccountConfig{},
						InverseEdge: &ent.InverseAssocEdge{
							EdgeName: "DeclinedEvents",
						},
					},
				},
			},
		}
	}
	`
	s := parseSchema(t, sources, "EdgeGroup")
	attendees := getEdgeFromSchema(t, s, "EventConfig", "AttendingUsers")

	require.NotNil(t, attendees, "expected the attendees edge to not be nil")

	require.NotNil(t, attendees.InverseEdge, "expected the attendes edge to have an inverse edge")

	eventsAttending := getEdgeFromSchema(t, s, "AccountConfig", "EventsAttending")
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

	// accountInfo := s.Nodes["AccountConfig"]
	// testConstants(
	// 	t,
	// 	accountInfo,
	// 	map[string]map[string]string{
	// 		"ent.NodeType": map[string]string{
	// 			"AccountType": "account",
	// 		},
	// 		"ent.EdgeType": map[string]string{
	// 			"AccountToTodosEdge": "",
	// 		},
	// 	},
	// )

	// todoInfo := s.Nodes["TodoConfig"]
	// testConstants(
	// 	t,
	// 	todoInfo,
	// 	map[string]map[string]string{
	// 		"ent.NodeType": map[string]string{
	// 			"TodoType": "todo",
	// 		},
	// 		"ent.EdgeType": map[string]string{
	// 			"TodoToAccountsEdge": "",
	// 		},
	// 	},
	// )
}

func TestGenerateNewEdges(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)
	testEdgesFromConstsAndEdges(t, s)
}

func TestGeneratedConstants(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToFriends2Edge": "",
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
		},
	)
}

// inlining this in a bunch of places to break the import cycle
func parseSchema(t *testing.T, sources map[string]string, uniqueKeyForSources string) *schema.Schema {
	s, err := parseSchemaPlusError(t, sources, uniqueKeyForSources)
	require.NoError(t, err)
	return s
}

func parseSchemaPlusError(t *testing.T, sources map[string]string, uniqueKeyForSources string) (*schema.Schema, error) {
	data := parsehelper.ParseFilesForTest(
		t,
		parsehelper.Sources(uniqueKeyForSources, sources),
	)
	return schema.ParsePackage(data.Pkg)

}

func getEdgeFromSchema(t *testing.T, s *schema.Schema, configName, edgeName string) *edge.AssociationEdge {
	ret, err := s.GetAssocEdgeByName(configName, edgeName)
	require.Nil(t, err)
	return ret
}

func getFieldFromSchema(t *testing.T, s *schema.Schema, configName, fieldName string) *field.Field {
	ret, err := s.GetFieldByName(configName, fieldName)
	require.Nil(t, err)
	return ret
}

func getSourcesForNewConstsAndEdges() map[string]string {
	sources := make(map[string]string)

	sources["account_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"

type AccountConfig struct {
	FirstName string
}

func (config *AccountConfig) GetTableName() string {
	return "accounts"
}

	func (config *AccountConfig) GetEdges() ent.EdgeMap{
		return ent.EdgeMap{
			"Friends2": ent.AssociationEdge{
				EntConfig:   AccountConfig{},
			},
		}
	}
	`

	sources["todo_config.go"] = `
	package configs

type TodoConfig struct {
	Text string
}

func (config *TodoConfig) GetTableName() string {
	return "todos"
}
	`

	return sources
}

func getSourceForInverseAssocEdgeSameEnt(t *testing.T) string {
	return `
	package configs

	import "github.com/lolopinto/ent/ent"

type AccountConfig struct {
	FirstName string
}

	func (config *AccountConfig) GetTableName() string {
		return "accounts"
	}

	func (config *AccountConfig) GetEdges() ent.EdgeMap{
		return ent.EdgeMap{
			"FriendRequests": ent.AssociationEdge{
				EntConfig:   AccountConfig{},
				InverseEdge: &ent.InverseAssocEdge{
					EdgeName: "FriendRequestsReceived",
				},
			},
		}
	}
	`
}

func getSourceForEdgeWithoutInverse(t *testing.T) string {
	source := getSourceForInverseAssocEdgeSameEnt(t)

	// strip out InverseEdge: ... }.

	inverseEdgeIdx := strings.Index(source, "InverseEdge")
	assert.NotEqual(t, inverseEdgeIdx, -1)

	prefix := source[:inverseEdgeIdx]
	suffix := source[inverseEdgeIdx:]

	// find }, after InverseEdge and strip out the entire InverseEdge

	endIdx := strings.Index(suffix, "},")
	assert.NotEqual(t, endIdx, -1)

	return prefix + string(suffix[endIdx+2:])
}

func getSources2ForNewConstsAndEdges(t *testing.T) map[string]string {
	sources := getSourcesForNewConstsAndEdges()

	todoConfig := sources["todo_config.go"]

	index := strings.Index(todoConfig, "type TodoConfig")
	assert.NotEqual(t, index, -1)

	// need to add import github.com/lolopinto/ent/ent
	todoConfig = todoConfig[:index] + `import "github.com/lolopinto/ent/ent"
	
	` + todoConfig[index:]

	// add a new edge in a second PR
	sources["todo_config.go"] = todoConfig +
		`
	func (config *TodoConfig) GetEdges() ent.EdgeMap{
		return ent.EdgeMap{
			"Account": ent.AssociationEdge{
				EntConfig: AccountConfig{},
			},
		}
	}
	`
	fmt.Println(sources["todo_config.go"])
	return sources
}

func getSchemaForNewConstsAndEdges(t *testing.T) *schema.Schema {
	sources := getSourcesForNewConstsAndEdges()
	return parseSchema(t, sources, "NewConstsAndEdges")
}

func getSchemaForNewConstsAndEdges2(t *testing.T) *schema.Schema {
	sources := getSources2ForNewConstsAndEdges(t)
	return parseSchema(t, sources, "NewConstsAndEdges2")
}

func testEdgesFromConstsAndEdges(t *testing.T, s *schema.Schema) {
	newEdges := s.GetNewEdges()

	require.Len(t, newEdges, 1)
	newEdge := newEdges[0]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:        "AccountToFriends2Edge",
		SymmetricEdge:   false,
		InverseEdgeType: sql.NullString{},
		EdgeTable:       "account_friends_2_edges",
	}

	testEdge(t, newEdge, expectedEdge)
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

type edgeTestSuite struct {
	testingutils.Suite
	tdb *test_db.TestDB
}

func (suite *edgeTestSuite) SetupSuite() {
	suite.tdb = &test_db.TestDB{
		Tables: []test_db.Table{
			{
				Name: "assoc_edge_config",
				Columns: []test_db.Column{
					test_db.UUID("edge_type", test_db.PrimaryKey()),
					test_db.Text("edge_name"),
					test_db.Bool("symmetric_edge"),
					test_db.UUID("inverse_edge_type", test_db.Nullable()),
					test_db.Text("edge_table"),
					test_db.Timestamp("created_at"),
					test_db.Timestamp("updated_at"),
				},
			},
		},
	}

	err := suite.tdb.BeforeAll()
	require.Nil(suite.T(), err)

	suite.Tables = []string{"assoc_edge_config"}
	suite.Suite.ForceClean = true
	suite.Suite.SetupSuite()
}

func (suite *edgeTestSuite) TearDownSuite() {
	err := suite.tdb.AfterAll()
	require.Nil(suite.T(), err)
}

func (suite *edgeTestSuite) TestNewVsExistingEdges() {
	t := suite.T()
	s := getSchemaForNewConstsAndEdges(t)
	testEdgesFromConstsAndEdges(t, s)

	// 1 new edge added. 1 edge total
	suite.validateSchema(s, 1, 1, 0)

	s2 := getSchemaForNewConstsAndEdges2(t)

	// 1 new edge added. 2 edges total
	suite.validateSchema(s2, 2, 1, 0)
}

func (suite *edgeTestSuite) TestInverseAssocEdgeAddedAfter() {
	sources := make(map[string]string)
	sources["account_config.go"] = getSourceForEdgeWithoutInverse(suite.T())

	s := parseSchema(suite.T(), sources, "InverseAssocEdgeFirstTry")
	friendRequests := getEdgeFromSchema(suite.T(), s, "AccountConfig", "FriendRequests")

	require.NotNil(
		suite.T(),
		friendRequests,
		"expected the friend requests edge to not be nil",
	)

	require.Nil(
		suite.T(),
		friendRequests.InverseEdge,
		"expected the friend requests edge not to have an inverse edge",
	)

	edges := s.GetEdges()

	require.Len(
		suite.T(),
		edges,
		1,
		"Expected 1 edge generated in schema, got %d instead",
		len(edges),
	)

	friendRequestsEdge := edges["AccountToFriendRequestsEdge"]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:        "AccountToFriendRequestsEdge",
		SymmetricEdge:   false,
		InverseEdgeType: sql.NullString{},
		EdgeTable:       "account_friend_requests_edges",
	}

	testEdge(suite.T(), friendRequestsEdge, expectedEdge)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		suite.T(),
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToFriendRequestsEdge": "",
			},
		},
	)
	// 1 new edge added. 1 edge total
	// validate with db
	suite.validateSchema(s, 1, 1, 0)

	sources2 := make(map[string]string)
	sources2["account_config.go"] = getSourceForInverseAssocEdgeSameEnt(suite.T())
	s2 := parseSchema(suite.T(), sources2, "InverseAssocEdgeAddedAfter")
	verifyInverseAssocEdgeSameEnt(suite.T(), s2)

	// 1 new edge added. 2 edge total
	suite.validateSchema(s2, 2, 1, 1)
}

func (suite *edgeTestSuite) TestInverseAssocEdgeSameEnt() {
	sources := make(map[string]string)

	sources["account_config.go"] = getSourceForInverseAssocEdgeSameEnt(suite.T())

	s := parseSchema(suite.T(), sources, "InverseAssocEdgeSameEnt")
	verifyInverseAssocEdgeSameEnt(suite.T(), s)
}

func (suite *edgeTestSuite) validateSchema(
	s *schema.Schema,
	expectedEdges, expectedNewEdges, expectedEdgesToUpdate int) {
	assert.Equal(suite.T(), expectedNewEdges, len(s.GetNewEdges()))
	for _, edge := range s.GetNewEdges() {
		testingutils.CreateEdge(suite.T(), edge)
	}
	assert.Equal(suite.T(), expectedEdgesToUpdate, len(s.GetEdgesToUpdate()))
	// need to update existing edges also
	for _, edge := range s.GetEdgesToUpdate() {
		testingutils.EditEdge(suite.T(), edge)
	}

	assert.Equal(suite.T(), expectedEdges, len(s.GetEdges()))
	dbEdges := <-ent.GenLoadAssocEdges()
	assert.Nil(suite.T(), dbEdges.Err)
	assert.Equal(suite.T(), len(s.GetEdges()), len(dbEdges.Edges))
}

func TestEdgeSuite(t *testing.T) {
	suite.Run(t, new(edgeTestSuite))
}
