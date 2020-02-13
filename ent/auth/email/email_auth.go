package email

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/auth/internal/base"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/field/email"
	"github.com/lolopinto/ent/ent/viewer"

	"github.com/pkg/errors"
)

// EmailPasswordAuth is an implementation of the auth.Auth interface that
// verifies that an email/password combination is valid
type EmailPasswordAuth struct {
	// Required function to take the email/password and returns an (ID, error) tuple indicating
	// if email/password maps to something in the database
	IDFromEmailPassword func(string, string) (string, error)

	// Required function takes the ID above and returns a (ViewerContext, error) tuple. Called by AuthFromViewer method to return the ViewerContext
	// to be used for the current request
	VCFromID func(string) (viewer.ViewerContext, error)

	// Required. Used to sign the token used to auth the user
	SigningKey interface{}

	// Length of time the access token should be valid for. Default is jwt.DefaultDuration
	Duration time.Duration

	// What algorithm method should be used to sign this token. Default is jwt.DefaultSigningMethod
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

	shared *base.SharedJwtAuth

	// TODO is this needed? just to verify the cost?
	//Cost int
}

// NewEmailPasswordAuth returns a new instance of EmailPasswordAuth with
// all requried fields
func NewEmailPasswordAuth(
	signingKey interface{},
	idFromEmailPassword func(string, string) (string, error),
	vcFromID func(string) (viewer.ViewerContext, error),
) *EmailPasswordAuth {
	return &EmailPasswordAuth{
		IDFromEmailPassword: idFromEmailPassword,
		SigningKey:          signingKey,
		VCFromID:            vcFromID,
	}
}

func (auth *EmailPasswordAuth) newShared() *base.SharedJwtAuth {
	if auth.shared == nil {
		auth.shared = &base.SharedJwtAuth{
			VCFromID:            auth.VCFromID,
			SigningKey:          auth.SigningKey,
			Duration:            auth.Duration,
			SigningMethod:       auth.SigningMethod,
			ClaimFunc:           auth.ClaimFunc,
			BaseClaimFunc:       auth.BaseClaimFunc,
			ExtendTokenDuration: auth.ExtendTokenDuration,
		}
	}
	return auth.shared
}

// Authenticate takes credentials from the request and authenticates the user.
// Can be called from your GraphQL mutation, REST API, etc.
func (auth *EmailPasswordAuth) Authenticate(ctx context.Context, emailAddress, password string) (*entjwt.AuthedIdentity, error) {
	if auth.SigningKey == nil {
		return nil, fmt.Errorf("need to provide signing key to Authenticate")
	}
	if auth.IDFromEmailPassword == nil {
		return nil, fmt.Errorf("need to provide IDFromEmailPassword to Authenticate")
	}
	if auth.VCFromID == nil {
		return nil, fmt.Errorf("need to provide VCFromID to Authenticate")
	}

	emailAddress, err := auth.getFormattedEmail(emailAddress)
	if err != nil {
		return nil, err
	}

	viewerID, err := auth.IDFromEmailPassword(emailAddress, password)
	if err != nil {
		return nil, errors.Wrap(err, "error confirming email/password")
	}

	return auth.newShared().AuthFromID(viewerID)
}

// AuthViewer takes the authorization token from the request and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *EmailPasswordAuth) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	return auth.newShared().AuthViewer(w, r)
}

// ViewerFromToken takes the token string and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *EmailPasswordAuth) ViewerFromToken(tokenStr string) (viewer.ViewerContext, error) {
	return auth.newShared().ViewerFromToken(tokenStr)
}

// ExtendTokenExpiration takes the current token and gets a new auth token for the user
// See ExtendTokenDuration for more information
func (auth *EmailPasswordAuth) ExtendTokenExpiration(tokenStr string) (string, error) {
	return auth.newShared().ExtendTokenExpiration(tokenStr)
}

func (auth *EmailPasswordAuth) getFormattedEmail(emailAddress string) (string, error) {
	// use the default email formatting here so we're consistent
	emailType := email.Type()
	return emailType.ValidateAndFormat(emailAddress)
}
