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
		"Rsvps": ent.AssociationEdgeGroup{
			GroupStatusName: "RsvpStatus",
			EdgeAction: &ent.EdgeActionConfig{
				Action: ent.EdgeGroupAction,
			},
			CustomTableName: "event_rsvp_edges",
			ActionEdges: []string{
				"Attending",
				"Declined",
			},
			EdgeGroups: ent.EdgeMap{
				"Invited": &ent.AssociationEdge{
					EntConfig: AccountConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						EdgeName: "InvitedEvents",
					},
				},
				"Attending": &ent.AssociationEdge{
					EntConfig: AccountConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						EdgeName: "EventsAttending",
					},
				},
				"Declined": &ent.AssociationEdge{
					EntConfig: AccountConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						EdgeName: "DeclinedEvents",
					},
				},
			},
		},
	}
}
