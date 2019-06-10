package ent

import (
	"time"
)

type Node struct {
	ID        string
	CreatedAt time.Time
	UpdatedAt time.Time
	//	Viewer    viewer.ViewerContext // may make more sense here? and therefore need to change packages again?
}
