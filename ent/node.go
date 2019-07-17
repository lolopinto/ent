package ent

import (
	"time"
)

type Timestamps struct {
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Node struct {
	ID string
	Timestamps
	//	Viewer    viewer.ViewerContext // may make more sense here? and therefore need to change packages again?
}
