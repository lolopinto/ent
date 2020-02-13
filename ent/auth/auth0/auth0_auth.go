package auth0

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/auth/internal/base"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/pkg/errors"
)

// Jwks represents a set of JSON Web Keys
type Jwks struct {
	Keys []JSONWebKey `json:"keys"`
}

// JSONWebKey represents a single JSONWebKey. Used to verify auth0 certificates
type JSONWebKey struct {
	Alg string   `json:"alg"`
	Kty string   `json:"kty"`
	Kid string   `json:"kid"`
	Use string   `json:"use"`
	N   string   `json:"n"`
	E   string   `json:"e"`
	X5c []string `json:"x5c"`
	X5t string   `json:"x5t"`
}

// Auth0Auth is an implementation of the auth.Auth interface that verifies that the auth0 token
// in the header is valid
type Auth0Auth struct {
	// Required. Audience refers to the audience of the JWT token. We currently always* verify the audience here matches the audience
	// encoded in the JWT.
	// We actually only do this if the claims object used has a VerifyAudience(string, bool) bool method which
	// the default Claims object does
	Audience string

	// Required. Issue refers to the issuer of the JWT token. We currently always* verify the issue here matches the issue
	// encoded in the JWT.
	// We actually only do this if the claims object used has a VerifyIssuer(string, bool) bool method which
	// the default Claims object does
	Issue string

	// Required function takes the ID and returns a (ViewerContext, error) tuple. Called by AuthFromViewer method to return the ViewerContext
	// to be used for the current request
	VCFromID func(string) (viewer.ViewerContext, error)

	// Required function to take the identifier and returns an (ID, error) tuple indicating
	// if subject maps to something in the database
	// The identifier passed here depends on PayloadKey below
	IDFromIdentifier func(string) (string, error)

	// By default, we grab the subject (auth0_uid) from the payload and pass it to IDFromIdentifier to get the logged in user
	// PayloadKey indicates we should grab from another key in the payload instead. The key should be all lowercase
	// Most common is email which we then pass to IDFromIdentifier to validate that the email address
	// maps to a user in our application
	// This can also be phone_number or other unique information that maps to the user id
	PayloadKey string

	// Used to return a new empty claims instance which is passed to jwt.ParseWithClaims
	// instead of the default jwt.MapClaims
	BaseClaimFunc func() entjwt.Claims

	// What algorithm method should be used to sign this token. Default is jwt.SigningMethodRS256
	// Only other supported algorthm is jwt.SigningMethodHS256
	SigningMethod jwt.SigningMethod

	// Used to sign the token used to auth the user
	// only used when signing method is jwt.SigningMethodHS256
	// Otherwise, public key is used to sign and retrieved from the certificate at Issue
	SigningKey interface{}
}

// HttpGet maps is provided to override in tests for fetching the certificate
// This is useful to prevent going over the wire to fetch data from a dummy url
var HttpGet = http.Get

// GetJWKSURI provides the url that the jwks for the issue is located at
// verifies issue is a valid url and appends the common path to it
func GetJWKSURI(issue string) (string, error) {
	u, err := url.Parse(issue)
	if err != nil {
		return "", err
	}
	u.Path = "/.well-known/jwks.json"
	return u.String(), nil
}

type claimsWithAudienceVerifier interface {
	VerifyAudience(string, bool) bool
}

type claimsWithIssueVerifier interface {
	VerifyIssuer(string, bool) bool
}

type cachedJWKS struct {
	jwks *Jwks
	err  error
}

type certResult struct {
	cert string
	err  error
}

type signingKey struct {
	key interface{}
	err error
}

var (
	permMutex sync.RWMutex
	cache     = make(map[string]*cachedJWKS)
)

// ClearCache clears the jwks cache
func ClearCache() {
	permMutex.Lock()
	defer permMutex.Unlock()
	cache = make(map[string]*cachedJWKS)
}

// AuthViewer takes the authorization token from the request and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *Auth0Auth) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	// could customize this in the future but for now, always take from request
	vc, err := auth.getViewer(w, r)
	if err != nil {
		log.Println(err)
	}
	return vc
}

func (auth *Auth0Auth) getViewer(w http.ResponseWriter, r *http.Request) (viewer.ViewerContext, error) {
	// could customize this in the future but for now, always take from request
	token, err := base.TokenFromRequest(w, r)
	if err != nil || token == "" {
		return nil, err
	}

	shared := base.SharedJwtAuth{
		BaseClaimFunc: auth.BaseClaimFunc,
	}

	// this only works if RS256 which is the base. need to pass this in as an option...
	parsedToken, err := jwt.ParseWithClaims(token, shared.GetBaseClaims(), func(token *jwt.Token) (interface{}, error) {
		claims := token.Claims

		audienceVerifier, ok := claims.(claimsWithAudienceVerifier)
		if ok {
			if !audienceVerifier.VerifyAudience(auth.Audience, false) {
				return nil, errors.New("invalid audience")
			}
		}

		issueVerifier, ok := claims.(claimsWithIssueVerifier)
		if ok {
			if !issueVerifier.VerifyIssuer(auth.Issue, false) {
				return nil, errors.New("invalid issue")
			}
		}

		result := <-auth.getSigningKey(token)
		return result.key, result.err
	})

	if err != nil {
		return nil, errors.Wrap(err, "error parsing token")
	}

	if !parsedToken.Valid {
		return nil, errors.New("invalid json token")
	}

	// hmm really hard to test this case
	if parsedToken.Method != auth.getSigningMethod() {
		return nil, errors.New("invalid signing method")
	}

	// TODO scopes?
	identifer := ""
	if auth.PayloadKey != "" {
		identifer, err = entjwt.GetKeyFromClaims(parsedToken.Claims, auth.PayloadKey)
		if err != nil {
			return nil, errors.Wrap(err, fmt.Sprintf("couldn't get key %s from claims", auth.PayloadKey))
		}
	} else {
		identifer, err = entjwt.GetSubjectFromClaims(parsedToken.Claims)
		if err != nil {
			return nil, errors.Wrap(err, "couldn't get subject from claims")
		}
	}

	// auth0id -> uid
	// this should be indexed/unique in the datastore
	viewerID, err := auth.IDFromIdentifier(identifer)
	if err != nil {
		return nil, errors.Wrap(err, "error confirming subject/identifer exists")
	}

	// in this world, everything is done on the client
	// token is valid!
	vc, err := auth.VCFromID(viewerID)
	if err != nil {
		return nil, errors.Wrap(err, "couldn't get vc from ID")
	}
	return vc, nil
}

func (auth *Auth0Auth) getSigningMethod() jwt.SigningMethod {
	if auth.SigningMethod == nil {
		return jwt.SigningMethodRS256
	}
	return auth.SigningMethod
}

func (auth *Auth0Auth) getSigningKey(token *jwt.Token) chan signingKey {
	ret := make(chan signingKey)
	go func() {
		var key interface{}
		var err error

		method := auth.getSigningMethod()
		switch method {
		case jwt.SigningMethodRS256:
			result := <-getPermCert(token, auth.Issue)
			if result.err != nil {
				err = result.err
			} else {
				key, err = jwt.ParseRSAPublicKeyFromPEM([]byte(result.cert))
			}

			break
		case jwt.SigningMethodHS256:

			key = auth.SigningKey
			break
		default:
			// invalid signing method
			err = fmt.Errorf("invalid signing method %v", method)
		}

		ret <- signingKey{
			key: key,
			err: err,
		}
	}()
	return ret
}

// TODO maybe don't always cache error forever incase it's down
// TODO cache public key for limited amount of time? make that configurable?
// for now, doesn't make sense to go over the wire *every* single time
// auth0 probably has data we can use to figure out how often this clears
// in their examples, they go over the wire *every* single time. hmm
func getPermCert(token *jwt.Token, issue string) chan *certResult {
	res := make(chan *certResult)
	go func() {
		// cached response. nothing to do here
		result := checkCache(issue)
		var err error
		if result == nil {
			jwks, err := fetchJwks(issue)
			result = setCache(issue, jwks, err)
		}

		if result.err != nil {
			res <- &certResult{
				err: result.err,
			}
			return
		}

		var cert string
		jwks := result.jwks
		for k := range jwks.Keys {
			if token.Header["kid"] == jwks.Keys[k].Kid {
				cert = "-----BEGIN CERTIFICATE-----\n" + jwks.Keys[k].X5c[0] + "\n-----END CERTIFICATE-----"
				break
			}
		}

		if cert == "" {
			err = errors.New("unable to find appropriate key")
		}

		res <- &certResult{
			cert: cert,
			err:  err,
		}
	}()
	return res
}

func checkCache(issue string) *cachedJWKS {
	permMutex.RLock()
	defer permMutex.RUnlock()
	return cache[issue]
}

func setCache(issue string, jwks *Jwks, err error) *cachedJWKS {
	permMutex.Lock()
	defer permMutex.Unlock()
	cache[issue] = &cachedJWKS{
		jwks: jwks,
		err:  err,
	}
	return cache[issue]
}

func fetchJwks(issue string) (*Jwks, error) {
	url, err := GetJWKSURI(issue)
	if err != nil {
		return nil, errors.Wrap(err, "could not parse uri")
	}
	resp, err := HttpGet(url)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http status code %v returned", resp.StatusCode)
	}
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var jwks = &Jwks{}
	err = json.NewDecoder(resp.Body).Decode(jwks)

	return jwks, err
}
