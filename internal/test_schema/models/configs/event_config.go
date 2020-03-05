package configs

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/field"
)

type EventConfig struct{}

func (config *EventConfig) GetFields() ent.FieldMap {
	return ent.FieldMap{
		"Name": field.F(field.StringType()),
		// also write the User -> Events edge when this field is set
		"UserID":    field.F(field.StringType(), field.FieldEdge("UserConfig", "Events")),
		"StartTime": field.F(field.TimeType()),
		"EndTime":   field.F(field.TimeType(), field.Nullable()),
		"Location":  field.F(field.StringType()),
	}
}

func (config *EventConfig) GetTableName() string {
	return "events"
}

func (config *EventConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
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
