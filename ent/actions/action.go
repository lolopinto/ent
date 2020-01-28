package actions

import (
	"log"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type Action interface {
	GetViewer() viewer.ViewerContext

	// this exists and is just called by clients e.g. in triggers
	// and the generated code calls actions.GetChangeset() which calls GetBuilder
	GetChangeset() (ent.Changeset, error)
	// where new ent should be stored.
	Entity() ent.Entity

	GetBuilder() ent.MutationBuilder
}

type ActionWithValidator interface {
	Action
	Validate() error // TODO move this into Action. If we're going to have a Validate() method
}

type ActionWithPermissions interface {
	Action
	GetPrivacyPolicy() ent.PrivacyPolicy
}

type ActionPermissionsError struct{}

func (err *ActionPermissionsError) Error() string {
	// TODO flesh this out more
	return "viewer cannot perform the action"
}

type Trigger interface {
	GetChangeset() (ent.Changeset, error)
}

type ActionWithTriggers interface {
	Action
	// TODO: dependencies between triggers needed. we'll do dependencies by creating something similar to MultiChangesets that takes 2 or more triggers that depend on each other
	GetTriggers() []Trigger
	SetBuilderOnTriggers([]Trigger)
}

// Observer is something that's run after an action has been run
// This is where things like send email, send push notification etc are run
// They are run IFF the action succeeds. They are not run within the transaction where the action, trigger, validator etc all runs
type Observer interface {
	Observe() error
}

// // hmmm come back is this what we want?
// e.g. API call to do something and if something fails, call the Rollback method to try and revert the critical observer
// Doesn't have eventual consistency built in here
// You could imagine scheduling an async job or something here which eventually confirms that whatever was done in this critical observer is eventually fixed
// type CriticalObserver interface {
// 	Observer
// 	Rollback() error
// }

type ActionWithObservers interface {
	Action
	GetObservers() []Observer
	SetBuilderOnObservers([]Observer)
}

type ChangesetWithObservers interface {
	ent.Changeset
	Observers() []Observer
}

type ChangesetWithValidators interface {
	ent.Changeset
	Validators() []Validator
}

type Validator interface {
	Validate() error
}

type ActionWithValidators interface {
	Action
	GetValidators() []Validator
	SetBuilderOnValidators([]Validator)
}

func GetChangeset(action Action) (ent.Changeset, error) {
	if actionWithPerms, ok := action.(ActionWithPermissions); ok {
		if err := applyActionPermissions(actionWithPerms); err != nil {
			return nil, err
		}
	}

	// permissions first check!
	// then triggers
	// then validate state
	// then changeset which runs the whole damn thing
	if actionWithTriggers, ok := action.(ActionWithTriggers); ok {
		setBuilderOnTriggers(actionWithTriggers)
	}

	if actionWithObservers, ok := action.(ActionWithObservers); ok {
		setBuilderOnObservers(actionWithObservers)
	}

	if actionWithValidators, ok := action.(ActionWithValidators); ok {
		setBuilderOnValidators(actionWithValidators)
	}

	if actionWithValidator, ok := action.(ActionWithValidator); ok {
		if err := actionWithValidator.Validate(); err != nil {
			return nil, err
		}
	}

	// TODO need a concurrent API for these things...
	return action.GetBuilder().GetChangeset()
}

func Save(action Action) error {
	changeset, err := GetChangeset(action)
	if err != nil {
		return err
	}

	// nothing to save here
	if changeset == nil {
		return nil
	}

	if err = ent.SaveChangeset(changeset); err != nil {
		return err
	}
	cWithObservers, ok := changeset.(ChangesetWithObservers)
	if !ok {
		log.Print("no observers")
		return nil
	}
	for _, observer := range cWithObservers.Observers() {
		// observers don't break the action, we just log them
		// TODO we need to hook this into a better framework that handles this
		if err := observer.Observe(); err != nil {
			log.Println("error from observer:", err)
		}
	}
	return nil
}

func applyActionPermissions(action ActionWithPermissions) error {
	err := ent.ApplyPrivacyPolicy(action.GetViewer(), action.GetPrivacyPolicy(), action.GetBuilder().ExistingEnt())
	if ent.IsPrivacyError(err) {
		return &ActionPermissionsError{}
	}
	if err != nil {
		return err
	}
	return nil
}

func setBuilderOnTriggers(action ActionWithTriggers) {
	action.SetBuilderOnTriggers(action.GetTriggers())
}

func setBuilderOnObservers(action ActionWithObservers) {
	action.SetBuilderOnObservers(action.GetObservers())
}

func setBuilderOnValidators(action ActionWithValidators) {
	action.SetBuilderOnValidators(action.GetValidators())
}
