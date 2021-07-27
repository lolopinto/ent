package email_test

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/auth"
	"github.com/lolopinto/ent/ent/auth/email"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/httptest"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/user/action"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var signingKey = []byte("email_auth_signing_key")

// lots of similarities between this and phone_auth_test.go...
func TestNoSigningKey(t *testing.T) {
	auth := email.NewEmailPasswordAuth(
		nil,
		models.ValidateEmailPassword,
		viewertesting.GetLoggedInViewer,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "signing key")
}

func TestNoIDFromEmailPassword(t *testing.T) {
	auth := email.NewEmailPasswordAuth(
		signingKey,
		nil,
		viewertesting.GetLoggedInViewer,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "IDFromEmailPassword")
}

func TestNoVCFromID(t *testing.T) {
	auth := email.NewEmailPasswordAuth(
		signingKey,
		models.ValidateEmailPassword,
		nil,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "VCFromID")
}

func TestNotEmailAddress(t *testing.T) {
	identity, err := authEmailPassword("1", "1")

	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "missing '@' or angle-addr")
}

func TestMissingEmailAddress(t *testing.T) {
	identity, err := authEmailPassword("foo@baz.com", "1")

	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "no rows in result set")
}

type emailAuthTestSuite struct {
	testingutils.Suite
}

func (suite *emailAuthTestSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"contacts",
	}
	suite.Suite.SetupSuite()
}

func (suite *emailAuthTestSuite) SetupTest() {
	auth.Clear()
	jwt.TimeFunc = time.Now
}

func (suite *emailAuthTestSuite) createUser(passwords ...string) *models.User {
	var password string
	if len(passwords) == 1 {
		password = passwords[0]
	} else {
		var err error
		password, err = util.GenerateRandPassword()
		require.Nil(suite.T(), err)
	}
	user, err := action.CreateUser(viewer.LoggedOutViewer()).
		SetFirstName("Jon").
		SetLastName("Snow").
		SetEmailAddress(util.GenerateRandEmail()).
		SetPassword(password).
		SetPhoneNumber(util.GenerateRandPhoneNumber()).Save()

	require.NoError(suite.T(), err)
	require.Equal(suite.T(), user.FirstName, "Jon")

	return user
}

func (suite *emailAuthTestSuite) TestInvalidPassword() {
	user := suite.createUser()

	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	identity, err := authEmailPassword(user.EmailAddress, pwd)
	require.Nil(suite.T(), identity)
	require.NotNil(suite.T(), err)
	require.Contains(suite.T(), err.Error(), "hashedPassword is not the hash")
}

func (suite *emailAuthTestSuite) TestValidAuth() {
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	user := suite.createUser(pwd)

	testCases := map[string]string{
		"standard": user.EmailAddress,
		"caps":     strings.ToUpper(user.EmailAddress),
	}

	for key, email := range testCases {
		suite.T().Run(key, func(t *testing.T) {
			auth := getDefaultAuth()

			testValidAuthWithDuration(t, auth, entjwt.DefaultDuration, user, email, pwd)
		})
	}
}

func (suite *emailAuthTestSuite) TestCustomDuration() {
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	user := suite.createUser(pwd)

	auth := getDefaultAuth()
	auth.Duration = 5 * time.Minute

	testValidAuthWithDuration(suite.T(), auth, 5*time.Minute, user, user.EmailAddress, pwd)
}

func (suite *emailAuthTestSuite) TestCustomSigningMethod() {
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user := suite.createUser(pwd)

	auth := getDefaultAuth()
	auth.SigningMethod = jwt.SigningMethodHS256

	identity := verifyValidAuth(suite.T(), auth, user, user.EmailAddress, pwd)

	token, err := jwt.Parse(identity.Token, func(token *jwt.Token) (interface{}, error) {
		return auth.SigningKey, nil
	})

	require.Nil(suite.T(), err)
	require.Equal(suite.T(), jwt.SigningMethodHS256, token.Method)
}

type claims struct {
	Admin bool `json:"admin"`
	jwt.StandardClaims
}

func (c *claims) ID() string {
	return c.Id
}

func (suite *emailAuthTestSuite) TestCustomClaims() {
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user := suite.createUser(pwd)

	auth := getDefaultAuth()
	auth.ClaimFunc = func(id string) entjwt.Claims {
		return &claims{
			Admin: true,
			StandardClaims: jwt.StandardClaims{
				Id:        id,
				ExpiresAt: jwt.TimeFunc().Add(1 * time.Minute).Unix(),
			},
		}
	}
	auth.BaseClaimFunc = func() entjwt.Claims {
		return &claims{}
	}

	verifyValidAuth(suite.T(), auth, user, user.EmailAddress, pwd)
}

func (suite *emailAuthTestSuite) TestAuthFromRequestNoHeader() {
	// no header so logged out viewer
	auth.Register("email_password_auth", getDefaultAuth())

	h := suite.testServer()

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *emailAuthTestSuite) TestAuthFromRequestWithHeader() {
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user := suite.createUser(pwd)

	auth.Register("email_password_auth", getDefaultAuth())

	h := suite.testServer(func(req *http.Request) {
		auth := getDefaultAuth()
		identity, err := auth.Authenticate(context.TODO(), user.EmailAddress, pwd)
		require.Nil(suite.T(), err)
		require.NotNil(suite.T(), identity)

		req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", identity.Token))
	})

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), user.ID)
}

func (suite *emailAuthTestSuite) TestInvalidAuthorizationHeader() {
	auth.Register("email_address_auth", getDefaultAuth())

	h := suite.testServer(func(req *http.Request) {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", uuid.New().String()))
	})

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *emailAuthTestSuite) TestExtendTokenExpiration() {
	// just testing that it works.
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user := suite.createUser(pwd)

	auth := getDefaultAuth()
	identity := verifyValidAuth(suite.T(), auth, user, user.EmailAddress, pwd)

	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(30 * time.Minute)
	}
	newToken, err := auth.ExtendTokenExpiration(identity.Token)
	require.NoError(suite.T(), err)
	require.NotEqual(suite.T(), newToken, identity.Token)
	require.NotEqual(suite.T(), newToken, "")
}

func (suite *emailAuthTestSuite) testServer(fns ...func(*http.Request)) *httptest.QueryHandler {
	h := &httptest.QueryHandler{
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
			// take every passed in function and modify request as needed
			for _, fn := range fns {
				fn(req)
			}
		},
	)

	return h
}

func verifyValidAuth(
	t *testing.T,
	auth *email.EmailPasswordAuth,
	user *models.User,
	email string,
	password string,
) *entjwt.AuthedIdentity {
	identity, err := auth.Authenticate(context.TODO(), email, password)
	require.Nil(t, err)
	require.NotNil(t, identity)

	require.Equal(t, user.ID, identity.Viewer.GetViewerID())

	// validate the token
	viewer, err := auth.ViewerFromToken(identity.Token)
	require.Nil(t, err)
	require.NotNil(t, viewer)
	require.Equal(t, user.ID, viewer.GetViewerID())

	require.Equal(t, viewer, identity.Viewer)

	return identity
}

func testValidAuthWithDuration(
	t *testing.T,
	auth *email.EmailPasswordAuth,
	duration time.Duration,
	user *models.User,
	email string,
	password string,
) {

	identity := verifyValidAuth(t, auth, user, email, password)

	// check if valid after the fact
	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(duration + 1*time.Second)
	}
	viewer, err := auth.ViewerFromToken(identity.Token)
	require.NotNil(t, err)
	require.Nil(t, viewer)

	// reset the time
	jwt.TimeFunc = time.Now
}

func TestEmailAuth(t *testing.T) {
	suite.Run(t, new(emailAuthTestSuite))
}

func getDefaultAuth() *email.EmailPasswordAuth {
	return email.NewEmailPasswordAuth(
		signingKey,
		models.ValidateEmailPassword,
		viewertesting.GetLoggedInViewer,
	)
}

func authEmailPassword(email, password string) (*entjwt.AuthedIdentity, error) {
	auth := getDefaultAuth()
	return auth.Authenticate(context.TODO(), email, password)
}
