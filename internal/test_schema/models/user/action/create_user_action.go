package action

import (
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	contact "github.com/lolopinto/ent/internal/test_schema/models/contact/action"
	builder "github.com/lolopinto/ent/internal/test_schema/models/user"
	"github.com/lolopinto/ent/internal/testingutils"
)

func (action *CreateUserAction) GetTriggers() []actions.Trigger {
	return []actions.Trigger{
		&UserCreateContactTrigger{},
	}
}

func (action *CreateUserAction) GetObservers() []actions.Observer {
	return []actions.Observer{
		&testingutils.ActionLoggerObserver{Action: action},
		&UserSendWelcomeEmailObserver{},
	}
}

type UserCreateContactTrigger struct {
	builder.UserMutationCallback
}

func (trigger *UserCreateContactTrigger) GetChangeset() (ent.Changeset, error) {
	return contact.CreateContact(trigger.Builder.GetViewer()).
		SetFirstName(trigger.Builder.GetFirstName()).
		SetLastName(trigger.Builder.GetLastName()).
		SetEmailAddress(trigger.Builder.GetEmailAddress()).
		SetUserIDBuilder(trigger.Builder).
		GetChangeset()
}

type UserSendWelcomeEmailObserver struct {
	builder.UserMutationCallback
}

func (observer *UserSendWelcomeEmailObserver) Observe() error {
	email := observer.Builder.GetEmailAddress()
	firstName := observer.Builder.GetFirstName()

	emailHandler := &testingutils.SendEmailHandler{
		Text:  fmt.Sprintf("Hello %s, welcome to our magical website", firstName),
		Email: email,
	}
	return emailHandler.SendEmail()
}
