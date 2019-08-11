package ent

type Entity interface {

	// GetType returns the NodeType of this entity
	GetID() string // TODO uuid
	GetType() NodeType
	GetPrivacyPolicy() PrivacyPolicy
	dataEntity
}

type dataEntity interface {
	FillFromMap(map[string]interface{}) error
}
