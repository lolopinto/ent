package configs

type ContactConfig struct {
	EmailAddress string `unique:"true"`
	FirstName    string
	LastName     string
	UserID       string `fkey:"UserConfig.ID"`
}

func (config *ContactConfig) GetTableName() string {
	return "contacts"
}
