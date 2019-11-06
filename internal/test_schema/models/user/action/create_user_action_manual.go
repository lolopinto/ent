package action

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	contact "github.com/lolopinto/ent/internal/test_schema/models/contact/action"
	builder "github.com/lolopinto/ent/internal/test_schema/models/user"
)

func (action *CreateUserAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&UserCreateContactTrigger{},
	}
}

type UserCreateContactTrigger struct {
	builder.UserMutationBuilderTrigger
}

func (trigger *UserCreateContactTrigger) GetChangeset() (ent.Changeset, error) {
	return contact.CreateContact(trigger.Builder.GetViewer()).
		SetFirstName(trigger.Builder.GetFirstName()).
		SetLastName(trigger.Builder.GetLastName()).
		SetEmailAddress(trigger.Builder.GetEmailAddress()).
		SetUserIDBuilder(trigger.Builder).
		SetFavorite(false).
		SetPi(3.14).
		SetNumberOfCalls(2).
		GetChangeset()
}
