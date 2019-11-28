package configs

import (
	"time"

	"github.com/lolopinto/ent/ent"
)

type EventConfig struct {
	Name      string
	UserID    string
	StartTime time.Time
	EndTime   time.Time
	Location  string
}

func (config *EventConfig) GetTableName() string {
	return "events"
}

func (config *EventConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"Creator": &ent.AssociationEdge{
			EntConfig: AccountConfig{},
			Unique:    true,
		},
	}
}
