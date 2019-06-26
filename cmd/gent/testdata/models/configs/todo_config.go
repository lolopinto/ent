package configs

// TodoConfig is the config for test todos in test land
type TodoConfig struct {
	Completed bool
	Text      string
	AccountID string `fkey:"AccountConfig.ID"`
}

// GetTableName returns the underyling database table the todo model's data is stored
func (config *TodoConfig) GetTableName() string {
	return "todos"
}
