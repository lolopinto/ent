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
		"Rsvps": ent.AssociationEdgeGroup{
			GroupStatusName: "RsvpStatus",
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action:            ent.EdgeGroupAction,
					CustomActionName:  "EventRsvpAction",
					CustomGraphQLName: "eventRSVP",
				},
			},
			CustomTableName: "event_rsvp_edges",
			ActionEdges: []string{
				"Attending",
				"Declined",
			},
			EdgeGroups: ent.AssocEdgeMap{
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
