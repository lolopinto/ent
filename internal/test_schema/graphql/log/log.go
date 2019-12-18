package log

import (
	"context"
	"log"
	"time"

	"github.com/lolopinto/ent/ent/viewer"
)

// Log logs an event by taking the context (grabs the viewer from it), event to log and logs event at current time
// @graphql logEvent Mutation
// TODO make event an enum eventually to make this even better
func Log(ctx context.Context, event string) {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		// TODO make return type of error here work
		log.Printf("error: %v \n", err)
		return
	}
	t := time.Now()

	log.Printf("log event %s for viewer %s at time %v \n", event, v, t)
}
