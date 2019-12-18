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
	err := Log2(ctx, event)
	if err != nil {
		log.Printf("error: %v \n", err)
	}
}

// Log2 logs an event by taking the context (grabs the viewer from it), event to log and logs event at current time
// having these 2 is to just show behavior difference when an error is returned vs not
// @graphql logEvent2 Mutation
// TODO make event an enum eventually to make this even better
func Log2(ctx context.Context, event string) error {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		return err
	}
	t := time.Now()

	log.Printf("log event %s for viewer %s at time %v \n", event, v, t)
	return nil
}
