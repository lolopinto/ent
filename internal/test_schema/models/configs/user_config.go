package configs

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/field"
	"github.com/lolopinto/ent/ent/field/email"
	"github.com/lolopinto/ent/ent/field/password"
	"github.com/lolopinto/ent/ent/field/phonenumber"
)

type UserConfig struct{}

func (config *UserConfig) GetFields() ent.FieldMap {
	return ent.FieldMap{
		"EmailAddress": field.F(email.Type(), field.Unique()),
		"Password":     field.F(password.Type()),
		"FirstName":    field.F(field.StringType()),
		"LastName":     field.F(field.StringType()),
		"Bio":          field.F(field.StringType(), field.Nullable()),
		"PhoneNumber":  field.F(phonenumber.Type(), field.Unique(), field.Nullable()),
	}
}

func (config *UserConfig) GetTableName() string {
	return "users"
}

func (config *UserConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"Events": &ent.AssociationEdge{
			EntConfig: EventConfig{},
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
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action: ent.AddEdgeAction,
				},
				&ent.EdgeActionConfig{
					Action: ent.RemoveEdgeAction,
				},
			},
		},
	}
}

func (config *UserConfig) GetActions() []*ent.ActionConfig {
	return []*ent.ActionConfig{
		&ent.ActionConfig{
			Action: ent.CreateAction,
			Fields: []string{
				// TODO maybe provide an edit-all-fields flag which *overwrites* the private by default nature of this
				"EmailAddress",
				"Password",
				"FirstName",
				"LastName",
				"Bio",
				"PhoneNumber",
			},
		},
		&ent.ActionConfig{
			Action: ent.EditAction,
			Fields: []string{
				// can't edit email address, password and phone number since
				// those are special fields that require extra permissions/checks so they'll
				// be broken up into their own action (and graphql mutation)
				"FirstName",
				"LastName",
				"Bio",
			},
		},
		&ent.ActionConfig{
			Action: ent.DeleteAction,
		},
	}
}
