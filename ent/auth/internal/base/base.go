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
}

// AuthFromID returns an AuthedIdentity that's shared across
// different implementation details of auth
func (auth *SharedJwtAuth) AuthFromID(viewerID string) (*entjwt.AuthedIdentity, error) {
	vc, err := auth.VCFromID(viewerID)
	if err != nil {
		return nil, errors.Wrap(err, "error loading viewercontext")
	}

	claims := auth.getClaims(viewerID)
	token := jwt.NewWithClaims(auth.getSigningMethod(), claims)
	tokenStr, err := token.SignedString(auth.SigningKey)
	if err != nil {
		return nil, errors.Wrap(err, "error signing token ")
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

	id, err := entjwt.GetIDFromClaims(claims)
	if err != nil {
		return nil, err
	}
	return auth.VCFromID(id)
}
