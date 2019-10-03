package configs

import "github.com/lolopinto/ent/ent"

type UserConfig struct {
	EmailAddress string `unique:"true"`
	FirstName    string
	LastName     string
}

func (config *UserConfig) GetTableName() string {
	return "users"
}

func (config *UserConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"Events": &ent.AssociationEdge{
			EntConfig: EventConfig{},
		},
	}
}
