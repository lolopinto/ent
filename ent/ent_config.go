package ent

// Config interface that configurations for different ents should implement.
type Config interface {
	// GetTableName returns the underyling database table the model's data is stored
	// TODO how do we get a default value???
	// TOOD embedding or something fancier later with default values may be better
	GetTableName() string
}
