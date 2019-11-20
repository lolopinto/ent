package testingutils

import (
	"errors"
	"sync"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/stretchr/testify/assert"
)

type logger struct {
	createdEnts map[string]ent.Entity
	sentEmails  map[string]string
	m           sync.Mutex
}

func (l *logger) LogCreatedEnt(ent ent.Entity) {
	l.m.Lock()
	defer l.m.Unlock()
	l.createdEnts[ent.GetID()] = ent
}

func (l *logger) LogSentEmail(emailAddress string, emailContent string) {
	l.m.Lock()
	defer l.m.Unlock()
	// fake email that ignores headers, subject etc...
	l.sentEmails[emailAddress] = emailContent
}

func (l *logger) EntLogged(ent ent.Entity) bool {
	return l.createdEnts[ent.GetID()] != nil
}

func AssertEntLogged(t *testing.T, ent ent.Entity) {
	assert.True(t, getLogger().EntLogged(ent))
}

var once sync.Once
var l *logger

func getLogger() *logger {
	once.Do(func() {
		l = &logger{}
		l.createdEnts = make(map[string]ent.Entity)
		l.sentEmails = make(map[string]string)
	})
	return l
}

// This is reusable across ent types
type ActionLoggerObserver struct {
	Action actions.Action
}

func (observer *ActionLoggerObserver) Observe() error {
	getLogger().LogCreatedEnt(observer.Action.Entity())
	return nil
}

type SendEmailHandler struct {
	Text  string
	Email string
}

func (s *SendEmailHandler) SendEmail() error {
	getLogger().LogSentEmail(s.Email, s.Text)
	return nil
}

func AssertEmailSent(t *testing.T, emailAddress string, emailText string) {
	assert.Equal(t, emailText, getLogger().sentEmails[emailAddress])
}

// boo microserv
type SendMicroserviceObserver struct {
}

func (SendMicroserviceObserver) Observe() error {
	return errors.New("microservice down")
}
