package jwt_test

import (
	"errors"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testCase struct {
	claims  jwt.Claims
	err     error
	id      string
	subj    string
	email   string
	expTime int64
}

type customClaims struct {
	jwt.StandardClaims
	Email string `json:"email"`
}

func (c customClaims) ID() string {
	return c.StandardClaims.Id
}

func (c customClaims) Subject() string {
	return c.StandardClaims.Subject
}

type nonStandardClaims struct {
	Email string // no json
	jwt.StandardClaims
}

func TestIDFromClaims(t *testing.T) {
	testCases := map[string]testCase{
		"mapClaims": {
			claims: jwt.MapClaims{
				"jti": "1",
			},
			id: "1",
		},
		"standardclaims": {
			claims: jwt.StandardClaims{
				Id:        "1",
				ExpiresAt: time.Now().Add(1 * time.Hour).Unix(),
			},
			id: "1",
		},
		"standardclaimsPtr": {
			claims: &jwt.StandardClaims{
				Id:        "1",
				ExpiresAt: time.Now().Add(1 * time.Hour).Unix(),
			},
			id: "1",
		},
		"customClaims": {
			claims: customClaims{
				StandardClaims: jwt.StandardClaims{
					Id: "1",
				},
			},
			id: "1",
		},
		// this uses json encoding to get it even though it doesn't implement ID() func
		"nonStandardClaims": {
			claims: nonStandardClaims{
				StandardClaims: jwt.StandardClaims{
					Id: "1",
				},
			},
			id: "1",
		},
	}

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			id, err := entjwt.GetIDFromClaims(tt.claims)

			require.NoError(t, err)
			assert.Equal(t, tt.id, id)
		})
	}
}

func TestSubjectFromClaims(t *testing.T) {
	testCases := map[string]testCase{
		"mapClaims": {
			claims: jwt.MapClaims{
				"sub": "1",
			},
			subj: "1",
		},
		"standardclaims": {
			claims: jwt.StandardClaims{
				Subject: "1",
			},
			subj: "1",
		},
		"standardclaimsPtr": {
			claims: &jwt.StandardClaims{
				Subject: "1",
			},
			subj: "1",
		},
		"customClaims": {
			claims: customClaims{
				StandardClaims: jwt.StandardClaims{
					Subject: "1",
				},
			},
			subj: "1",
		},
		// this uses json encoding to get it even though it doesn't implement Subject() func
		"nonStandardClaims": {
			claims: nonStandardClaims{
				StandardClaims: jwt.StandardClaims{
					Subject: "1",
				},
			},
			subj: "1",
		},
	}

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			subj, err := entjwt.GetSubjectFromClaims(tt.claims)

			require.NoError(t, err)
			assert.Equal(t, tt.subj, subj)
		})
	}
}

func TestKeyFromClaims(t *testing.T) {
	testCases := map[string]testCase{
		"mapClaims": {
			claims: jwt.MapClaims{
				"email": "test@email.com",
			},
			email: "test@email.com",
		},
		"standardclaims": {
			claims: jwt.StandardClaims{
				Subject: "1",
			},
			err: errors.New("invalid claims"),
		},
		"standardclaimsPtr": {
			claims: &jwt.StandardClaims{
				Subject: "1",
			},
			err: errors.New("invalid claims"),
		},
		// this uses json encoding to get it
		"customClaims": {
			claims: customClaims{
				Email: "test@email.com",
			},
			email: "test@email.com",
		},
		// can't get it with json encoding even though field is there
		"nonStandardClaims": {
			claims: nonStandardClaims{
				Email: "test@email.com",
			},
			err: errors.New("invalid claims"),
		},
	}

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			email, err := entjwt.GetKeyFromClaims(tt.claims, "email")

			if tt.err == nil {
				require.NoError(t, err)
				assert.Equal(t, tt.email, email)
			} else {
				require.Error(t, err)
				require.Equal(t, tt.err, err)
			}

		})
	}
}

func TestExpiryTimeFromClaims(t *testing.T) {
	future := time.Now().Add(1 * time.Hour).Unix()
	testCases := map[string]testCase{
		"mapClaims": {
			claims: jwt.MapClaims{
				"jti": "1",
				"exp": future,
			},
			expTime: future,
		},
		"standardclaims": {
			claims: jwt.StandardClaims{
				Id:        "1",
				ExpiresAt: future,
			},
			expTime: future,
		},
		"standardclaimsPtr": {
			claims: &jwt.StandardClaims{
				Id:        "1",
				ExpiresAt: future,
			},
			expTime: future,
		},
		"customClaims": {
			claims: customClaims{
				StandardClaims: jwt.StandardClaims{
					ExpiresAt: future,
				},
			},
			expTime: future,
		},
	}

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			expTime, err := entjwt.GetExpiryTimeFromClaims(tt.claims)

			require.NoError(t, err)
			assert.Equal(t, tt.expTime, expTime)
		})
	}
}
