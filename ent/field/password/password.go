package password

import (
	"fmt"
	"regexp"
	"unicode"

	"github.com/lolopinto/ent/ent/field"
	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/crypto/bcrypt"
)

// Type returns a datatype that represents a password
func Type() *dataType {
	return &dataType{str: field.StringType()}
}

// hide from graphql √
// private √
// not included in actions by default √
// TODO sensitive

type dataType struct {
	cost *int
	str  *field.StringDataType
}

// Private indicates that the DataType is private and shouldn't be exposed to graphql, exposed out of the package
// or by default exposed in actions
func (t *dataType) Private() bool {
	return true
}

// Cost specifies the cost to use to pass to bcrypt.GenerateFromPassword()
// to generate the password. It defaults to bcrypt.DefaultCost if not modified
// by this method
func (t *dataType) Cost(cost int) *dataType {
	t.cost = &cost
	return t
}

// NotEmpty ensures that the password is not empty
func (t *dataType) NotEmpty() *dataType {
	t.str.NotEmpty()
	return t
}

// MinLen ensures the minimum length of the password
func (t *dataType) MinLen(n int) *dataType {
	t.str.MinLen(n)
	return t
}

// MaxLen ensures the max length of the password
func (t *dataType) MaxLen(n int) *dataType {
	t.str.MaxLen(n)
	return t
}

// Length ensures the length of the password is equal to the given number
func (t *dataType) Length(n int) *dataType {
	t.str.Length(n)
	return t
}

// Match ensures that the password matches a regular expression
func (t *dataType) Match(r *regexp.Regexp) *dataType {
	t.str.Match(r)
	return t
}

// DoesNotMatch ensures that the password does not match a regular expression
func (t *dataType) DoesNotMatch(r *regexp.Regexp) *dataType {
	t.str.DoesNotMatch(r)
	return t
}

// Validate takes a function that Validates the value of the password
func (t *dataType) Validate(fn func(string) error) *dataType {
	t.str.Validate(fn)
	return t
}

func (t *dataType) getCost() int {
	if t.cost == nil {
		return bcrypt.DefaultCost
	}
	return *t.cost
}

func (t *dataType) Type() interface{} {
	return ""
}

// Valid implements the Validator interface to validate the password input
func (t *dataType) Valid(val interface{}) error {
	// doing this here because this error should come from Valid instead of Format
	// which is easier for testing
	if t.cost != nil && *t.cost > bcrypt.MaxCost {
		return bcrypt.InvalidCostError(*t.cost)
	}

	// convert to string and use the string datatype to validate any validators that hae been added
	s := val.(string)
	return t.str.Valid(s)
}

// Format implements the Formatter interface to format the string input before storing
func (t *dataType) Format(val interface{}) (interface{}, error) {
	// probably no formatters since we intentionally don't currently expose Formatter()
	// to passwords since passwords *should* theoretically be stored as-is...
	// However, format with string datatype to be consistent
	s, err := t.str.Format(val)
	if err != nil {
		return nil, err
	}
	str := s.(string)
	// after any previous formatting, hash and salt based on bcrypt algorithm
	b, err := bcrypt.GenerateFromPassword([]byte(str), t.getCost())
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// PasswordMatcher provides a default password validator to be used
// while specifying a minimum number for each character category
type PasswordMatcher struct {
	Lower     int
	Number    int
	MinLength int
	MaxLength int
	Upper     int
	Special   int
}

// StereoTypicalMatcher provides an example that matches what's currently
// considered a standard password matcher on most websites. Doesn't predispose
// that it's good security practice to follow this for example, minimum length of 8 characters
func StereoTypicalMatcher() *PasswordMatcher {
	return &PasswordMatcher{
		Upper:     1,
		Number:    1,
		MinLength: 8,
		MaxLength: 30,
		Special:   1,
		Lower:     1,
	}
}

// Match is a function that can be passed to password.Field().Validate() to
// ensure that the PasswordMatcher meets whatever criteria that was defined
func (m *PasswordMatcher) Match(s string) error {
	lower := 0
	number := 0
	special := 0
	upper := 0

	for _, c := range s {
		if m.Lower != 0 && unicode.IsLower(c) {
			lower++
		}
		if m.Number != 0 && unicode.IsDigit(c) {
			number++
		}
		if m.Upper != 0 && unicode.IsUpper(c) {
			upper++
		}
		if m.Special != 0 && (unicode.IsPunct(c) || unicode.IsSymbol(c)) {
			special++
		}
	}

	length := len(s)
	var err []error
	if m.MinLength != 0 && length < m.MinLength {
		err = append(err, fmt.Errorf("length %d < min length %d", length, m.MinLength))
	}
	if m.MaxLength != 0 && length > m.MaxLength {
		err = append(err, fmt.Errorf("length %d > max length %d", length, m.MaxLength))
	}
	if m.Lower != 0 && lower < m.Lower {
		err = append(err, fmt.Errorf("didn't meet the minimum lower length %d", m.Lower))
	}
	if m.Number != 0 && number < m.Number {
		err = append(err, fmt.Errorf("didn't meet the minimum number length %d", m.Number))
	}

	if m.Upper != 0 && upper < m.Upper {
		err = append(err, fmt.Errorf("didn't meet the minimum upper length %d", m.Upper))
	}
	if m.Special != 0 && special < m.Special {
		err = append(err, fmt.Errorf("didn't meet the minimum special characters length %d", m.Special))
	}

	return util.CoalesceErr(err...)
}
