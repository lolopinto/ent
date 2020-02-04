package jwt

import (
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/viewer"
)

// Claims is needed to parse the logged in entity out of the claims
// object so that we can pass to VCFromID after using a custom Claims object
type Claims interface {
	jwt.Claims
	ID() string
}

// AuthedIdentity is returned by the Authenticate method. Contains information about the identity
// which was just logged in
type AuthedIdentity struct {
	Viewer viewer.ViewerContext
	Token  string
}

// DefaultDuration is the default time for which the token is valid. Used to
// generate the expiration time.
// TODO investigate what a good "Default" duration should be
// TODO, include refresh tokens and other complicated things as options
// needed for short durations like this. less needed for longer auth
var DefaultDuration = 1 * time.Hour

// DefaultSigningMethod is the signing method used to sign the token.
var DefaultSigningMethod = jwt.SigningMethodHS512
