package configs

import (
	"github.com/lolopinto/ent/ent"
)

// FolderConfig is the config for test folders in todo land
type FolderConfig struct {
	Name      string
	AccountID string
}

// GetTableName returns the underyling database table the account model's data is stored
func (config *FolderConfig) GetTableName() string {
	return "folders"
}

// GetEdges returns the edges that this todo is mapped to
func (config *FolderConfig) GetEdges() map[string]interface{} {
	return map[string]interface{}{
		// inverse edge from a folder to the todos in that folder
		"Todos": ent.AssociationEdge{
			// intentionally written in this order to test depgraph until we write tests for that
			InverseEdge: &ent.InverseAssocEdge{
				EdgeName: "Folders",
			},
			EntConfig: TodoConfig{},
		},
	}
}
