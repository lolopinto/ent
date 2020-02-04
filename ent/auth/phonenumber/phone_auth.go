package phonenumber

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/auth/internal/base"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/nyaruka/phonenumbers"
	"github.com/pkg/errors"
)

// PhonePinAuth is an implementation of the auth.Auth interface that
// verifies that a phone number/PIN combination is valid
type PhonePinAuth struct {
	// Required function to take the phone number and returns an (ID, error) tuple indicating
	// if phone number maps to something in the database
	IDFromPhoneNumber func(string) (string, error)

	// Required function takes the ID above and returns a (ViewerContext, error) tuple. Called by AuthFromViewer method to return the ViewerContext
	// to be used for the current request
	VCFromID func(string) (viewer.ViewerContext, error)

	// Required. Used to sign the token used to auth the user
	SigningKey interface{}

	// Length of time the access token should be valid for. Default is jwt.DefaultDuration
	Duration time.Duration

	// What algorithm method should be used to sign this token. Default is jwt.DefaultSigningMethod
	SigningMethod jwt.SigningMethod

	// ClaimFunc is used to return a new instance of jwt.Claims to be used instead of jwt.StandardClaims
	// when generating token. It's passed to jwt.NewWithClaims
	ClaimFunc func(string) entjwt.Claims
	// This pairs well with ClaimFunc to generate a new empty claims instance which is passed to jwt.ParseWithClaims
	BaseClaimFunc func() entjwt.Claims

	// DefaultRegion modifies the default region passed to phonennumbers.Parse when parsing the phone number
	// defaults to "US"
	DefaultRegion string
	// Format modifies the format used when formatting the phone number so
	// it's a consistent API: defaults to phonenumbers.E164 similar to
	// the phonenumber field which is how the phone number is probably stored
	Format phonenumbers.PhoneNumberFormat

	shared *base.SharedJwtAuth
}

// NewPhonePinAuth returns a new instance of PhonePinAuth with
// all requried fields
func NewPhonePinAuth(
	signingKey interface{},
	idFromPhoneNumber func(string) (string, error),
	vcFromID func(string) (viewer.ViewerContext, error),
) *PhonePinAuth {
	return &PhonePinAuth{
		IDFromPhoneNumber: idFromPhoneNumber,
		SigningKey:        signingKey,
		VCFromID:          vcFromID,
	}
}

// DefaultRegion is the default region used to parse the phone number
var DefaultRegion = "US"

func (auth *PhonePinAuth) newShared() *base.SharedJwtAuth {
	if auth.shared == nil {
		auth.shared = &base.SharedJwtAuth{
			VCFromID:      auth.VCFromID,
			SigningKey:    auth.SigningKey,
			Duration:      auth.Duration,
			SigningMethod: auth.SigningMethod,
			ClaimFunc:     auth.ClaimFunc,
			BaseClaimFunc: auth.BaseClaimFunc,
		}
	}
	return auth.shared
}

// Authenticate takes credentials from the request and authenticates the user.
// Can be called from your GraphQL mutation, REST API, etc.
func (auth *PhonePinAuth) Authenticate(ctx context.Context, phoneNumber, pin string) (*entjwt.AuthedIdentity, error) {
	if auth.SigningKey == nil {
		return nil, fmt.Errorf("need to provide signing key to Authenticate")
	}
	if auth.IDFromPhoneNumber == nil {
		return nil, fmt.Errorf("need to provide IDFromPhoneNumber to Authenticate")
	}
	if auth.VCFromID == nil {
		return nil, fmt.Errorf("need to provide VCFromID to Authenticate")
	}

	var err error
	phoneNumber, err = auth.getFormattedNumber(phoneNumber)
	if err != nil {
		return nil, err
	}

	viewerID, err := auth.IDFromPhoneNumber(phoneNumber)
	if err != nil {
		return nil, errors.Wrap(err, "error confirming phoneNumber exists")
	}

	if err := auth.validatePIN(pin); err != nil {
		return nil, errors.Wrap(err, "error validating pin")
	}

	return auth.newShared().AuthFromID(viewerID)
}

// TODO provide a different way to validate this
// TODO redis/memory/custom function
func (auth *PhonePinAuth) validatePIN(pin string) error {
	if len(pin) != 6 {
		return errors.New("invalid PIN")
	}
	return nil
}

// AuthViewer takes the authorization token from the request and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *PhonePinAuth) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	return auth.newShared().AuthViewer(w, r)
}

// ViewerFromToken takes the token string and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *PhonePinAuth) ViewerFromToken(tokenStr string) (viewer.ViewerContext, error) {
	return auth.newShared().ViewerFromToken(tokenStr)
}

func (auth *PhonePinAuth) getFormattedNumber(phoneNumber string) (string, error) {
	defaultRegion := auth.DefaultRegion
	if defaultRegion == "" {
		defaultRegion = DefaultRegion
	}
	number, err := phonenumbers.Parse(phoneNumber, defaultRegion)
	if err != nil {
		return "", errors.Wrap(err, "invalid phone number")
	}
	return phonenumbers.Format(number, auth.Format), nil
}
