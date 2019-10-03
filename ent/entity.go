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

// implement this interface to indicate that the primary key
// in the table isn't "id" but a different field.
// For now only supports single primary key so not exposing it publicly
type dataEntityWithDiffPKey interface {
	dataEntity
	GetPrimaryKey() string // for now only do single primary key
}
