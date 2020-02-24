package ent

import (
	"time"
)

// Timestamps adds 2 time fields to each ent. Right now, it's gotten from ent.Node
// which is automatically added 2 each ent. Eventually, there'll be a corresponding TimestampsConfig or TimestampsPattern
// which adds this and there could be ents which aren't Nodes which have these (e.g. AssocEdgeData)
type Timestamps struct {
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

// Node is a default reusable object that comes with the ent-framework
// Right now, all ents have to be nodes. Eventually, we'll have a corresponding NodeConfig
// that is used to add this to the generated ents.
type Node struct {
	ID string `db:"id"`
	Timestamps
}

// GetID returns the ID of the ent
func (node *Node) GetID() string {
	return node.ID
}
