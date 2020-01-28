// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

package action

import (
	"context"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	builder "github.com/lolopinto/ent/internal/test_schema/models/event"
)

type EditEventRsvpStatusAction struct {
	builder *builder.EventMutationBuilder
}

// EditEventRsvpStatusFromContext is the factory method to get an ...
func EditEventRsvpStatusFromContext(ctx context.Context, event *models.Event) *EditEventRsvpStatusAction {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		panic("tried to perform mutation without a viewer")
	}
	return EditEventRsvpStatus(v, event)
}

// EditEventRsvpStatus is the factory method to get an ...
func EditEventRsvpStatus(v viewer.ViewerContext, event *models.Event) *EditEventRsvpStatusAction {
	action := &EditEventRsvpStatusAction{}
	builder := builder.NewMutationBuilder(
		v,
		ent.EditOperation,
		action.requiredFields(),
		actions.ExistingEnt(event),
	)
	action.builder = builder
	return action
}

func (action *EditEventRsvpStatusAction) GetBuilder() ent.MutationBuilder {
	return action.builder
}

func (action *EditEventRsvpStatusAction) GetTypedBuilder() *builder.EventMutationBuilder {
	return action.builder
}

func (action *EditEventRsvpStatusAction) GetViewer() viewer.ViewerContext {
	return action.builder.GetViewer()
}

func (action *EditEventRsvpStatusAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	return action.builder.SetTriggers(triggers)
}

func (action *EditEventRsvpStatusAction) SetBuilderOnObservers(observers []actions.Observer) error {
	return action.builder.SetObservers(observers)
}

func (action *EditEventRsvpStatusAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(action)
}

func (action *EditEventRsvpStatusAction) Entity() ent.Entity {
	return action.builder.GetEvent()
}

func (action *EditEventRsvpStatusAction) ExistingEnt() ent.Entity {
	return action.builder.ExistingEnt()
}

// AddRsvpStatus sets the RsvpStatus while editing the Event ent
func (action *EditEventRsvpStatusAction) AddRsvpStatus(rsvpStatus string) *EditEventRsvpStatusAction {
	action.builder.SetEnumValue(rsvpStatus)
	return action
}

// AddUserID sets the UserID while editing the Event ent
func (action *EditEventRsvpStatusAction) AddUserID(userID string) *EditEventRsvpStatusAction {
	action.builder.SetIDValue(userID, models.UserType)
	return action
}

func (action *EditEventRsvpStatusAction) requiredFields() []string {
	return []string{}
}

// Validate returns an error if the current state of the action is not valid
func (action *EditEventRsvpStatusAction) Validate() error {
	return action.builder.Validate()
}

// Save is the method called to execute this action and save change
func (action *EditEventRsvpStatusAction) Save() (*models.Event, error) {
	err := actions.Save(action)
	return action.builder.GetEvent(), err
}

var _ actions.Action = &EditEventRsvpStatusAction{}
