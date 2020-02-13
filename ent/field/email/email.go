package email

import (
	"fmt"
	"net/mail"

	"github.com/lolopinto/ent/ent/field"
)

// Type returns a datatype that implements the field.DataType interface
func Type() *DataType {
	return &DataType{}
}

// DataType represents a datatype that validates and formats an email address
// Uses mail.ParseAddress from the "net/mail" package to parse the input and verify that it's a valid email
// Only supports raw email addresses. Doesn't support email addresses with Names
// e.g. "Barry Gibbs <bg@example.com>" is an invalid datatype
// It always formats the email address at storage to always be in lowercase and no leading or trailing spaces
// Don't use a regex here because there's built-in functionality that already does the parsing we need and better to use
// standard library than re-implement in
type DataType struct {
}

// Type returns string to satisfy the field.DataType interface
func (t *DataType) Type() interface{} {
	return ""
}

// Valid validates that the input is a valid email address.
func (t *DataType) Valid(val interface{}) error {
	s := val.(string)
	address, err := mail.ParseAddress(s)
	if err != nil {
		return err
	}
	if address.Name != "" {
		return fmt.Errorf("Invalid address %s with Name was passed in email address. See mail.ParseAddress", address.Name)
	}

	return nil
}

// Format ensures that the datatype is stored in a consistent format at rest
func (t *DataType) Format(val interface{}) (interface{}, error) {
	dt := field.StringType().ToLower().TrimSpace()

	return dt.Format(val)
}

// ValidateAndFormat calls Valid and then Format if valid
func (t *DataType) ValidateAndFormat(val interface{}) (string, error) {
	if err := t.Valid(val); err != nil {
		return "", err
	}
	res, err := t.Format(val)
	if err != nil {
		return "", err
	}
	return res.(string), nil
}
