package syncerr

import (
	"sync"

	"github.com/lolopinto/ent/internal/util"
)

// Error abstracts out collecting errors in goroutines
// Makes it safe to add each new error in Append
// This doesn't implement the error interface so that it doesn't break the if err != nil
// paradigm in golang. To check if there's an error, call the Err() method and check if that's nil
type Error struct {
	m    sync.Mutex
	errs []error
}

// Append takes an error and adds a new instance to its collection of errors
func (e *Error) Append(err error) {
	if err == nil {
		return
	}
	e.m.Lock()
	defer e.m.Unlock()
	e.errs = append(e.errs, err)
}

// Err returns something which satisfies the error interface
func (e *Error) Err() error {
	return util.CoalesceErr(e.errs...)
}
