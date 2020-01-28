package actions_test

import (
	"errors"
	"testing"

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

func (a *eventAction) GetBuilder() ent.MutationBuilder {
	return a.builder
}

func (a *eventAction) Entity() ent.Entity {
	return &a.event
}

type createEventAction struct {
	eventAction
}

func eventCreateAction(
	v viewer.ViewerContext,
) *createEventAction {
	action := createEventAction{}
	b := actions.NewMutationBuilder(
		v,
		ent.InsertOperation,
		&action.event,
		&configs.EventConfig{},
	)
	action.viewer = v
	fields := testingutils.GetDefaultEventFieldsUserID(v.GetViewerID())
	b.SetRawFields(fields)
	action.builder = b

	return &action
}

// this will be auto-generated for actions
// We need to do this because of how go's type system works
func (a *createEventAction) SetBuilderOnTriggers(triggers []actions.Trigger) error {
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

func (a *createEventAction) SetBuilderOnObservers(observers []actions.Observer) error {
	a.builder.SetObservers(observers)
	for _, o := range observers {
		observer, ok := o.(EventObserver)
		if ok {
			observer.SetBuilder(a.builder)
		}
	}
	return nil
}

func (a *createEventAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func (a *createEventAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&EventSetUserToEventTrigger{},
		&EventSetHostTrigger{},
		&EventSetCreatorTrigger{},
	}
}

func (a *createEventAction) GetObservers() []actions.Observer {
	return []actions.Observer{
		&testingutils.ActionLoggerObserver{Action: a},
	}
}

// uhh we should combine these...
// and the generated Trigger and Builder things
// EventCallbackWithBuilder?
// EventWithBuilder?
// EventSideEffectWithBuilder?
// EventActionWithBuilder?
type EventTrigger interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type EventObserver interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type EventMutationBuilderTrigger struct {
	Builder *actions.EntMutationBuilder
}

func (trigger *EventMutationBuilderTrigger) SetBuilder(b *actions.EntMutationBuilder) {
	trigger.Builder = b
}

type EventMutationBuilderObserver struct {
	Builder *actions.EntMutationBuilder
}

func (observer *EventMutationBuilderObserver) SetBuilder(b *actions.EntMutationBuilder) {
	observer.Builder = b
}

type EventSetUserToEventTrigger struct {
	EventMutationBuilderTrigger
}

func (trigger *EventSetUserToEventTrigger) GetChangeset() (ent.Changeset, error) {
	// instead of using viewer which may not be correct when embedded in other mutations, let's use UserID field
	// TODO still need to solve the embedded viewer issue later...
	userID := trigger.Builder.GetRawFields()["user_id"]

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

	userID := trigger.Builder.GetRawFields()["user_id"]
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
	userID := trigger.Builder.GetRawFields()["user_id"]

	trigger.Builder.AddOutboundEdge(
		models.EventToCreatorEdge,
		userID,
		models.UserType,
	)
	return nil, nil
}

var _ actions.ActionWithTriggers = &createEventAction{}
var _ actions.ActionWithObservers = &createEventAction{}

func verifyEventCreationState(t *testing.T, event *models.Event, user *models.User) {
	testingutils.VerifyEventObj(t, event, user)
	testingutils.VerifyEventToHostEdge(t, event, user)
	testingutils.VerifyEventToCreatorEdge(t, event, user)
	testingutils.VerifyUserToEventEdge(t, user, event)
}
