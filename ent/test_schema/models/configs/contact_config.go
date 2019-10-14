package configs

import "github.com/lolopinto/ent/ent"

type ContactConfig struct {
	EmailAddress string `unique:"true"`
	FirstName    string
	LastName     string
	UserID       string `fkey:"UserConfig.ID"`
}

func (config *ContactConfig) GetTableName() string {
	return "contacts"
}

func (config *ContactConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"AllowList": &ent.AssociationEdge{
			EntConfig: UserConfig{},
		},
	}
}
