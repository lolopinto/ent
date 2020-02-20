package configs

import (
	"github.com/lolopinto/ent/ent"
)

// TodoConfig is the config for test todos in test land
type TodoConfig struct {
	Completed bool
	Text      string
	// TODO maybe also support accounts.id which is the name of the underlying table. but we're abstracting out db information...
	AccountID   string       `fkey:"AccountConfig.ID"`
	AccountType ent.NodeType // kinda superflous right now with AccountID but needed to test ent.NodeType
}

// GetTableName returns the underyling database table the todo model's data is stored
func (config *TodoConfig) GetTableName() string {
	return "todos"
}
