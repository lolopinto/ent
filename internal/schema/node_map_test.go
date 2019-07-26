package schema_test

import (
	"strconv"
	"testing"

	"github.com/google/uuid"
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
}

func TestGenerateNewEdges(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)
	newEdges := s.GetNewEdges()

	if len(newEdges) != 1 {
		t.Errorf("Expected 1 new edge generated in model, got %d instead", len(newEdges))
	}
	newEdge := newEdges[0]

	_, err := uuid.Parse(newEdge.EdgeType)
	if err != nil {
		t.Errorf("Expected a new edge type of uuid generated. didn't get it, got %s instead", newEdge.EdgeType)
	}

	if newEdge.EdgeName != "AccountToFriendsEdge" {
		t.Errorf("edgename of newly generated edge was not as expected")
	}

	if newEdge.SymmetricEdge {
		t.Errorf("expected a non-symmetric edge. got a symmetric edge instead")
	}

	if newEdge.InverseEdgeType.Valid {
		t.Errorf("expected invalid inverse edge type. got a valid one instead")
	}

	if newEdge.EdgeTable != "accounts_friends_edge" {
		t.Errorf("invalid edge table in newly generated edge")
	}
}

func TestGeneratedConstants(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)

	accountInfo := s.Nodes["AccountConfig"]

	numConsts := len(accountInfo.NodeData.ConstantGroups)
	if numConsts != 2 {
		t.Errorf("expected 2 constants for account node. got %d instead", numConsts)
	}
	firstGroup := accountInfo.NodeData.ConstantGroups[0]
	if firstGroup.ConstType != "ent.NodeType" {
		t.Errorf("expected nodeType to be the first constant group, got %s instead", firstGroup.ConstType)
	}
	if len(firstGroup.Constants) != 1 {
		t.Errorf("expected 1 constant in the first constant group, got %d instead", len(firstGroup.Constants))
	}
	constant := firstGroup.Constants[0]
	if constant.ConstName != "AccountType" {
		t.Errorf("unexpected constant name generated for account node, got %s instead of expected", constant.ConstName)
	}
	if constant.ConstValue != strconv.Quote("account") {
		t.Errorf("unexpected constant value for account type constant, got %s", constant.ConstValue)
	}

	secondGroup := accountInfo.NodeData.ConstantGroups[1]
	if secondGroup.ConstType != "ent.EdgeType" {
		t.Errorf("expected edgeType to be the second constant group, got %s instead", secondGroup.ConstType)
	}
	if len(secondGroup.Constants) != 1 {
		t.Errorf("expected 1 constant in the second constant group, got %d instead", len(secondGroup.Constants))
	}
	constant = secondGroup.Constants[0]
	if constant.ConstName != "AccountToFriendsEdge" {
		t.Errorf("unexpected constant name generated for account to friends edge, got %s instead of expected", constant.ConstName)
	}
	_, err := uuid.Parse(constant.ConstValue)
	if err != nil {
		t.Errorf("expected uuid as constant value for edge, got %s with err %s parsing uuid instead", constant.ConstValue, err)
	}

	todoInfo := s.Nodes["TodoConfig"]

	numConsts = len(todoInfo.NodeData.ConstantGroups)
	if numConsts != 1 {
		t.Errorf("expected 1 constant for todo node. got %d instead", numConsts)
	}
	firstGroup = todoInfo.NodeData.ConstantGroups[0]
	if firstGroup.ConstType != "ent.NodeType" {
		t.Errorf("expected nodeType to be the first constant group, got %s instead", firstGroup.ConstType)
	}
	if len(firstGroup.Constants) != 1 {
		t.Errorf("expected 1 constant in the first constant group, got %d instead", len(firstGroup.Constants))
	}
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
