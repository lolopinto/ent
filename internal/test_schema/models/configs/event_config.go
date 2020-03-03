package configs

import (
	"time"

	"github.com/lolopinto/ent/ent"
)

type EventConfig struct {
	Name string
	// TODO change this as I'm changing typescript API here...
	UserID    string //-> ref UserConfig.Events so we know when to set that we write this
	StartTime time.Time
	EndTime   time.Time `nullable:"true"`
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
		// you can have multiple hosts
		"Hosts": &ent.AssociationEdge{
			EntConfig: UserConfig{},
		},
		"Creator": &ent.AssociationEdge{
			EntConfig: UserConfig{},
			Unique:    true,
		},
		"Rsvps": ent.AssociationEdgeGroup{
			GroupStatusName: "RsvpStatus",
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action: ent.EdgeGroupAction,
				},
			},
			// re-use existing event_invited_edges table
			CustomTableName: "event_invited_edges",
			ActionEdges: []string{
				"Attending",
				"Declined",
			},
			EdgeGroups: ent.AssocEdgeMap{
				"Invited": &ent.AssociationEdge{
					EntConfig: UserConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						EdgeName: "InvitedEvents",
					},
				},
				"Attending": &ent.AssociationEdge{
					EntConfig: UserConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						EdgeName: "EventsAttending",
					},
				},
				"Declined": &ent.AssociationEdge{
					EntConfig: UserConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						EdgeName: "DeclinedEvents",
					},
				},
			},
		},
	}
}

func (config *EventConfig) GetActions() []*ent.ActionConfig {
	return []*ent.ActionConfig{
		&ent.ActionConfig{
			Action: ent.CreateAction,
		},
	}
}
