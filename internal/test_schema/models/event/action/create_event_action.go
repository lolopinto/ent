package action

import (
	"fmt"

	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/internal/test_schema/models/event"
)

func (action *CreateEventAction) GetValidators() []actions.Validator {
	return []actions.Validator{
		&EventTimeValidator{},
	}
}

type EventTimeValidator struct {
	event.EventMutationCallback
}

func (v *EventTimeValidator) Validate() error {
	startTime := v.Builder.GetStartTime()
	endTime := v.Builder.GetEndTime()

	if endTime == nil || startTime.Before(*endTime) {
		return nil
	}

	return fmt.Errorf("start time %T is not before end time %T", startTime, endTime)
}
