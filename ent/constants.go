package ent

type NodeType string

const (
// top level unique types that can be an owner of something else
// For now, we allow all types but long term probably makes sense to scope
// it per object/edge
// UserType    NodeType = "user"
// NoteType    NodeType = "note"
// ContactType NodeType = "contact"
)

// EdgeType represents the edge between two nodes. Underlying format is uuid
type EdgeType string

const (
// UserToNotesEdge represents the edge from a user to their notes
//UserToNotesEdge EdgeType = "84874ea0-5534-49bd-8a9c-ba7a724a27e8"
)
