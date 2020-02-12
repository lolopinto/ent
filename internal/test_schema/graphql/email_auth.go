// Code generated by github.com/lolopinto/ent/ent.

package graphql

import (
	"context"
	"database/sql"
	"time"

	"github.com/lolopinto/ent/ent/auth/email"
	field "github.com/lolopinto/ent/ent/field/email"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/testschemaviewer"
)

// TODO (developer): this should be stored in an environment variable instead
var emailSigningKey = []byte("LUSzO8xFGGPaR1Sy1eR2l5YP331Xw29ZOZTmIHSVpwTlckGystIId8XnRnByjT3")

var emailAuthHandler = &email.EmailPasswordAuth{
	SigningKey:          emailSigningKey,
	IDFromEmailPassword: models.ValidateEmailPassword,
	VCFromID:            testschemaviewer.NewViewerContext,
	// only allow tokens to be extended in last 10 minutes.
	ExtendTokenDuration: 10 * time.Minute,
	// can provide more options here. e.g. change Duration or custom claims method
}

// TODO (developer):
// To have the token which AuthEmailPassword returns work, need to register this handler somewhere.
// Copy this line and move to an init() function in root.go or other file in graphql/ folder
// We can't automatically generate this so onus on the developer
// Also need: import "github.com/lolopinto/ent/ent/auth"
// auth.Register("email_auth", emailAuthHandler)

// AuthEmailPassword takes an email and password and logs the user in if valid
// @graphql authEmailPassword Mutation
// @graphqlreturn token
func AuthEmailPassword(ctx context.Context, email, password string) (string, error) {
	identity, err := emailAuthHandler.Authenticate(ctx, email, password)
	if err != nil {
		return "", err
	}
	// TODO map to graphql viewer object and expose graphql viewer here by default.
	return identity.Token, nil
}

// CheckCanSigninWithEmailAddress returns a boolean indicating if emailAddress is available
// TODO (developer): may make sense to remove this if you don't want to expose an API method that can be easily
// hit to check this without rate limits (or add rate limiting)
// @graphql authCheckAvailableEmailAddress Mutation
// @graphqlreturn available
func CheckCanSigninWithEmailAddress(ctx context.Context, emailAddress string) (bool, error) {
	formatted, err := formattedEmail(emailAddress)
	if err != nil {
		return false, err
	}
	id, err := models.LoadUserIDFromEmailAddress(formatted)
	if err != nil && err != sql.ErrNoRows {
		return false, err
	}
	return id == "", nil
}

// AuthEmailLogout logs the user out.
// @graphql authSignoutEmail Mutation
// TODO (developer): rename if you don't have conflicts?
func AuthEmailLogout(ctx context.Context) {
	// nothing to do here since stateless session
	// needs to be handled on the client
	// when there's a refresh token, we'll kill it
}

// AuthEmailExtendToken takes the current auth token and returns a new token
// if current token is valid
// @graphql authEmailToken Mutation
// @graphqlreturn token
func AuthEmailExtendToken(ctx context.Context, token string) (string, error) {
	return emailAuthHandler.ExtendTokenExpiration(token)
}

func formattedEmail(emailAddress string) (string, error) {
	return field.Type().ValidateAndFormat(emailAddress)
}
