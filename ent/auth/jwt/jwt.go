package jwt

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/lolopinto/ent/ent/viewer"
)

// Claims is needed to parse the logged in entity out of the Claims
// object so that we can pass to VCFromID after using a custom Claims object
// The ID should reference the underlying ID
type Claims interface {
	jwt.Claims
	ID() string
}

// ClaimsWithSubject is used to get the subject out of a the Claims object so that we can then fetch information about that subject
type ClaimsWithSubject interface {
	Claims
	Subject() string
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

func GetIDFromClaims(claims jwt.Claims) (string, error) {
	customClaims, ok := claims.(Claims)
	if ok {
		return customClaims.ID(), nil
	}

	switch typ := claims.(type) {
	case *jwt.StandardClaims:
		return typ.Id, nil
	case jwt.StandardClaims:
		return typ.Id, nil
	case jwt.MapClaims:
		if typ["jti"] != nil {
			return typ["jti"].(string), nil
		}
	}
	return GetKeyFromClaims(claims, "jti")
}

func GetSubjectFromClaims(claims jwt.Claims) (string, error) {
	customClaims, ok := claims.(ClaimsWithSubject)
	if ok {
		return customClaims.Subject(), nil
	}

	switch typ := claims.(type) {
	case *jwt.StandardClaims:
		return typ.Subject, nil
	case jwt.StandardClaims:
		return typ.Subject, nil
	case jwt.MapClaims:
		if typ["sub"] != nil {
			return typ["sub"].(string), nil
		}
		return "", errors.New("invalid claims")
	}
	return GetKeyFromClaims(claims, "sub")
}

func GetExpiryTimeFromClaims(claims jwt.Claims) (int64, error) {
	fn := func(val interface{}) (int64, error) {
		switch typ := val.(type) {
		case int64:
			return typ, nil
		case float64:
			return int64(typ), nil
		case json.Number:
			return typ.Int64()
		default:
			return 0, fmt.Errorf("invalid number %v %T", val, typ)
		}
	}
	switch typ := claims.(type) {
	case *jwt.StandardClaims:
		return typ.ExpiresAt, nil
	case jwt.StandardClaims:
		return typ.ExpiresAt, nil
	case jwt.MapClaims:
		if typ["exp"] != nil {
			return fn(typ["exp"])
		}
		return 0, errors.New("invalid claims")
	}
	val, err := getKeyFromClaims(claims, "exp")
	if err != nil {
		return 0, err
	}
	return fn(val)
}

func GetKeyFromClaims(claims jwt.Claims, key string) (string, error) {
	val, err := getKeyFromClaims(claims, key)
	if err != nil {
		return "", err
	}
	return val.(string), nil
}

func getKeyFromClaims(claims jwt.Claims, key string) (interface{}, error) {
	fn := func(m jwt.MapClaims) (interface{}, error) {
		val, ok := m[key]
		if ok {
			return val, nil
		}
		return "", errors.New("invalid claims")
	}

	mapClaims, ok := claims.(jwt.MapClaims)
	if ok {
		return fn(mapClaims)
	}

	raw, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	var m jwt.MapClaims
	if err = json.Unmarshal(raw, &m); err != nil {
		return "", err
	}
	return fn(m)
}
