package auth0_test

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"
	"time"

	nethttptest "net/http/httptest"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/auth"
	"github.com/lolopinto/ent/ent/auth/auth0"
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
	"golang.org/x/crypto/acme"
)

var signingKey = []byte("auth0_secret")

type testInfo struct {
	privateKey       *rsa.PrivateKey
	claims           jwt.MapClaims
	token            string
	json             []byte
	idFromIdentifier func(string) (string, error)
	signingMethod    jwt.SigningMethod
	signingKey       interface{}
	payloadKey       string
	baseClaimFunc    func() entjwt.Claims
	statusCode       int
}

type claims struct {
	Email string `json:"email"`
	jwt.StandardClaims
}

type invalidClaims struct {
	Email string
	jwt.StandardClaims
}

// hmm these shouldn't be needed in this case...
func (c *claims) ID() string {
	return c.Id
}

func (c *invalidClaims) ID() string {
	return c.Id
}

type auth0TestSuite struct {
	testingutils.Suite
	publicCert string
	thumbprint string
	privateKey *rsa.PrivateKey
}

func (suite *auth0TestSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"contacts",
	}

	suite.setupPublicCert()
	suite.setupPrivateCert()
	suite.Suite.SetupSuite()
}

func (suite *auth0TestSuite) TearDownTest() {
	// after every test, reset HttpGet
	// also reset jwt.TimeFunc
	auth0.HttpGet = http.Get
	jwt.TimeFunc = time.Now

	auth.Clear()
	auth0.ClearCache()
}

// openssl genrsa -out private.pem 2048
// openssl rsa -in private.pem -pubout -out public.pem
// to generate testdata/private.pem and public.pem

func (suite *auth0TestSuite) setupPrivateCert() {
	b, err := ioutil.ReadFile("testdata/private.pem")
	require.NoError(suite.T(), err)
	privPem, _ := pem.Decode(b)
	require.Equal(suite.T(), "RSA PRIVATE KEY", privPem.Type)
	privKey, err := x509.ParsePKCS1PrivateKey(privPem.Bytes)
	//	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.Nil(suite.T(), err)

	// get thumbprint.
	thumbprint, err := acme.JWKThumbprint(privKey.Public())
	assert.Nil(suite.T(), err)

	suite.thumbprint = thumbprint
	suite.privateKey = privKey
}

func (suite *auth0TestSuite) setupPublicCert() {
	b, err := ioutil.ReadFile("testdata/public.pem")
	assert.NoError(suite.T(), err)
	parts := strings.Split(string(b), "\n")
	beginIdx, endIdx := -1, -1
	for idx, part := range parts {
		if beginIdx == -1 && strings.HasPrefix(part, "-----BEGIN") {
			beginIdx = idx
		} else if endIdx == -1 && strings.HasPrefix(part, "-----END") {
			endIdx = idx
		}
	}

	if beginIdx == -1 || endIdx == 1 {
		suite.FailNow("couldn't setup public cert")
	}
	suite.publicCert = strings.Join(parts[beginIdx+1:endIdx], "")
}

func (suite *auth0TestSuite) getClaims(audience, issue string) jwt.MapClaims {
	now := time.Now()

	return jwt.MapClaims{
		"email": util.GenerateRandEmail(),
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
		"iss":   issue,
		"sub":   "auth0|uuid", // random id that "looks like" auth0 format
		"aud":   audience,
	}
}

type option struct {
	disablekid bool
}

func (suite *auth0TestSuite) getTestInfo(audience, issue string, opts ...func(*option)) *testInfo {
	o := &option{}
	for _, opt := range opts {
		opt(o)
	}

	claims := suite.getClaims(audience, issue)

	// add the kid to the header as the thumbprint
	// needed to match certificates
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	if !o.disablekid {
		token.Header["kid"] = suite.thumbprint
	}
	tokenStr, err := token.SignedString(suite.privateKey)
	assert.Nil(suite.T(), err)

	// create the jwks
	// see https://auth0.com/docs/tokens/references/jwks-properties
	jwks := auth0.Jwks{
		Keys: []auth0.JSONWebKey{
			auth0.JSONWebKey{
				Kty: "RSA",
				Alg: "RSA256",
				Use: "sig",
				// public
				X5c: []string{
					suite.publicCert,
				},
				X5t: suite.thumbprint,
				Kid: suite.thumbprint,
				// these 2 are broken.
				//	N: privKey.PublicKey.N.String(),
				//	E: fmt.Sprintf("%v", privKey.PublicKey.E),
			},
		},
	}
	b, err := json.Marshal(jwks)
	assert.Nil(suite.T(), err)

	return &testInfo{
		privateKey: suite.privateKey,
		claims:     claims,
		token:      tokenStr,
		json:       b,
	}
}

func (suite *auth0TestSuite) getTestInfoHMAC(audience, issue string) *testInfo {
	claims := suite.getClaims(audience, issue)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(signingKey)
	assert.Nil(suite.T(), err)

	return &testInfo{
		claims:        claims,
		token:         tokenStr,
		signingMethod: jwt.SigningMethodHS256,
		signingKey:    signingKey,
	}
}

func (suite *auth0TestSuite) createUser(email string) *models.User {
	pwd, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	user, err := action.CreateUser(viewer.LoggedOutViewer()).
		SetFirstName("Jon").
		SetLastName("Snow").
		SetEmailAddress(email).
		SetPassword(pwd).
		Save()

	require.NoError(suite.T(), err)
	require.Equal(suite.T(), user.FirstName, "Jon")

	return user
}

func (suite *auth0TestSuite) TestValidAuth0() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"
	info := suite.getTestInfo(audience, issue)

	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "1")
}

func (suite *auth0TestSuite) TestValidAuth0WithEmailKey() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"
	info := suite.getTestInfo(audience, issue)
	user := suite.createUser(info.claims["email"].(string))

	info.payloadKey = "email"
	info.idFromIdentifier = models.LoadUserIDFromEmailAddress

	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), user.ID)
}

func (suite *auth0TestSuite) TestValidAuth0WithEmailKeyCustomClaims() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"
	info := suite.getTestInfo(audience, issue)
	user := suite.createUser(info.claims["email"].(string))

	info.payloadKey = "email"
	info.idFromIdentifier = models.LoadUserIDFromEmailAddress
	info.baseClaimFunc = func() entjwt.Claims {
		return &claims{}
	}

	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), user.ID)
}

func (suite *auth0TestSuite) TestInvalidAuth0WithEmailKeyCustomClaims() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"
	info := suite.getTestInfo(audience, issue)

	info.payloadKey = "email"
	info.idFromIdentifier = models.LoadUserIDFromEmailAddress
	info.baseClaimFunc = func() entjwt.Claims {
		return &invalidClaims{}
	}

	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestExpiredAuth0() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfo(audience, issue)

	// set time to something in the future so iat isn't valid
	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(2 * time.Hour)
	}
	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestNoKidHeader() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	// disable kid header. fails because can't match header to certificate
	info := suite.getTestInfo(audience, issue, func(o *option) {
		o.disablekid = true
	})

	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestNoToken() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfo(audience, issue)
	info.token = ""

	h := suite.testServer(audience, issue, info)

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestInvalidAudience() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfo(audience, issue)

	h := suite.testServer("http://fancy.website", issue, info)

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestInvalidIssue() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfo(audience, issue)

	h := suite.testServer(audience, "https://foo1.auth0.com", info)

	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestHMACSigningMethod() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfoHMAC(audience, issue)

	h := suite.testServer(audience, issue, info)
	assert.IsType(suite.T(), viewertesting.LoggedinViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "1")
}

func (suite *auth0TestSuite) TestInvalidHMACSigningKey() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfoHMAC(audience, issue)
	info.signingKey = []byte("made up key")

	h := suite.testServer(audience, issue, info)
	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestInvalidSigningMethod() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfoHMAC(audience, issue)
	info.signingMethod = jwt.SigningMethodES256

	h := suite.testServer(audience, issue, info)
	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestDifferentSigningMethod() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfo(audience, issue)
	info.signingMethod = jwt.SigningMethodHS256
	info.signingKey = signingKey

	h := suite.testServer(audience, issue, info)
	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) TestErrorFetchingJwks() {
	audience := "https://fancy.website"
	issue := "https://foo.auth0.com"

	info := suite.getTestInfo(audience, issue)
	info.statusCode = http.StatusBadRequest

	h := suite.testServer(audience, issue, info)
	assert.IsType(suite.T(), viewer.LoggedOutViewerContext{}, h.V)
	assert.Equal(suite.T(), h.V.GetViewerID(), "")
}

func (suite *auth0TestSuite) testServer(
	audience, issue string,
	info *testInfo,
) *httptest.QueryHandler {
	url, err := auth0.GetJWKSURI(issue)
	require.NoError(suite.T(), err)

	// mock http.Get to mock the json
	auth0.HttpGet = func(string) (*http.Response, error) {
		handler := func(w http.ResponseWriter, r *http.Request) {
			if info.statusCode != 0 {
				w.WriteHeader(info.statusCode)
			}
			w.Write(info.json)
		}

		req := nethttptest.NewRequest("GET", url, nil)
		w := nethttptest.NewRecorder()
		handler(w, req)

		return w.Result(), nil
	}

	if info.idFromIdentifier == nil {
		info.idFromIdentifier = func(subj string) (string, error) {
			return "1", nil
		}
	}

	auth.Register("auth0", &auth0.Auth0Auth{
		Audience:         audience,
		Issue:            issue,
		IDFromIdentifier: info.idFromIdentifier,
		VCFromID:         viewertesting.GetLoggedInViewer,
		SigningMethod:    info.signingMethod,
		SigningKey:       info.signingKey,
		PayloadKey:       info.payloadKey,
		BaseClaimFunc:    info.baseClaimFunc,
	})

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

			if info.token != "" {
				req.Header.Set(
					"Authorization",
					fmt.Sprintf("Bearer %s", info.token),
				)
			}
		},
	)
	return h
}

func TestAuth0Auth(t *testing.T) {
	suite.Run(t, new(auth0TestSuite))
}
