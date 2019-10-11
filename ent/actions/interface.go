package actions

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type Action interface {
	// GetFieldMap() should be a node based action thingy and not part of the top level action here
	GetFieldMap() ent.ActionFieldMap

	GetViewer() viewer.ViewerContext
	PerformAction() error // always calls Validate()
	//	GetOperation()  todo we should probably know if create/edit/delete
}

type ActionWithValidator interface {
	Action
	Validate() error
}

type ActionWithPermissions interface {
	Action
	GetPrivacyPolicy() ent.PrivacyPolicy
	GetUnderlyingEnt() ent.Entity // maybe this should not even be here and should just be on Action
}

type ActionPermissionsError struct{}

func (err *ActionPermissionsError) Error() string {
	// TODO flesh this out more
	return "viewer cannot perform the action"
}

func Save(action Action) error {
	if actionWithPerms, ok := action.(ActionWithPermissions); ok {
		if err := applyActionPermissions(actionWithPerms); err != nil {
			return err
		}
	}

	if actionWithValidator, ok := action.(ActionWithValidator); ok {
		if err := actionWithValidator.Validate(); err != nil {
			return err
		}
	}

	// TODO observers and triggers
	// TODO this will return a builder and triggers will return a builder instead of this
	// so everything will be handled in here as opposed to having PerformAction be callable on its own
	return action.PerformAction()
}

func applyActionPermissions(action ActionWithPermissions) error {
	err := ent.ApplyPrivacyPolicy(action.GetViewer(), action, action.GetUnderlyingEnt())
	if ent.IsPrivacyError(err) {
		return &ActionPermissionsError{}
	}
	if err != nil {
		return err
	}
	return nil
}
