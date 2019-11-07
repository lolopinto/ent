package actions_test

import (
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
	"github.com/lolopinto/ent/internal/testingutils"
)

type eventAction struct {
	viewer  viewer.ViewerContext
	event   models.Event
	builder *actions.EntMutationBuilder
}

func (a *eventAction) GetViewer() viewer.ViewerContext {
	return a.viewer
}

func (a *eventAction) Entity() ent.Entity {
	return &a.event
}

func (a *eventAction) getChangeset(operation ent.WriteOperation, existingEnt ent.Entity) (ent.Changeset, error) {
	a.builder.FieldMap = getFieldMapFromFields(a.builder.Operation, a.builder.GetFields())
	return a.builder.GetChangeset()
}

type createEventAction struct {
	eventAction
}

func eventCreateAction(
	viewer viewer.ViewerContext,
) *createEventAction {
	action := createEventAction{}
	b := actions.NewMutationBuilder(
		viewer,
		ent.InsertOperation,
		&action.event,
		&configs.EventConfig{},
	)
	action.viewer = viewer
	fields := testingutils.GetDefaultEventFieldsUserID(viewer.GetViewerID())
	for k, v := range fields {
		b.SetField(k, v)
	}
	action.builder = b

	return &action
}

// this will be auto-generated for actions
// We need to do this because of how go's type system works
func (a *createEventAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
	// hmm
	a.builder.SetTriggers(triggers)
	for _, t := range triggers {
		trigger, ok := t.(EventTrigger)
		if !ok {
			return errors.New("invalid trigger")
		}
		trigger.SetBuilder(a.builder)
	}
	return nil
}

func (a *createEventAction) GetChangeset() (ent.Changeset, error) {
	return a.getChangeset(ent.InsertOperation, nil)
}

func (a *createEventAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&EventSetUserToEventTrigger{},
		&EventSetHostTrigger{},
		&EventSetCreatorTrigger{},
	}
}

type EventTrigger interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type EventMutationBuilderTrigger struct {
	Builder *actions.EntMutationBuilder
}

func (trigger *EventMutationBuilderTrigger) SetBuilder(b *actions.EntMutationBuilder) {
	trigger.Builder = b
}

type EventSetUserToEventTrigger struct {
	EventMutationBuilderTrigger
}

func (trigger *EventSetUserToEventTrigger) GetChangeset() (ent.Changeset, error) {
	// instead of using viewer which may not be correct when embedded in other mutations, let's use UserID field
	// TODO still need to solve the embedded viewer issue later...
	userID := trigger.Builder.GetFields()["UserID"]

	trigger.Builder.AddInboundEdge(
		models.UserToEventsEdge,
		userID,
		models.UserType,
	)
	return nil, nil
}

type EventSetHostTrigger struct {
	EventMutationBuilderTrigger
}

func (trigger *EventSetHostTrigger) GetChangeset() (ent.Changeset, error) {
	// hmm viewer is logged out so can't really do this one
	// when doing user -> event since there's no viewer...

	userID := trigger.Builder.GetFields()["UserID"]
	trigger.Builder.AddOutboundEdge(
		models.EventToHostsEdge,
		userID,
		models.UserType,
	)
	return nil, nil
}

type EventSetCreatorTrigger struct {
	EventMutationBuilderTrigger
}

func (trigger *EventSetCreatorTrigger) GetChangeset() (ent.Changeset, error) {
	// instead of using viewer which may not be correct when embedded in other mutations, let's use UserID field
	// TODO still need to solve the embedded viewer issue later...
	userID := trigger.Builder.GetFields()["UserID"]

	trigger.Builder.AddOutboundEdge(
		models.EventToCreatorEdge,
		userID,
		models.UserType,
	)
	return nil, nil
}

var _ actions.ActionWithTriggers = &createEventAction{}
