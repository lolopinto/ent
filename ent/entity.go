package ent

type Entity interface {

	// GetType returns the NodeType of this entity
	GetID() string // TODO uuid
	GetType() NodeType
	GetPrivacyPolicy() PrivacyPolicy
	dataEntity
}

//type CastFromRawData func(interface{}) error

// todo convert everything else
type dataEntity2 interface {
	FillFromMap(map[string]interface{}) error
}

type DBFields map[string]func(interface{}) error

type dataEntity interface {
	DBFields() DBFields
}
