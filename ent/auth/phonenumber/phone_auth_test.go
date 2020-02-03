package phonenumber_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/auth"
	"github.com/lolopinto/ent/ent/auth/phonenumber"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/httptest"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/user/action"

	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var signingKey = []byte("phone_auth_signing_key")

func TestNoSigningKey(t *testing.T) {
	auth := phonenumber.NewPhonePinAuth(
		nil,
		models.LoadUserIDFromPhoneNumber,
		viewertesting.GetLoggedInViewer,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "signing key")
}

func TestNoIDFromPhoneNumber(t *testing.T) {
	auth := phonenumber.NewPhonePinAuth(
		signingKey,
		nil,
		viewertesting.GetLoggedInViewer,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "IDFromPhoneNumber")
}

func TestNoVCFromID(t *testing.T) {
	auth := phonenumber.NewPhonePinAuth(
		signingKey,
		models.LoadUserIDFromPhoneNumber,
		nil,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "VCFromID")
}

func TestNotPhoneNumber(t *testing.T) {
	identity, err := authPhoneNumberPin("1", "1")

	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "invalid phone number")
}

func TestMissingPhoneNumber(t *testing.T) {
	identity, err := authPhoneNumberPin("6501234567", "1")

	require.Nil(t, identity)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "no rows in result set")
}

type phoneAuthTestSuite struct {
	testingutils.Suite
}

func (suite *phoneAuthTestSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"contacts",
	}
	suite.Suite.SetupSuite()
}

func (suite *phoneAuthTestSuite) SetupTest() {
	auth.Clear()
}

func (suite *phoneAuthTestSuite) createUser() *models.User {
	user, err := action.CreateUser(viewer.LoggedOutViewer()).
		SetFirstName("Jon").
		SetLastName("Snow").
		SetEmailAddress("test@email.com").
		SetPhoneNumber("4159876543").Save()

	require.NoError(suite.T(), err)
	require.Equal(suite.T(), user.FirstName, "Jon")

	return user
}

func (suite *phoneAuthTestSuite) TestTooShortPIN() {
	suite.createUser()

	identity, err := authPhoneNumberPin("4159876543", "1")
	require.Nil(suite.T(), identity)
	require.NotNil(suite.T(), err)
	require.Contains(suite.T(), err.Error(), "invalid PIN")
}

func (suite *phoneAuthTestSuite) TestValidAuth() {
	testCases := map[string]string{
		"all-numbers":          "4159876543",
		"national-format":      "(415) 987-6543",
		"international format": "+14159876543",
	}
	user := suite.createUser()

	for key, number := range testCases {
		suite.T().Run(key, func(t *testing.T) {
			auth := getDefaultAuth()

			suite.testValidAuthWithDuration(auth, phonenumber.DefaultDuration, user, number)
		})
	}
}

func (suite *phoneAuthTestSuite) TestCustomDuration() {
	user := suite.createUser()

	auth := getDefaultAuth()
	auth.Duration = 5 * time.Minute

	suite.testValidAuthWithDuration(auth, 5*time.Minute, user, "4159876543")
}

func (suite *phoneAuthTestSuite) TestCustomSigningMethod() {
	user := suite.createUser()

	auth := getDefaultAuth()
	auth.SigningMethod = jwt.SigningMethodHS256

	identity := suite.verifyValidAuth(auth, user, "4159876543")

	token, err := jwt.ParseWithClaims(identity.Token, &jwt.StandardClaims{}, func(token *jwt.Token) (interface{}, error) {
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

func (suite *phoneAuthTestSuite) TestCustomClaims() {
	user := suite.createUser()

	auth := getDefaultAuth()
	auth.ClaimFunc = func(id string) phonenumber.Claims {
		return &claims{
			Admin: true,
			StandardClaims: jwt.StandardClaims{
				Id:        id,
				ExpiresAt: jwt.TimeFunc().Add(1 * time.Minute).Unix(),
			},
		}
	}
	auth.BaseClaimFunc = func() phonenumber.Claims {
		return &claims{}
	}

	suite.verifyValidAuth(auth, user, "4159876543")
}

func (suite *phoneAuthTestSuite) TestAuthFromRequestNoHeader() {
	// no header so logged out viewer
	auth.Register("phone_pin_auth", getDefaultAuth())

	h := suite.testServer()

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *phoneAuthTestSuite) TestAuthFromRequestWithHeader() {
	user := suite.createUser()

	auth.Register("phone_pin_auth", getDefaultAuth())

	h := suite.testServer(func(req *http.Request) {
		auth := getDefaultAuth()
		identity, err := auth.Authenticate(context.TODO(), "4159876543", "123456")
		require.Nil(suite.T(), err)
		require.NotNil(suite.T(), identity)

		req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", identity.Token))
	})

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), user.ID)
}

func (suite *phoneAuthTestSuite) TestInvalidAuthorizationHeader() {
	auth.Register("phone_pin_auth", getDefaultAuth())

	h := suite.testServer(func(req *http.Request) {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", uuid.New().String()))
	})

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *phoneAuthTestSuite) testServer(fns ...func(*http.Request)) *httptest.QueryHandler {
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

func (suite *phoneAuthTestSuite) verifyValidAuth(
	auth *phonenumber.PhonePinAuth,
	user *models.User,
	number string,
) *phonenumber.AuthedIdentity {
	identity, err := auth.Authenticate(context.TODO(), number, "123456")
	require.Nil(suite.T(), err)
	require.NotNil(suite.T(), identity)

	require.Equal(suite.T(), user.ID, identity.Viewer.GetViewerID())

	// validate the token
	viewer, err := auth.ViewerFromToken(identity.Token)
	require.Nil(suite.T(), err)
	require.NotNil(suite.T(), viewer)
	require.Equal(suite.T(), user.ID, viewer.GetViewerID())

	require.Equal(suite.T(), viewer, identity.Viewer)

	return identity
}

func (suite *phoneAuthTestSuite) testValidAuthWithDuration(
	auth *phonenumber.PhonePinAuth,
	duration time.Duration,
	user *models.User,
	number string,
) {

	identity := suite.verifyValidAuth(auth, user, number)

	// check if valid after the fact
	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(duration + 1*time.Second)
	}
	viewer, err := auth.ViewerFromToken(identity.Token)
	require.NotNil(suite.T(), err)
	require.Nil(suite.T(), viewer)

	// reset the time
	jwt.TimeFunc = time.Now
}

func TestPhoneAuth(t *testing.T) {
	suite.Run(t, new(phoneAuthTestSuite))
}

func getDefaultAuth() *phonenumber.PhonePinAuth {
	return phonenumber.NewPhonePinAuth(
		signingKey,
		models.LoadUserIDFromPhoneNumber,
		viewertesting.GetLoggedInViewer,
	)
}

func authPhoneNumberPin(phoneNumber, pin string) (*phonenumber.AuthedIdentity, error) {
	auth := getDefaultAuth()
	return auth.Authenticate(context.TODO(), phoneNumber, pin)
}
