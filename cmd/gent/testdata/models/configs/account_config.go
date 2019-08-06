package configs

import (
	"time"

	"github.com/lolopinto/ent/ent"
)

// TODO right now this is duplicated from internal/testdata.
// need to figure out the best way to share across things

// AccountConfig is the config for test accounts in test land
type AccountConfig struct {
	FirstName      string
	LastName       string `index:"true"`
	PhoneNumber    string `unique:"true"`
	NumberOfLogins int    // stupid thing to store in an account but needed for testing purposes...
	LastLoginAt    time.Time
}

// GetTableName returns the underyling database table the account model's data is stored
func (config *AccountConfig) GetTableName() string {
	return "accounts"
}

// GetEdges returns the edges that this account is mapped to
func (config *AccountConfig) GetEdges() map[string]interface{} {
	return map[string]interface{}{
		"Todos": ent.ForeignKeyEdge{
			EntConfig: TodoConfig{},
		},
		"Friends": ent.AssociationEdge{
			EntConfig: AccountConfig{},
		},
	}
}
