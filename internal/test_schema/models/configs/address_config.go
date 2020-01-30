package configs

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/field"
)

type AddressConfig struct{}

func (config *AddressConfig) GetTableName() string {
	return "addresses"
}

// GetFields returns the fields for the `Address` model
func (config *AddressConfig) GetFields() ent.FieldMap {
	return ent.FieldMap{
		"StreetAddress": field.F(
			field.String(),
		),
		"City": field.F(
			field.String(),
		),
		"State": field.F(
			field.String(),
		),
		"Zip": field.F(
			field.String(),
		),
		"Country": field.F(
			field.String(),
		),
		"ResidentNames": field.F(
			field.Strings(),
		),
	}
}

func (config *AddressConfig) GetActions() []*ent.ActionConfig {
	return []*ent.ActionConfig{
		&ent.ActionConfig{
			Action: ent.MutationsAction,
		},
	}
}
