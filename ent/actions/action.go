package actions

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type Action interface {
	GetViewer() viewer.ViewerContext
	GetChangeset() (ent.Changeset, error)
	// where new ent should be stored.
	Entity() ent.Entity
}

type ActionWithValidator interface {
	Action
	Validate() error
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
	// TODO we need a dependency graph so this needs to be more complicated ASAP
	GetTriggers() []Trigger
	SetBuilderOnTriggers([]Trigger) error
}

func Save(action Action) error {
	if actionWithPerms, ok := action.(ActionWithPermissions); ok {
		if err := applyActionPermissions(actionWithPerms); err != nil {
			return err
		}
	}

	// permissions first check!
	// then triggers
	// then validate state
	// then changeset which runs the whole damn thing
	if actionWithTriggers, ok := action.(ActionWithTriggers); ok {
		if err := setBuilderOnTriggers(actionWithTriggers); err != nil {
			return err
		}
	}

	if actionWithValidator, ok := action.(ActionWithValidator); ok {
		if err := actionWithValidator.Validate(); err != nil {
			return err
		}
	}

	// TODO observers
	// TODO this will return a builder and triggers will return a builder instead of this
	// so everything will be handled in here as opposed to having PerformAction be callable on its own
	// triggers and dependencies!
	// TODO need a concurrent API for these things...
	changeset, err := action.GetChangeset()
	if err != nil {
		return err
	}
	return ent.SaveChangeset(changeset)
}

func applyActionPermissions(action ActionWithPermissions) error {
	err := ent.ApplyPrivacyPolicy(action.GetViewer(), action, action.GetPrivacyPolicy().Ent())
	if ent.IsPrivacyError(err) {
		return &ActionPermissionsError{}
	}
	if err != nil {
		return err
	}
	return nil
}

func setBuilderOnTriggers(action ActionWithTriggers) error {
	return action.SetBuilderOnTriggers(action.GetTriggers())
}
