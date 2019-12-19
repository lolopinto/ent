package ent

// CoalesceErr a variable numbers of errors and returns an error
// for now, it returns the first element
// TODO: return something that handles all the errors together
func CoalesceErr(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
