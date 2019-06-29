package configs

import "time"

// AccountConfig is the config for test accounts in test land
type AccountConfig struct {
	FirstName      string
	LastName       string
	PhoneNumber    string
	NumberOfLogins int // stupid thing to store in an account but needed for testing purposes...
	LastLoginAt    time.Time
}

// GetTableName returns the underyling database table the account model's data is stored
func (config *AccountConfig) GetTableName() string {
	return "accounts"
}
