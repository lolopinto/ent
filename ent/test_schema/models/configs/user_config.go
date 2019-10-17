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
		"Contacts": &ent.ForeignKeyEdge{
			EntConfig: ContactConfig{},
		},
		"FamilyMembers": &ent.AssociationEdge{
			EntConfig: UserConfig{},
		},
		"Friends": &ent.AssociationEdge{
			EntConfig: UserConfig{},
			Symmetric: true,
		},
	}
}
