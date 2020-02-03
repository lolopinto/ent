package auth

import (
	"net/http"
	"testing"

	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type authGuestViewer struct {
	ViewerID string
}

func (a authGuestViewer) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	return viewertesting.LoggedinViewerContext{a.ViewerID}
}

type authViewerFromHeader struct{}

func (authViewerFromHeader) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	viewerID := r.Header.Get("Authorization")

	if viewerID == "" {
		return nil
	}
	return viewertesting.LoggedinViewerContext{viewerID}
}

type authTestsSuite struct {
	suite.Suite
}

func (suite *authTestsSuite) SetupTest() {
	Clear()
}

func (suite *authTestsSuite) TestNoRegister() {
	h := suite.testServer("no auth handler returned viewer")

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *authTestsSuite) TestRegister() {
	Register("auth", authGuestViewer{ViewerID: "1"})
	h := suite.testServer("authenticated user 1")

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "1")
}

func (suite *authTestsSuite) TestRegisterHeaderDependentLoggedIn() {
	Register("auth", authViewerFromHeader{})
	h := suite.testServer("authenticated user 1", func(req *http.Request) {
		req.Header.Add("Authorization", "1")
	})

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "1")
}

func (suite *authTestsSuite) TestRegisterHeaderDependentLoggedOut() {
	// didn't get a header so logged out viewer returned
	Register("auth", authViewerFromHeader{})
	h := suite.testServer("no auth handler returned viewer")

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *authTestsSuite) TestRegisterSequenceHeaderDependentLoggedOut() {
	// didn't get a header so defaults to guest viewer context with id 0
	Register("auth", authViewerFromHeader{}, authGuestViewer{ViewerID: "0"})
	h := suite.testServer("authenticated user 0")

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "0")
}

func (suite *authTestsSuite) TestRegisterSequenceHeaderDependentLoggedIn() {
	// have a header so logged in
	Register("auth", authViewerFromHeader{}, authGuestViewer{ViewerID: "0"})
	h := suite.testServer("authenticated user 1", func(req *http.Request) {
		req.Header.Add("Authorization", "1")
	})

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "1")
}

func (suite *authTestsSuite) testServer(
	log string,
	fns ...func(*http.Request)) *httptest.QueryHandler {

	h := httptest.QueryHandler{
		T:        suite.T(),
		Response: []byte("auth response!"),
	}

	httptest.TestServer(
		suite.T(),
		h.HandlerFunc,
		"auth response!",
		func(r *mux.Router, req *http.Request) {
			// take every registered handler and make sure it's used by the router
			for _, v := range request.GetAllMiddlewares() {
				r.Use(v)
			}
			for _, fn := range fns {
				fn(req)
			}
		},
		[]string{log},
	)

	return &h
}

func TestAuth(t *testing.T) {
	suite.Run(t, new(authTestsSuite))
}
