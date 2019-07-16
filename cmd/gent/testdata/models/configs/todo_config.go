package configs

import "github.com/lolopinto/ent/ent"

// TodoConfig is the config for test todos in test land
type TodoConfig struct {
	Completed bool
	Text      string
	// TODO maybe also support accounts.id which is the name of the underlying table. but we're abstracting out db information...
	AccountID string `fkey:"AccountConfig.ID"`
}

// GetTableName returns the underyling database table the todo model's data is stored
func (config *TodoConfig) GetTableName() string {
	return "todos"
}

// GetEdges returns the Edges that the Todo node supports
func (config *TodoConfig) GetEdges() map[string]interface{} {
	return map[string]interface{}{
		"Account": ent.FieldEdge{
			FieldName: "AccountID",
			EntConfig: AccountConfig{},
		},
	}
}
