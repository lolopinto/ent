package base

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/pkg/errors"
)

// SharedJwtAuth is shared code for authenticating the viewer from the given ID using JWT
// This is hidden in an internal package for now because AuthFromID() shouldn't be a public API
// since it exists to share code between similar implementations using jwt
type SharedJwtAuth struct {
	// Required function takes the ID above and returns a (ViewerContext, error) tuple. Called by AuthFromViewer method to return the ViewerContext
	// to be used for the current request
	VCFromID func(string) (viewer.ViewerContext, error)

	// Required. Used to sign the token used to auth the user
	SigningKey interface{}

	// Length of time the access token should be valid for. Default is DefaultDuration
	Duration time.Duration

	// What algorithm method should be used to sign this token. Default is DefaultSigningMethod
	SigningMethod jwt.SigningMethod

	// ClaimFunc is used to return a new instance of jwt.Claims to be used instead of jwt.MapClaims
	// when generating token. It's passed to jwt.NewWithClaims
	ClaimFunc func(string) entjwt.Claims
	// This pairs well with ClaimFunc to generate a new empty claims instance which is passed to jwt.ParseWithClaims
	BaseClaimFunc func() entjwt.Claims

	// ExtendTokenDuration defines the window for which the token can be extended
	// (with a valid existing token and without a refresh token)
	// If not set (default), token can be extended whenever e.g. sliding window every 10 minutes, every request, etc.
	// If set, token can only be extended within that window e.g. if set to 5 minutes, will be 5 minutes
	// before token expires
	// By default, auth handler doesn't do anything and since DefaultDuration is currently 1 hour,
	// developer needs to pick *something* to do to extend tokens or provide a
	// longer duration
	ExtendTokenDuration time.Duration
}

// AuthFromID returns an AuthedIdentity that's shared across
// different implementation details of auth
func (auth *SharedJwtAuth) AuthFromID(viewerID string) (*entjwt.AuthedIdentity, error) {
	vc, err := auth.VCFromID(viewerID)
	if err != nil {
		return nil, errors.Wrap(err, "error loading viewercontext")
	}

	tokenStr, err := auth.getTokenFromID(viewerID)
	if err != nil {
		return nil, err
	}

	return &entjwt.AuthedIdentity{
		Viewer: vc,
		Token:  tokenStr,
	}, nil
}

func (auth *SharedJwtAuth) getDuration() time.Duration {
	if auth.Duration == 0 {
		return entjwt.DefaultDuration
	}
	return auth.Duration
}

func (auth *SharedJwtAuth) getSigningMethod() jwt.SigningMethod {
	if auth.SigningMethod == nil {
		return entjwt.DefaultSigningMethod
	}
	return auth.SigningMethod
}

func (auth *SharedJwtAuth) getClaims(viewerID string) jwt.Claims {
	// TODO see internal/test_schema/graphql/root.go.
	// worth having something in here (or in auth.go?) passed from different handlers
	// which adds something to the claim/payload so that ViewerFromToken doesn't have
	// an error and logspew when multiple handlers exist
	if auth.ClaimFunc == nil {
		duration := auth.getDuration()
		// use jwt.TimeFunc because that's what's used for verification
		// we can more easily test this and can't test time.Now
		expirationTime := jwt.TimeFunc().Add(duration)

		m := make(jwt.MapClaims)
		m["exp"] = expirationTime.Unix()
		m["jti"] = viewerID
		return m
	}

	return auth.ClaimFunc(viewerID)
}

func (auth *SharedJwtAuth) GetBaseClaims() jwt.Claims {
	if auth.BaseClaimFunc == nil {
		return make(jwt.MapClaims)
	}
	return auth.BaseClaimFunc()
}

func TokenFromRequest(w http.ResponseWriter, r *http.Request) (string, error) {
	header := r.Header.Get("Authorization")
	if header == "" {
		// no error and no token
		return "", nil
	}

	parts := strings.Split(header, " ")

	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", fmt.Errorf("Invalid authorization header %s, format should be 'Bearer token'", header)
	}

	return parts[1], nil
}

// AuthViewer takes the authorization token from the request and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *SharedJwtAuth) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	token, err := TokenFromRequest(w, r)
	if err != nil || token == "" {
		if err != nil {
			// log for now
			log.Println(err)
		}
		return nil
	}

	v, err := auth.ViewerFromToken(token)
	if err != nil {
		log.Printf("error %s grabbing viewer from token \n", err)
	}
	return v
}

// ViewerFromToken takes the token string and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *SharedJwtAuth) ViewerFromToken(tokenStr string) (viewer.ViewerContext, error) {
	claims, err := auth.validateToken(tokenStr)
	if err != nil {
		return nil, err
	}
	id, err := entjwt.GetIDFromClaims(claims)
	if err != nil {
		return nil, err
	}
	return auth.VCFromID(id)
}

func (auth *SharedJwtAuth) validateToken(tokenStr string) (jwt.Claims, error) {
	claims := auth.GetBaseClaims()
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return auth.SigningKey, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid json token")
	}

	if token.Method != auth.getSigningMethod() {
		return nil, fmt.Errorf("invalid signing method")
	}
	return claims, nil
}

// ExtendTokenExpiration takes the current token and gets a new auth token for the user
// See ExtendTokenDuration for more information
func (auth *SharedJwtAuth) ExtendTokenExpiration(tokenStr string) (string, error) {
	claims, err := auth.validateToken(tokenStr)
	if err != nil {
		return "", err
	}
	if auth.ExtendTokenDuration != 0 {
		t, err := entjwt.GetExpiryTimeFromClaims(claims)
		if err != nil {
			return "", err
		}

		earliestTime := time.Unix(t, 0).Add(auth.ExtendTokenDuration * -1)
		now := jwt.TimeFunc()

		if now.Before(earliestTime) {
			return "", fmt.Errorf("can't extend token since not within the extend token window")
		}
	}
	id, err := entjwt.GetIDFromClaims(claims)
	if err != nil {
		return "", err
	}

	return auth.getTokenFromID(id)
}

func (auth *SharedJwtAuth) getTokenFromID(viewerID string) (string, error) {
	claims := auth.getClaims(viewerID)
	token := jwt.NewWithClaims(auth.getSigningMethod(), claims)
	tokenStr, err := token.SignedString(auth.SigningKey)
	if err != nil {
		return "", errors.Wrap(err, "error signing token ")
	}
	return tokenStr, nil
}
