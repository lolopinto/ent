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
			field.StringType(),
		),
		"City": field.F(
			field.StringType(),
		),
		"State": field.F(
			field.StringType(),
		),
		"Zip": field.F(
			field.StringType(),
		),
		"Country": field.F(
			field.StringType(),
		),
		"ResidentNames": field.F(
			field.StringsType(),
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
