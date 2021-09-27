package util

import (
	"strings"

	"golang.org/x/tools/go/packages"
)

func ErrSlice(err []packages.Error) {
	str := ""
	for _, e := range err {
		str += e.Error() + "\n"
	}
	GoSchemaKill(str)
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
	for idx, e2 := range e.errs {
		if idx != 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(e2.Error())
	}
	return sb.String()
}
