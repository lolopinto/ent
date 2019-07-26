package schema_test

import (
	"database/sql"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schema"
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

	func (config *AccountConfig) GetEdges() map[string]interface{} {
		return map[string]interface{}{
			"Todos": ent.AssociationEdge{
				EntConfig:   TodoConfig{},
			},
		}
	}
	`

	sources["todo_config.go"] = `
	package configs

	import "github.com/lolopinto/ent/ent"

type TodoConfig struct {
	Text      string
	AccountID string 
}

	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}

	func (config *TodoConfig) GetEdges() map[string]interface{} {
		return map[string]interface{}{
			"Account": ent.FieldEdge{
				FieldName:   "AccountID",
				EntConfig:   AccountConfig{},
				InverseEdge: "Todos",
			},
		}
	}
	`
	s := parseSchema(t, sources, "InverseFieldEdge")
	textField := getFieldFromSchema(t, s, "TodoConfig", "Text")

	if textField.InverseEdge != nil {
		t.Errorf(
			"expected the text field to have no inverse edge. instead it did",
		)
	}
	accountField := getFieldFromSchema(t, s, "TodoConfig", "AccountID")
	inverseEdge := accountField.InverseEdge
	if inverseEdge == nil {
		t.Errorf(
			"expected the account field to have an inverse edge. it didn't",
		)
	}

	if inverseEdge.EdgeConst != "AccountToTodosEdge" {
		t.Errorf(
			"inverse edge const not as expected, expected %s, got %s",
			"AccountToTodosEdge",
			inverseEdge.EdgeConst,
		)
	}
	if inverseEdge.EdgeName != "Todos" {
		t.Errorf(
			"inverse edge name not as expected, expected %s, got %s",
			"Todos",
			inverseEdge.EdgeName,
		)
	}
}

func TestInverseAssocEdgeSameEnt(t *testing.T) {
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

	func (config *AccountConfig) GetEdges() map[string]interface{} {
		return map[string]interface{}{
			"FriendRequests": ent.AssociationEdge{
				EntConfig:   AccountConfig{},
				InverseEdge: &ent.InverseAssocEdge{
					EdgeName: "FriendRequestsReceived",
				},
			},
		}
	}
	`

	s := parseSchema(t, sources, "InverseAssocEdgeSameEnt")
	friendRequests := getEdgeFromSchema(t, s, "AccountConfig", "FriendRequests")

	if friendRequests == nil {
		t.Error(
			"expected the friend requests edge to not be nil",
		)
	}

	if friendRequests.InverseEdge == nil {
		t.Error("expected the friend requests edge to have an inverse edge")
	}

	friendRequestsReceived := getEdgeFromSchema(t, s, "AccountConfig", "FriendRequestsReceived")
	if friendRequestsReceived == nil {
		t.Error(
			"expected the friend requests received edge to not be nil",
		)
	}

	if friendRequestsReceived.InverseEdge != nil {
		t.Error("expected the friend requests inverse edge field to be nil")
	}

	if !friendRequestsReceived.IsInverseEdge {
		t.Error("expected the friend request is inverse edge field to be true")
	}

	newEdges := s.GetNewEdges()

	if len(newEdges) != 2 {
		t.Errorf("Expected 2 new edges generated in schema, got %d instead", len(newEdges))
	}
	friendRequestsEdge := newEdges[0]
	friendRequestsReceivedEdge := newEdges[1]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToFriendRequestsEdge",
		SymmetricEdge: false,
		InverseEdgeType: &sql.NullString{
			String: friendRequestsReceivedEdge.EdgeType,
			Valid:  true,
		},
		EdgeTable: "accounts_friend_requests_edge",
	}

	testNewEdge(t, friendRequestsEdge, expectedEdge)

	expectedInverseEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToFriendRequestsReceivedEdge",
		SymmetricEdge: false,
		InverseEdgeType: &sql.NullString{
			String: friendRequestsEdge.EdgeType,
			Valid:  true,
		},
		EdgeTable: "accounts_friend_requests_edge",
	}
	testNewEdge(t, friendRequestsReceivedEdge, expectedInverseEdge)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": map[string]string{
				"AccountType": "account",
			},
			"ent.EdgeType": map[string]string{
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

	func (config *AccountConfig) GetEdges() map[string]interface{} {
		return map[string]interface{}{
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

	if todos == nil {
		t.Error(
			"expected the todos edge to not be nil",
		)
	}

	if todos.InverseEdge == nil {
		t.Error("expected the todos edge to have an inverse edge")
	}

	accounts := getEdgeFromSchema(t, s, "TodoConfig", "Accounts")
	if accounts == nil {
		t.Error(
			"expected the todo -> accounts edge to not be nil",
		)
	}

	if accounts.InverseEdge != nil {
		t.Error("expected the accounts inverse edge field to be nil")
	}

	if !accounts.IsInverseEdge {
		t.Error("expected the todo -> todo accounts edge field to be true")
	}

	newEdges := s.GetNewEdges()

	if len(newEdges) != 2 {
		t.Errorf("Expected 2 new edges generated in schema, got %d instead", len(newEdges))
	}
	accountTodosEdge := newEdges[0]
	todoAccountsEdge := newEdges[1]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToTodosEdge",
		SymmetricEdge: false,
		InverseEdgeType: &sql.NullString{
			String: todoAccountsEdge.EdgeType,
			Valid:  true,
		},
		EdgeTable: "accounts_todos_edge",
	}

	testNewEdge(t, accountTodosEdge, expectedEdge)

	expectedInverseEdge := &ent.AssocEdgeData{
		EdgeName:      "TodoToAccountsEdge",
		SymmetricEdge: false,
		InverseEdgeType: &sql.NullString{
			String: accountTodosEdge.EdgeType,
			Valid:  true,
		},
		EdgeTable: "accounts_todos_edge",
	}
	testNewEdge(t, todoAccountsEdge, expectedInverseEdge)

	accountInfo := s.Nodes["AccountConfig"]
	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": map[string]string{
				"AccountType": "account",
			},
			"ent.EdgeType": map[string]string{
				"AccountToTodosEdge": "",
			},
		},
	)

	todoInfo := s.Nodes["TodoConfig"]
	testConstants(
		t,
		todoInfo,
		map[string]map[string]string{
			"ent.NodeType": map[string]string{
				"TodoType": "todo",
			},
			"ent.EdgeType": map[string]string{
				"TodoToAccountsEdge": "",
			},
		},
	)
}

func TestGenerateNewEdges(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)
	newEdges := s.GetNewEdges()

	if len(newEdges) != 1 {
		t.Errorf("Expected 1 new edge generated in schema, got %d instead", len(newEdges))
	}
	newEdge := newEdges[0]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:        "AccountToFriendsEdge",
		SymmetricEdge:   false,
		InverseEdgeType: &sql.NullString{},
		EdgeTable:       "accounts_friends_edge",
	}

	testNewEdge(t, newEdge, expectedEdge)
}

func TestGeneratedConstants(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": map[string]string{
				"AccountType": "account",
			},
			"ent.EdgeType": map[string]string{
				"AccountToFriendsEdge": "",
			},
		},
	)

	todoInfo := s.Nodes["TodoConfig"]

	testConstants(
		t,
		todoInfo,
		map[string]map[string]string{
			"ent.NodeType": map[string]string{
				"TodoType": "todo",
			},
		},
	)
}

// inlining this in a bunch of places to break the import cycle
func parseSchema(t *testing.T, sources map[string]string, uniqueKeyForSources string) *schema.Schema {
	data := parsehelper.ParseFilesForTest(
		t,
		parsehelper.Sources(uniqueKeyForSources, sources),
	)
	return schema.ParsePackage(data.Pkg)
}

func getEdgeFromSchema(t *testing.T, s *schema.Schema, configName, edgeName string) *edge.AssociationEdge {
	ret, err := s.GetAssocEdgeByName(configName, edgeName)
	if err != nil {
		t.Errorf("error getting edge from schema")
	}
	return ret
}

func getFieldFromSchema(t *testing.T, s *schema.Schema, configName, fieldName string) *field.Field {
	ret, err := s.GetFieldByName(configName, fieldName)
	if err != nil {
		t.Errorf("error getting field from schema")
	}
	return ret
}

func getSchemaForNewConstsAndEdges(t *testing.T) *schema.Schema {
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

	func (config *AccountConfig) GetEdges() map[string]interface{} {
		return map[string]interface{}{
			"Friends": ent.AssociationEdge{
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

	return parseSchema(t, sources, "NewConstsAndEdges")
}

func testNewEdge(t *testing.T, newEdge, expectedEdge *ent.AssocEdgeData) {
	_, err := uuid.Parse(newEdge.EdgeType)
	if err != nil {
		t.Errorf("Expected a new edge type of uuid generated. didn't get it, got %s instead", newEdge.EdgeType)
	}

	if newEdge.EdgeName != expectedEdge.EdgeName {
		t.Errorf(
			"edgename of newly generated edge was not as expected, expected %s, got %s instead",
			expectedEdge.EdgeName,
			newEdge.EdgeName,
		)
	}

	if newEdge.SymmetricEdge != expectedEdge.SymmetricEdge {
		t.Errorf(
			"symmetric edge value of edge was not as expected. expected %v got %v instead",
			expectedEdge.SymmetricEdge,
			newEdge.SymmetricEdge,
		)
	}

	if expectedEdge.InverseEdgeType.Valid != newEdge.InverseEdgeType.Valid {
		t.Errorf(
			"inverse edge validity of edge was not as expecfted. expected %v got %v instead",
			expectedEdge.InverseEdgeType.Valid,
			newEdge.InverseEdgeType.Valid,
		)
	}

	if expectedEdge.InverseEdgeType.Valid && expectedEdge.InverseEdgeType.String != newEdge.InverseEdgeType.String {
		t.Errorf(
			"inverse edge value of edge was not as expecfted. expected %s got %s instead",
			expectedEdge.InverseEdgeType.String,
			newEdge.InverseEdgeType.String,
		)
	}

	if newEdge.EdgeTable != expectedEdge.EdgeTable {
		t.Errorf(
			"invalid edge table in newly generated edge. expected %s, got %s instead",
			expectedEdge.EdgeTable,
			newEdge.EdgeTable,
		)
	}
}

func testConstants(t *testing.T, info *schema.NodeDataInfo, constMap map[string]map[string]string) {
	numConsts := len(info.NodeData.ConstantGroups)
	if numConsts != len(constMap) {
		t.Errorf(
			"expected %d constants for %s node. got %d instead",
			len(constMap),
			info.NodeData.PackageName,
			numConsts,
		)
	}

	for constType, constDeetsMap := range constMap {
		nodeGroup := info.NodeData.ConstantGroups[constType]
		if nodeGroup == nil {
			t.Errorf(
				"expected group of const type %s for node %s to exist. it doesn't",
				constType,
				info.NodeData.PackageName,
			)
		}
		if nodeGroup.ConstType != constType {
			t.Errorf(
				"expected const type of node %s to be %s. it was %s instead",
				info.NodeData.PackageName,
				constType,
				nodeGroup.ConstType,
			)
		}

		for constName, constValue := range constDeetsMap {
			constant := nodeGroup.Constants[constName]
			if constant == nil {
				t.Errorf(
					"expected constant with name %s for node %s to exist. it doesn't",
					constName,
					info.NodeData.PackageName,
				)
			}

			if constant.ConstName != constName {
				t.Errorf(
					"unexpected constant name generated for %s node, got %s instead of expected %s",
					info.NodeData.PackageName,
					constant.ConstName,
					constName,
				)
			}
			if constType == "ent.EdgeType" {
				_, err := uuid.Parse(constant.ConstValue)
				if err != nil {
					t.Errorf("expected uuid as constant value for edge, got %s with err %s parsing uuid instead", constant.ConstValue, err)
				}
			} else if constant.ConstValue != strconv.Quote(constValue) {
				t.Errorf("unexpected constant value for %s type constant, got %s", info.NodeData.PackageName, constant.ConstValue)
			}
		}
	}
}
