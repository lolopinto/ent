package configs

import (
	"time"

	"github.com/lolopinto/ent/ent"
)

type EventConfig struct {
	Name      string
	UserID    string
	StartTime time.Time
	EndTime   time.Time // optional but we don't have that yet...
	Location  string
}

func (config *EventConfig) GetTableName() string {
	return "events"
}

func (config *EventConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"User": &ent.FieldEdge{
			FieldName:   "UserID",
			EntConfig:   UserConfig{},
			InverseEdge: "Events",
		},
		"Invited": &ent.AssociationEdge{
			EntConfig: UserConfig{},
		},
	}
}
