package actions_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
)

type eventAction struct {
	viewer  viewer.ViewerContext
	builder *actions.EntMutationBuilder
}

func (a *eventAction) GetViewer() viewer.ViewerContext {
	return a.viewer
}

func (a *eventAction) GetBuilder() ent.MutationBuilder {
	return a.builder
}

func (a *eventAction) Validate() error {
	return a.builder.Validate()
}

func (a *eventAction) Entity() ent.Entity {
	return a.builder.Entity()
}

func (a *eventAction) GetEvent() *models.Event {
	return a.builder.Entity().(*models.Event)
}

type createEventAction struct {
	eventAction
}

func eventCreateAction(
	v viewer.ViewerContext,
) *createEventAction {
	action := createEventAction{}
	loader := models.NewEventLoader(v)
	b := actions.NewMutationBuilder(
		v,
		ent.InsertOperation,
		loader.GetNewEvent(),
		loader.GetConfig(),
	)
	action.viewer = v
	fields := testingutils.GetDefaultEventFieldsUserID(v.GetViewerID())
	b.SetRawFields(fields)
	action.builder = b

	return &action
}

func (a *createEventAction) setBuilder(v interface{}) {
	callback, ok := v.(EventCallbackWithBuilder)
	if ok {
		callback.SetBuilder(a.builder)
	}
}

// these will be auto-generated for actions
// We need to do this because of how go's type system works
func (a *createEventAction) SetBuilderOnTriggers(triggers []actions.Trigger) {
	a.builder.SetTriggers(triggers)
	for _, t := range triggers {
		a.setBuilder(t)
	}
}

func (a *createEventAction) SetBuilderOnObservers(observers []actions.Observer) {
	a.builder.SetObservers(observers)
	for _, o := range observers {
		a.setBuilder(o)
	}
}

func (a *createEventAction) SetBuilderOnValidators(validators []actions.Validator) {
	a.builder.SetValidators(validators)
	for _, v := range validators {
		a.setBuilder(v)
	}
}

func (a *createEventAction) GetChangeset() (ent.Changeset, error) {
	return actions.GetChangeset(a)
}

func (a *createEventAction) Save() (*models.Event, error) {
	err := actions.Save(a)
	if err != nil {
		return nil, err
	}
	return a.GetEvent(), err
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

func (a *createEventAction) GetValidators() []actions.Validator {
	return []actions.Validator{
		&EventTimeValidator{},
	}
}

type EventCallbackWithBuilder interface {
	SetBuilder(*actions.EntMutationBuilder)
}

type EventMutationCallback struct {
	Builder *actions.EntMutationBuilder
}

func (callback *EventMutationCallback) SetBuilder(b *actions.EntMutationBuilder) {
	callback.Builder = b
}

type EventSetUserToEventTrigger struct {
	EventMutationCallback
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
	EventMutationCallback
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
	EventMutationCallback
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

type EventTimeValidator struct {
	EventMutationCallback
}

func (validator *EventTimeValidator) Validate() error {
	fields := validator.Builder.GetRawFields()
	startTime := fields["start_time"].(time.Time)
	end := fields["end_time"]

	if end == nil {
		return nil
	}
	endTime := end.(time.Time)
	if startTime.Before(endTime) {
		return nil
	}
	return fmt.Errorf("start time is not before end time %T %T", startTime, endTime)
}

var _ actions.ActionWithTriggers = &createEventAction{}
var _ actions.ActionWithObservers = &createEventAction{}
var _ actions.ActionWithValidators = &createEventAction{}

func verifyEventCreationState(t *testing.T, event *models.Event, user *models.User) {
	testingutils.VerifyEventObj(t, event, user)
	testingutils.VerifyEventToHostEdge(t, event, user)
	testingutils.VerifyEventToCreatorEdge(t, event, user)
	testingutils.VerifyUserToEventEdge(t, user, event)
}
