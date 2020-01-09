package ent

import "github.com/lolopinto/ent/internal/util"

// CoalesceErr a variable numbers of errors and returns an error
// for now, it returns the first element
// TODO: return something that handles all the errors together
func CoalesceErr(errs ...error) error {
	return util.CoalesceErr(errs...)
}
