package schema_test

import (
	"testing"

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
