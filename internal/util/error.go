package util

import (
	"go/scanner"

	"github.com/davecgh/go-spew/spew"
	"golang.org/x/tools/go/packages"
)

func Die(err error) {
	if err != nil {
		spew.Dump(err)
		err2, ok := err.(scanner.ErrorList)
		if ok {
			for _, err3 := range err2 {
				spew.Dump(err3)
			}
		}
		panic(err)
	}
}

func ErrSlice(err []packages.Error) {
	str := ""
	for _, e := range err {
		str += e.Error() + "\n"
	}
	panic(str)
}

func CoalesceErrSlice(err []packages.Error) error {
	var errs = make([]error, len(err))
	for idx, e := range err {
		err[idx] = e
	}
	return CoalesceErr(errs...)
}

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
