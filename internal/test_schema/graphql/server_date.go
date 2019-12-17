package graphql

import "time"

// @graphql serverTime
// serverTime is a grapqhl query that returns the timestamp from the server's perspective
func serverTime() time.Time {
	return time.Now()
}
