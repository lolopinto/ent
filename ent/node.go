package ent

import (
	"time"
)

type Timestamps struct {
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

type Node struct {
	ID string `db:"id"`
	Timestamps
	//	Viewer    viewer.ViewerContext // may make more sense here? and therefore need to change packages again?
}

func (node *Node) GetID() string {
	return node.ID
}
