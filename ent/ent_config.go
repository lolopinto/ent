package ent

// Config interface that configurations for different ents should implement.
type Config interface {
	// GetTableName returns the underyling database table the model's data is stored
	// TODO how do we get a default value???
	// TOOD embedding or something fancier later with default values may be better
	GetTableName() string
}

// FieldEdge refers to when the Edge being loaded from an ent is a field on the same node/ent
type FieldEdge struct {
	FieldName string
	EntConfig interface{} // zero-value of the struct...
}

// ForeignKeyEdge is when the edge is handled by having a foreign key in the other table
// So contacts -> contact_emails with the ContactID being a field stored in ContactEmail table
// There'll be a ForeignKey edge from Contact -> ContactEmails and then a FieldEdge from ContactEmail to Contact
type ForeignKeyEdge struct {
	EntConfig interface{} // zero-value of the struct
}

// AssociationEdge is the fb-style edge where the information is stored in the edges_info table.
// This is the preferred edge in the framework
type AssociationEdge struct {
	EntConfig interface{} // zero-value of the struct
	// TODO custom table
	// TODO generate the edge and other fun things later
	// TODO existing edge to use instead of "generating" a new one.

	// TODO inverse and other fun things about edges
	// same with foreign key edge
}
