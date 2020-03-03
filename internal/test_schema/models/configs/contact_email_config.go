package configs

type ContactEmailConfig struct {
	EmailAddress string
	Label        string
	ContactID    string `fkey:"ContactConfig.ID"`
}

// GetTableName returns the underyling database table the model's data is stored
func (config *ContactEmailConfig) GetTableName() string {
	return "contact_emails"
}
