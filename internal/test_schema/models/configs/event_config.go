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
		// you can have multiple hosts
		"Hosts": &ent.AssociationEdge{
			EntConfig: UserConfig{},
		},
		// TODO singular edge
		"Creator": &ent.AssociationEdge{
			EntConfig: UserConfig{},
		},
		"Rsvps": ent.AssociationEdgeGroup{
			GroupStatusName: "RsvpStatus",
			// EdgeAction: &ent.EdgeActionConfig{
			// 	Action: ent.EdgeGroupAction,
			// },
			// re-use existing event_invited_edges table
			CustomTableName: "event_invited_edges",
			ActionEdges: []string{
				"Attending",
				"Declined",
			},
			EdgeGroups: ent.EdgeMap{
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
