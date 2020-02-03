package phonenumber

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/nyaruka/phonenumbers"
	"github.com/pkg/errors"
)

// Claims is needed to parse the logged in entity out of the claims
// object so that we can pass to VCFromID after using a custom Claims object
type Claims interface {
	jwt.Claims
	ID() string
}

// PhonePinAuth is an implementation of the Auth interface that
// verifies that a phone number/PIN implementation is valid
type PhonePinAuth struct {
	// Required function to take the phone number and returns an (ID, error) tuple indicating
	// if phone number maps to something in the database
	IDFromPhoneNumber func(string) (string, error)

	// Required function takes the ID above and returns a (ViewerContext, error) tuple. Called by AuthFromViewer method to return the ViewerContext
	// to be used for the current request
	VCFromID func(string) (viewer.ViewerContext, error)

	// Required. Used to sign the token used to auth the user
	SigningKey interface{}

	// DefaultRegion modifies the default region passed to phonennumbers.Parse when parsing the phone number
	// defaults to "US"
	DefaultRegion string
	// Format modifies the format used when formatting the phone number so
	// it's a consistent API: defaults to phonenumbers.E164 similar to
	// the phonenumber field which is how the phone number is probably stored
	Format phonenumbers.PhoneNumberFormat

	// Length of time the access token should be valid for. Default is DefaultDuration
	Duration time.Duration

	// What algorithm method should be used to sign this token. Default is DefaultSigningMethod
	SigningMethod jwt.SigningMethod

	// ClaimFunc is used to return a new instance of jwt.Claims to be used instead of jwt.StandardClaims
	// when generating token. It's passed to jwt.NewWithClaims
	ClaimFunc func(string) Claims
	// This pairs well with ClaimFunc to generate a new empty claims instance which is passed to jwt.ParseWithClaims
	BaseClaimFunc func() Claims
}

// NewPhonePinAuth returns a new instance of PhonePinAuth with
// all requried fields
func NewPhonePinAuth(
	signingKey interface{},
	idFromPhoneNumber func(string) (string, error),
	vcFromID func(string) (viewer.ViewerContext, error),
) *PhonePinAuth {
	return &PhonePinAuth{
		SigningKey:        signingKey,
		IDFromPhoneNumber: idFromPhoneNumber,
		VCFromID:          vcFromID,
	}
}

// DefaultDuration is the default time for which the token is valid. Used to
// generate the expiration time.
// TODO investigate what a good "Default" duration should be
// TODO, include refresh tokens and other complicated things as options
// needed for short durations like this. less needed for longer auth
var DefaultDuration = 1 * time.Hour

// DefaultSigningMethod is the signing method used to sign the token.
var DefaultSigningMethod = jwt.SigningMethodHS512

// DefaultRegion is the default region used to parse the phone number
var DefaultRegion = "US"

// AuthedIdentity is returned by the Authenticate method. Contains information about the identity
// which was just logged in
type AuthedIdentity struct {
	Viewer viewer.ViewerContext
	Token  string
}

// Authenticate takes credentials from the request and authenticates the user.
// Can be called from your GraphQL mutation, REST API, etc.
func (auth *PhonePinAuth) Authenticate(ctx context.Context, phoneNumber, pin string) (*AuthedIdentity, error) {
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

	vc, err := auth.VCFromID(viewerID)
	if err != nil {
		return nil, errors.Wrap(err, "error loading viewercontext")
	}

	// TODO everything from here down can be made generic
	claims := auth.getClaims(viewerID)
	token := jwt.NewWithClaims(auth.getSigningMethod(), claims)
	tokenStr, err := token.SignedString(auth.SigningKey)
	if err != nil {
		return nil, errors.Wrap(err, "error signing token ")
	}

	return &AuthedIdentity{
		Viewer: vc,
		Token:  tokenStr,
	}, nil

}

// TODO provide a different way to validate this
// TODO redis/memory/custom function
func (auth *PhonePinAuth) validatePIN(pin string) error {
	if len(pin) != 6 {
		return errors.New("invalid PIN")
	}
	return nil
}

func (auth *PhonePinAuth) getDuration() time.Duration {
	if auth.Duration == 0 {
		return DefaultDuration
	}
	return auth.Duration
}

func (auth *PhonePinAuth) getSigningMethod() jwt.SigningMethod {
	if auth.SigningMethod == nil {
		return DefaultSigningMethod
	}
	return auth.SigningMethod
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

func (auth *PhonePinAuth) getClaims(viewerID string) jwt.Claims {
	if auth.ClaimFunc == nil {
		duration := auth.getDuration()
		// use jwt.TimeFunc because that's what's used for verification
		// we can more easily test this and can't test time.Now
		expirationTime := jwt.TimeFunc().Add(duration)

		return jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
			Id:        viewerID,
		}
	}

	return auth.ClaimFunc(viewerID)
}

func (auth *PhonePinAuth) getBaseClaims() jwt.Claims {
	if auth.BaseClaimFunc == nil {
		return &jwt.StandardClaims{}
	}
	return auth.BaseClaimFunc()
}

// AuthViewer takes the authorization token from the request and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *PhonePinAuth) AuthViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	header := r.Header.Get("Authorization")
	if header == "" {
		return nil
	}

	parts := strings.Split(header, " ")

	if len(parts) != 2 || parts[0] != "Bearer" {
		log.Println("Invalid authorization header")
		return nil
	}

	v, err := auth.ViewerFromToken(parts[1])
	if err != nil {
		log.Printf("error %s grabbing viewer from token \n", err)
	}
	return v
}

// ViewerFromToken takes the token string and verifies if valid and then returns a ViewerContext
// which maps to user encoded in the token
func (auth *PhonePinAuth) ViewerFromToken(tokenStr string) (viewer.ViewerContext, error) {
	claims := auth.getBaseClaims()
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

	id, err := auth.getIDFromClaim(claims)
	if err != nil {
		return nil, err
	}
	return auth.VCFromID(id)
}

func (auth *PhonePinAuth) getIDFromClaim(claims jwt.Claims) (string, error) {
	customClaims, ok := claims.(Claims)
	if ok {
		return customClaims.ID(), nil
	}

	standardClaims, ok := claims.(*jwt.StandardClaims)
	if ok {
		return standardClaims.Id, nil
	}
	return "", errors.New("invalid claims")
}
