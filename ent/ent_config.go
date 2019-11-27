package ent

// Config interface that configurations for different ents should implement.
type Config interface {
	// GetTableName returns the underyling database table the model's data is stored
	// TODO how do we get a default value???
	// TOOD embedding or something fancier later with default values may be better
	GetTableName() string
}

// ConfigWithEdges is the interface that EntConfigs which have edges implements
type ConfigWithEdges interface {
	Config
	// GetEdges returns the Edges that the ent supports
	// TODO: change from map[string]inteface{}
	GetEdges() map[string]interface{}
}

// ConfigWithActions is the interface that EntConfig which have actions implements
type ConfigWithActions interface {
	Config
	GetActions() []*ActionConfig
}

// TODO change everywhere from ent.
type EdgeMap map[string]interface{}

// FieldEdge refers to when the Edge being loaded from an ent is a field on the same node/ent
type FieldEdge struct {
	FieldName   string
	EntConfig   interface{} // zero-value of the struct...
	InverseEdge string      // InverseEdge represents the edge from the other ent to this so that when we set the field we know what edge to write
	// can specify it on the other side also. e.g. InverseField NoteID so that we know what field to write
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
	//CustomTableName string      // TODO come back
	// have to pick one or the other
	//InverseEdge *AssociationEdge
	InverseEdge *InverseAssocEdge
	Symmetric   bool
	// Unique indicates that there's only one instance of this edge
	Unique bool

	// TODO custom table
	// TODO generate the edge and other fun things later
	// TODO existing edge to use instead of "generating" a new one.

	// TODO inverse and other fun things about edges
	// same with foreign key edge
	EdgeAction *EdgeActionConfig
}

//type EdgeGroup map[string]*AssociationEdge

type AssociationEdgeGroup struct {
	EdgeGroups      EdgeMap
	GroupStatusName string // Name of the group e.g. Rsvp. will be used to create a Node{GroupName}Status object and a bunch of other things
	EdgeAction      *EdgeActionConfig
	CustomTableName string

	// Edges limits the edges that are used in the status action calculations. status map.
	// If no edges are provided, all in the group are
	ActionEdges []string
	// TODO: expand on this more. basically the edges that can be set. they should all have the same Config...
	// handle this later
}

type AssociationEdgeGroupStatusInfo struct {
	EdgeName          string
	Edge              EdgeType
	ConstName         interface{}
	UseInStatusAction bool
}

type AssocStatusMap map[string]*AssociationEdgeGroupStatusInfo

type InverseAssocEdge struct {
	EdgeName string
	// TODO make this more configurable also. for now, we just use default values
	// similar to assoc edge
}
