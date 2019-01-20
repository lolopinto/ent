package models

type NodeType string

const (
	// top level unique types that can be an owner of something else
	// For now, we allow all types but long term probably makes sense to scope
	// it per object/edge
	UserType    NodeType = "user_type"
	NoteType    NodeType = "note_type"
	ContactType NodeType = "contact_type"
)
