package ent

import "github.com/lolopinto/ent/ent/viewer"

type ObjectWithPrivacyPolicy interface {
	GetPrivacyPolicy() PrivacyPolicy
}

type Entity interface {
	ObjectWithPrivacyPolicy
	// GetType returns the NodeType of this entity
	//	GetID() string // TODO uuid
	GetType() NodeType
	GetViewer() viewer.ViewerContext
	GetConfig() Config
	DBObject
}

// flag that we can't structScan and have to mapScan from db
// TODO figure this out if there's a better way of doing this
type dataEntityNotScannable interface {
	UnsupportedScan() bool
}

// MultiEntLoader is for loading multiple ents at the same time.
// It generates a new instance as needed and ensures that the code to load
// these from the db end up being typesafe and use a lot less reflection
type MultiEntLoader interface {
	GetNewInstance() DBObject
	GetConfig() Config
	// TODO kill now
	//	SetResult([]DBObject)
	//	Set
	// hmm TODO
	//	Err() error
}

// PrivacyBackedMultiEntLoader
type PrivacyBackedMultiEntLoader interface {
	MultiEntLoader
	// TODO
	// this can keep track of the internal map?
	SetPrivacyResult(string, DBObject, error)
}

type DBFields map[string]func(interface{}) error

// DBObject references an item fetched from the database
// All ents are DBObjects but not all DBOjects are necessarily ents
// e.g. AssocEdge
type DBObject interface {
	// TODO what happens for tables with composite primary keys??
	GetID() string
	DBFields() DBFields
}

// implement this interface to indicate that the primary key
// in the table isn't "id" but a different field.
// For now only supports single primary key so not exposing it publicly
type DBObjectWithDiffKey interface {
	DBObject
	GetPrimaryKey() string // for now only do single primary key
}
