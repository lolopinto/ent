package actions

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type Action interface {
	GetViewer() viewer.ViewerContext
	//	GetBuilder() ent.MutationBuilder

	// this exists and is just called by clients e.g. in triggers
	// and the generated code calls actions.GetChangeset() which calls GetBuilder
	GetChangeset() (ent.Changeset, error)
	// where new ent should be stored.
	Entity() ent.Entity

	// what happens when we need multiple builders
	// MultiBuilder?
	GetBuilder() ent.MutationBuilder
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
	// TODO: dependencies between triggers needed. we'll do dependencies by creating something similar to MultiChangesets that takes 2 or more triggers that depend on each other
	GetTriggers() []Trigger
	SetBuilderOnTriggers([]Trigger) error
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
		if err := setBuilderOnTriggers(actionWithTriggers); err != nil {
			return nil, err
		}
	}

	if actionWithValidator, ok := action.(ActionWithValidator); ok {
		if err := actionWithValidator.Validate(); err != nil {
			return nil, err
		}
	}

	// TODO observers
	// TODO this will return a builder and triggers will return a builder instead of this
	// so everything will be handled in here as opposed to having PerformAction be callable on its own
	// triggers and dependencies!
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
