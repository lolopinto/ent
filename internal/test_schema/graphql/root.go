package graphql

import "github.com/lolopinto/ent/ent/auth"

func init() {
	// needed to login the user
	auth.Register("phoneAuth", phoneAuthHandler)
}
