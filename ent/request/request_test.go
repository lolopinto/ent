package request

import (
	"log"
	"net/http"
	"testing"

	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/internal/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type requestsTestSuite struct {
	suite.Suite
}

func (suite *requestsTestSuite) SetupTest() {
	unregisterAllMiddlewares()
}

func fooHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Println("foo called")
		next.ServeHTTP(w, r)
	})
}

func barHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Println("bar called")
		next.ServeHTTP(w, r)
	})
}

func bazHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Println("baz called")
		next.ServeHTTP(w, r)
	})
}

func queryHandler(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("yay!"))
}

func (suite *requestsTestSuite) TestRegister() {
	Register("foo", fooHandler)
	assert.Equal(suite.T(), len(middlewares), 1)
	assert.Len(suite.T(), middlewares["foo"], 1)
}

func (suite *requestsTestSuite) TestRegisterMultiple() {
	Register("foobar", fooHandler, barHandler)
	assert.Len(suite.T(), middlewares, 1)
	assert.Len(suite.T(), middlewares["foobar"], 2)
}

func (suite *requestsTestSuite) TestRegisterMultipleTimes() {
	Register("foobar", fooHandler, barHandler)
	Register("baz", bazHandler)

	assert.Len(suite.T(), middlewares, 2)
	assert.Len(suite.T(), middlewares["foobar"], 2)
	assert.Len(suite.T(), middlewares["baz"], 1)
}

func (suite *requestsTestSuite) TestServerHandler() {
	Register("foo", fooHandler)

	suite.testServer([]string{"foo called"})
}

func (suite *requestsTestSuite) TestServerMultipleHandlers() {
	Register("foobar", fooHandler, barHandler)

	suite.testServer([]string{"foo called", "bar called"})
}

func (suite *requestsTestSuite) TestServerMultipleTimes() {
	Register("foobar", fooHandler, barHandler)
	Register("baz", bazHandler)

	suite.testServer([]string{"foo called", "bar called"}, []string{"baz called"})
}

func (suite *requestsTestSuite) testServer(orderedLogs ...[]string) {
	httptest.TestServer(
		suite.T(),
		queryHandler,
		"yay!",
		func(r *mux.Router, req *http.Request) {
			// take every registered handler and make sure it's used by the router
			for _, v := range GetAllMiddlewares() {
				r.Use(v)
			}
		},
		orderedLogs...,
	)
}

func TestRequests(t *testing.T) {
	suite.Run(t, new(requestsTestSuite))
}
