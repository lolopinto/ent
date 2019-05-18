package ent

type Entity interface {

	// GetType returns the NodeType of this entity
	GetType() NodeType
}
