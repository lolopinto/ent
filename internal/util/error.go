package util

import (
	"go/scanner"
	"strings"

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
		errs[idx] = e
	}
	return CoalesceErr(errs...)
}

// CoalesceErr takes a variable numbers of errors and returns an error
func CoalesceErr(errs ...error) error {
	if len(errs) == 0 {
		return nil
	}

	var errors []error
	for _, err := range errs {
		if err != nil {
			errors = append(errors, err)
		}
	}
	if len(errors) == 0 {
		return nil
	}
	return &ErrorList{errs: errors}
}

// ErrorList encompasses a list of errors. It's also an error
type ErrorList struct {
	errs []error
}

func (e *ErrorList) Error() string {
	var sb strings.Builder
	for _, e := range e.errs {
		sb.WriteString(e.Error())
		sb.WriteString("\n")
	}
	return sb.String()
}
