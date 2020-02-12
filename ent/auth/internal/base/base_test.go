package base

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"

	"github.com/lolopinto/ent/ent/auth"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/httptest"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func newJWT() *SharedJwtAuth {
	return &SharedJwtAuth{
		VCFromID:   viewertesting.GetLoggedInViewer,
		SigningKey: []byte("signing_key"),
	}
}

type baseJwtSuite struct {
	testingutils.Suite
}

func (suite *baseJwtSuite) SetupTest() {
	// reset before every test
	jwt.TimeFunc = time.Now
}

func (suite *baseJwtSuite) TearDownTest() {
	// rest after every test
	jwt.TimeFunc = time.Now
}

func (suite *baseJwtSuite) TestWorkFlow() {
	t := suite.T()
	shared := newJWT()
	// go from ID -> viewer/token
	identity, err := shared.AuthFromID("1")
	require.Nil(t, err)
	require.NotEmpty(t, identity.Token)
	require.Equal(t, "1", identity.Viewer.GetViewerID())

	// confirm token maps back to same viewer (and same id)
	vc, err := shared.ViewerFromToken(identity.Token)
	require.Nil(t, err)
	require.Equal(t, vc, identity.Viewer)
}

func (suite *baseJwtSuite) TestTokenFromRequest() {
	testCases := map[string]struct {
		header string
		token  string
		err    error
	}{
		"token": {
			"Bearer token",
			"token",
			nil,
		},
		"none": {
			"",
			"",
			nil,
		},
		"malformed": {
			"foo",
			"",
			errors.New("Invalid"),
		},
		"malformed bearer": {
			"bearer bar",
			"",
			errors.New("Invalid"),
		},
	}

	for key, tt := range testCases {
		suite.T().Run(key, func(t *testing.T) {
			h := &httptest.QueryHandler{
				T:        t,
				Response: []byte("auth response!"),
			}
			h.Callback = func(w http.ResponseWriter, r *http.Request) {
				str, err := TokenFromRequest(w, r)
				if tt.err == nil {
					require.NoError(t, err)
					require.Equal(t, tt.token, str)
				} else {
					require.Equal(t, tt.token, str)
					require.Equal(t, "", str)
					require.Contains(t, err.Error(), tt.err.Error())
				}
			}
			httptest.TestServer(
				t,
				h.HandlerFunc,
				"auth response!",
				func(r *mux.Router, req *http.Request) {
					for _, v := range request.GetAllMiddlewares() {
						r.Use(v)
					}
					req.Header.Set("Authorization", tt.header)
				},
			)
		})
	}
}

func (suite *baseJwtSuite) TestAuthViewer() {
	shared := newJWT()
	auth.Register("jwt", newJWT())

	identity, err := shared.AuthFromID("1")
	require.Nil(suite.T(), err)

	h := &httptest.QueryHandler{
		T:        suite.T(),
		Response: []byte("auth response!"),
	}
	httptest.TestServer(
		suite.T(),
		h.HandlerFunc,
		"auth response!",
		func(r *mux.Router, req *http.Request) {
			for _, v := range request.GetAllMiddlewares() {
				r.Use(v)
			}
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", identity.Token))
		},
	)

	require.Equal(suite.T(), "1", h.V.GetViewerID())
}

func (suite *baseJwtSuite) TestExtendTokenExpiration() {
	shared := newJWT()

	identity, err := shared.AuthFromID("1")
	require.NoError(suite.T(), err)

	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(5 * time.Minute)
	}

	// no constraints on extending so can grab a new one
	newToken, err := shared.ExtendTokenExpiration(identity.Token)
	require.NoError(suite.T(), err)

	require.NotEqual(suite.T(), newToken, identity.Token)
}

func (suite *baseJwtSuite) TestExtendTokenExpirationExpiredToken() {
	shared := newJWT()

	identity, err := shared.AuthFromID("1")
	require.NoError(suite.T(), err)

	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(2 * time.Hour)
	}

	// can't grab a new token with an expired token
	newToken, err := shared.ExtendTokenExpiration(identity.Token)
	require.Error(suite.T(), err)
	require.Equal(suite.T(), "", newToken)
}

func (suite *baseJwtSuite) TestExtendTokenExpirationWithDuration() {
	shared := newJWT()
	// can only extend with 5 minutes left (not 5 minutes passed)
	shared.ExtendTokenDuration = 5 * time.Minute

	identity, err := shared.AuthFromID("1")
	require.NoError(suite.T(), err)

	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(6 * time.Minute)
	}
	// can't grab a new token since before expiration window
	newToken, err := shared.ExtendTokenExpiration(identity.Token)
	require.Error(suite.T(), err)
	require.Equal(suite.T(), "", newToken)
}

func (suite *baseJwtSuite) TestExtendTokenExpirationDuringDuration() {
	shared := newJWT()
	// can only extend with 5 minutes left
	shared.ExtendTokenDuration = 5 * time.Minute

	identity, err := shared.AuthFromID("1")
	require.NoError(suite.T(), err)

	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(55 * time.Minute)
	}

	// valid since during token expiration window
	newToken, err := shared.ExtendTokenExpiration(identity.Token)
	require.NoError(suite.T(), err)
	require.NotEqual(suite.T(), "", newToken)
	require.NotEqual(suite.T(), identity.Token, newToken)
}

func TestBaseJwt(t *testing.T) {
	suite.Run(t, new(baseJwtSuite))
}
