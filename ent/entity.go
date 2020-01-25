package ent

import "github.com/lolopinto/ent/ent/viewer"

type ObjectWithPrivacyPolicy interface {
	GetPrivacyPolicy() PrivacyPolicy
}

type Entity interface {
	ObjectWithPrivacyPolicy
	// GetType returns the NodeType of this entity
	GetID() string // TODO uuid
	GetType() NodeType
	GetViewer() viewer.ViewerContext

	// TODO break this into EntityBackedByDB or something
	dataEntity
}

// flag that we can't structScan and have to mapScan from db
// TODO figure this out if there's a better way of doing this
type dataEntityNotScannable interface {
	UnsupportedScan() bool
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
