package phonenumber

import (
	"errors"
	"fmt"

	"github.com/nyaruka/phonenumbers"
)

// Type returns a datatype that represents a phonenumber
func Type() *DataType {
	return &DataType{}
}

// DataType represents a datatype that validates and formats a phonenumber
// Uses a golang port of Google's libphonenumber library to do this
// Having a consistent storage format means that input can be taken in different formats,
// converted to the same format and then compared a lot more easily
type DataType struct {
	number         *phonenumbers.PhoneNumber
	format         phonenumbers.PhoneNumberFormat // default is E164 which seems to be the best option
	defaultRegion  string
	validateRegion bool
}

// Type returns string to satisfy the field.DataType interface. Indicates the field is stored as a string in databases
func (t *DataType) Type() interface{} {
	return ""
}

// WithFormat changes the format of how the phone number is stored.
// There are currently 4 formats:
// phonenumbers.NATIONAL,
// phonenumbers.INTERNATIONAL,
// phonenumbers.RFC3966, and
// phonenumbers.E164 (which is the default)
func (t *DataType) WithFormat(format phonenumbers.PhoneNumberFormat) *DataType {
	t.format = format
	return t
}

// WithDefaultRegion changes the default region when parsing a phone number without an area code
// Defaults to "US". Takes in a string which is the country code for region
// Haven't tested with all country codes but here's a list of 2 letters country codes: https://www.iban.com/country-codes
func (t *DataType) WithDefaultRegion(defaultRegion string) *DataType {
	t.defaultRegion = defaultRegion
	return t
}

// ValidateForRegion validates that a phone number is valid for a region which is different
// from the default behavior. The default behavior only checks that the phone number is a possible phone number but necessarily that it's a valid one.
func (t *DataType) ValidateForRegion() *DataType {
	t.validateRegion = true
	return t
}

func (t *DataType) getDefaultRegion() string {
	if t.defaultRegion != "" {
		return t.defaultRegion
	}
	return "US"
}

// Valid validates that the input is a valid phone number.
func (t *DataType) Valid(val interface{}) error {
	s := val.(string)
	number, err := phonenumbers.Parse(s, t.getDefaultRegion())
	if err != nil {
		return err
	}

	if t.validateRegion && !phonenumbers.IsValidNumber(number) {
		return errors.New("invalid number for region")
	}
	t.number = number
	return nil
}

// Format ensures that the datatype is stored in a consistent format at rest
// Should never be called without calling Valid() first
func (t *DataType) Format(val interface{}) (interface{}, error) {
	if t.number == nil {
		return nil, fmt.Errorf("called Format without calling Valid or with invalid number %s", val)
	}
	res := phonenumbers.Format(t.number, t.format)
	return res, nil
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
