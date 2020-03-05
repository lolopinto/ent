package configs

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/field"
)

// FolderConfig is the config for test folders in todo land
type FolderConfig struct{}

func (config *FolderConfig) GetFields() ent.FieldMap {
	return ent.FieldMap{
		"Name": field.F(field.StringType()),
		"AccountID": field.F(
			field.StringType(),
			// also write the Account -> Folders edge when this field is set
			field.FieldEdge("AccountConfig", "Folders"),
		),
		"NumberOfFiles": field.F(field.IntType()),
	}
}

// GetTableName returns the underyling database table the account model's data is stored
func (config *FolderConfig) GetTableName() string {
	return "folders"
}

// GetEdges returns the edges that this todo is mapped to
func (config *FolderConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
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
