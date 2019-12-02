package configs

import "github.com/lolopinto/ent/ent"

type UserConfig struct {
	EmailAddress string `unique:"true"`
	FirstName    string
	LastName     string
	Bio          string `nullable:"true"`
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
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action: ent.RemoveEdgeAction,
				},
				&ent.EdgeActionConfig{
					Action: ent.AddEdgeAction,
				},
			},
		},
		"Friends": &ent.AssociationEdge{
			EntConfig: UserConfig{},
			Symmetric: true,
			// uhh how do we remove this?
			// lol such a broken API. Need add and remove here...
			// TODO add remove...
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action: ent.AddEdgeAction,
				},
			},
		},
	}
}

func (config *UserConfig) GetActions() []*ent.ActionConfig {
	return []*ent.ActionConfig{
		&ent.ActionConfig{
			Action: ent.CreateAction,
		},
		&ent.ActionConfig{
			Action: ent.EditAction,
		},
		&ent.ActionConfig{
			Action: ent.DeleteAction,
		},
	}
}
