package configs

import "github.com/lolopinto/ent/ent"

type ContactEmailConfig struct {
	EmailAddress string
	Label        string
	ContactID    string `fkey:"ContactConfig.ID"`
}

// GetTableName returns the underyling database table the model's data is stored
func (config *ContactEmailConfig) GetTableName() string {
	return "contact_emails"
}

// GetEdges returns the Edges that the ContactEmail node supports
func (config *ContactEmailConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"Contact": ent.FieldEdge{
			FieldName: "ContactID",
			EntConfig: ContactConfig{},
		},
	}
}
