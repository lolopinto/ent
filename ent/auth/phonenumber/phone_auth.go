package phonenumber

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/auth/internal/base"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/field/phonenumber"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/nyaruka/phonenumbers"
	"github.com/pkg/errors"
)

// TODO rename from PhonePinAuth to PasswordlessAuth and "support" emails
// most functionality is the same. Few things will change: validation, nomenclature etc

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

	// ClaimFunc is used to return a new instance of jwt.Claims to be used instead of jwt.MapClaims
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

	// Required to validate the phone number/pin combo as valid
	// Can use default Memory or Redis Validator if need be
	Validator Validator

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
}

// NewPhonePinAuth returns a new instance of PhonePinAuth with
// all requried fields
func NewPhonePinAuth(
	signingKey interface{},
	idFromPhoneNumber func(string) (string, error),
	vcFromID func(string) (viewer.ViewerContext, error),
	validator Validator,
) *PhonePinAuth {
	return &PhonePinAuth{
		IDFromPhoneNumber: idFromPhoneNumber,
		SigningKey:        signingKey,
		VCFromID:          vcFromID,
		Validator:         validator,
	}
}

// DefaultRegion is the default region used to parse the phone number
var DefaultRegion = "US"

func (auth *PhonePinAuth) newShared() *base.SharedJwtAuth {
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
func (auth *PhonePinAuth) Authenticate(ctx context.Context, phoneNumber, pin string) (*entjwt.AuthedIdentity, error) {
	if err := auth.validateArgs(); err != nil {
		return nil, err
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

	if err := auth.Validator.Valid(phoneNumber, pin); err != nil {
		return nil, errors.Wrap(err, "error validating pin")
	}

	clearer, ok := auth.Validator.(Clearer)
	if ok {
		defer clearer.Clear(phoneNumber)
	}

	return auth.newShared().AuthFromID(viewerID)
}

// AvailableAndValid returns a boolean indicating that the phoneNumber/pin combo can be used to sign-in or register
// Doesn't clear the PIN because it could eventually be used in the corresponding account create mutation
// If this is a OneTimePINValidator or anything that clears when Validate is called, beware!
func (auth *PhonePinAuth) AvailableAndValid(ctx context.Context, phoneNumber, pin string) (bool, error) {
	if err := auth.validateArgs(); err != nil {
		return false, err
	}

	var err error
	phoneNumber, err = auth.getFormattedNumber(phoneNumber)
	if err != nil {
		return false, err
	}

	viewerID, err := auth.IDFromPhoneNumber(phoneNumber)
	// sql.ErrNoRows is fine!
	// TODO we need redis.Nil etc support
	if err != nil && err != sql.ErrNoRows {
		return false, errors.Wrap(err, "error confirming phoneNumber exists")
	}
	if viewerID != "" {
		return false, errors.New("phoneNumber already maps to an existing user")
	}

	if err := auth.Validator.Valid(phoneNumber, pin); err != nil {
		return false, errors.Wrap(err, "error validating pin")
	}

	return true, nil
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

// ExtendTokenExpiration takes the current token and gets a new auth token for the user
// See ExtendTokenDuration for more information
func (auth *PhonePinAuth) ExtendTokenExpiration(tokenStr string) (string, error) {
	return auth.newShared().ExtendTokenExpiration(tokenStr)
}

func (auth *PhonePinAuth) getFormattedNumber(phoneNumber string) (string, error) {
	defaultRegion := auth.DefaultRegion
	if defaultRegion == "" {
		defaultRegion = DefaultRegion
	}
	// use field phone number formatting
	typ := phonenumber.Type().WithFormat(auth.Format).WithDefaultRegion(defaultRegion)
	return typ.ValidateAndFormat(phoneNumber)
}

func (auth *PhonePinAuth) validateArgs() error {
	if auth.SigningKey == nil {
		return fmt.Errorf("need to provide signing key to Authenticate")
	}
	if auth.IDFromPhoneNumber == nil {
		return fmt.Errorf("need to provide IDFromPhoneNumber to Authenticate")
	}
	if auth.VCFromID == nil {
		return fmt.Errorf("need to provide VCFromID to Authenticate")
	}
	if auth.Validator == nil {
		return fmt.Errorf("need to provide Validator to Authenticate")
	}

	return nil
}
