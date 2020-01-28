package field

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/lolopinto/ent/ent/cast"
)

// String returns a new Datatype with type String
func String() *StringType {
	return &StringType{}
}

// Int returns a new DataType with type Int
func Int() *IntegerType {
	return &IntegerType{}
}

// Bool returns a new DataType with type Bool
func Bool() *BoolType {
	return &BoolType{}
}

// Float returns a new DataType with type Float
func Float() *FloatType {
	return &FloatType{}
}

// Time returns a new DataType with type Time
// Because the default value for time we store in the db is without timezone, we automatically format to UTC
// To change this, can use Formatter e.g.
// 	field.Time().Formatter(func(t time.Time) time.Time {
//		return t.Local()
//	})
// or use a different time format field
func Time() *timeType {
	t := &timeType{}
	t.Formatter(func(t time.Time) time.Time {
		return t.UTC()
	})
	return t
}

// Ints returns a new Datatype with type []int. It doesn't enforce that the type saved is of that type without calling EnforceType()
func Ints() *jsonType {
	return JSON([]int{})
}

// Strings returns a new Datatype with type []string. It doesn't enforce that the type saved is of that type without calling EnforceType()
func Strings() *jsonType {
	return JSON([]string{})
}

// Floats returns a new Datatype with type []float64. It doesn't enforce that the type saved is of that type without calling EnforceType()
func Floats() *jsonType {
	return JSON([]float64{})
}

// JSON returns a new DataType where the value is stored in a text column in the db that's json encoded
// Provides a base type for type enforcement (optional) and to get any package that needs to be included in the generated code
func JSON(base interface{}) *jsonType {
	typ := reflect.TypeOf(base)
	return &jsonType{base: base, typ: typ}
}

// Noop returns a type which implemente the DataType interface but doesn't do
// anything. Shouldn't be used in declaration of fields in GetFields() in an EntConfig.
// Behavior is undefined
func Noop() *noopType {
	return &noopType{}
}

type noopType struct{}

func (noopType) Type() interface{} {
	return nil
}

// TODO Enum
// TODO int64 for when we support integer autoincrement ids
// how do we differentiate between types based on default values. probably need override of type?
// TODO float32 vs float64. we default to float64 right now
// theoretically need to also support every possible type but no rush to support int8, int16, etc.

// DataType interface represents a piece of datum stored in any field
// in any of the nodes in the graph
type DataType interface {

	// Type method is used to determine the underlying type of the data
	// that's stored here. Implementors should return the zero-value of the
	// type stored here.
	// We currently use static-analysis to infer the type based on what's returned here.
	Type() interface{}
}

// Validator ensures that a DataType is valid
type Validator interface {
	Valid(interface{}) error
}

// Formatter formats the DataType to make sure that it's formatted in the preferred way before
// storing
type Formatter interface {
	Format(interface{}) (interface{}, error)
}

// ImportableDataType interface represents data that need to import a package to
// be referenced
// e.g. "time" for time datatype
type ImportableDataType interface {
	DataType
	// PkgPath returns package that should be imported when this datatype is
	PkgPath() string
}

// StringType is the datatype for string fields
type StringType struct {
	validators []func(string) error
	formatters []func(string) string
}

// Type returns the empty string to satisfy the DataType interface
func (t *StringType) Type() interface{} {
	return ""
}

// NotEmpty ensures that the string is not empty
func (t *StringType) NotEmpty() *StringType {
	return t.MinLen(1)
}

// MinLen ensures the minimum length of a string
func (t *StringType) MinLen(n int) *StringType {
	return t.Validate(func(s string) error {
		if len(s) < n {
			return fmt.Errorf("length of string did not meet the minimum length requirement of %d", n)
		}
		return nil
	})
}

// MaxLen ensures the max length of a string
func (t *StringType) MaxLen(n int) *StringType {
	return t.Validate(func(s string) error {
		if len(s) > n {
			return fmt.Errorf("length of string did not meet the maximum length requirement of %d", n)
		}
		return nil
	})
}

// Length ensures the length of a string is equal to the given number
func (t *StringType) Length(n int) *StringType {
	return t.Validate(func(s string) error {
		if len(s) != n {
			return fmt.Errorf("length of string was not equal to the required length %d", n)
		}
		return nil
	})
}

// Match ensures that the string matches a regular expression
func (t *StringType) Match(r *regexp.Regexp) *StringType {
	return t.Validate(func(s string) error {
		if !r.MatchString(s) {
			return fmt.Errorf("value does not match passed in regex %s", r.String())
		}
		return nil
	})
}

// DoesNotMatch ensures that the string does not match a regular expression
func (t *StringType) DoesNotMatch(r *regexp.Regexp) *StringType {
	return t.Validate(func(s string) error {
		if r.MatchString(s) {
			return fmt.Errorf("value matches passed in regex %s", r.String())
		}
		return nil
	})
}

// ToLower returns string with all Unicode letters mapped to their lower case.
func (t *StringType) ToLower() *StringType {
	return t.Formatter(func(s string) string {
		return strings.ToLower(s)
	})
}

// ToUpper returns string with all Unicode letters mapped to their upper case.
func (t *StringType) ToUpper() *StringType {
	return t.Formatter(func(s string) string {
		return strings.ToUpper(s)
	})
}

// Title returns string with all Unicode letters mapped to their Unicode title case.
func (t *StringType) Title() *StringType {
	return t.Formatter(func(s string) string {
		return strings.Title(s)
	})
}

// TrimSpace returns string with all leading and trailing white space removed, as defined by Unicode.
func (t *StringType) TrimSpace() *StringType {
	return t.Formatter(func(s string) string {
		return strings.TrimSpace(s)
	})
}

// Validate takes a function that Validates the value of the string
func (t *StringType) Validate(fn func(string) error) *StringType {
	t.validators = append(t.validators, fn)
	return t
}

// Formatter takes a function that takes the value of the string and re-formats it
// The order in which functions are passed in here should not matter ala the associative property in math
func (t *StringType) Formatter(fn func(string) string) *StringType {
	t.formatters = append(t.formatters, fn)
	return t
}

// Valid implements the Validator interface to validate the string input
func (t *StringType) Valid(val interface{}) error {
	s := val.(string)
	for _, val := range t.validators {
		if err := val(s); err != nil {
			return err
		}
	}
	return nil
}

// Format implements the Formatter interface to format the string input before storing
func (t *StringType) Format(val interface{}) (interface{}, error) {
	s := val.(string)
	for _, format := range t.formatters {
		s = format(s)
	}
	return s, nil
}

var _ DataType = &StringType{}

// IntegerType is the datatype for int fields
type IntegerType struct {
	validators []func(int) error
}

// Type returns 0 to satisfy the DataType interface
func (t *IntegerType) Type() interface{} {
	return 0
}

// Validate takes a function that Validates the value of the int
func (t *IntegerType) Validate(fn func(int) error) *IntegerType {
	t.validators = append(t.validators, fn)
	return t
}

// Positive validates that the integer is positive
func (t *IntegerType) Positive() *IntegerType {
	return t.Min(1)
}

// Negative validates that the integer is negative
func (t *IntegerType) Negative() *IntegerType {
	return t.Max(-1)
}

// Min validates the minimum value of the integer
func (t *IntegerType) Min(min int) *IntegerType {
	return t.Validate(func(val int) error {
		if val < min {
			return fmt.Errorf("value of integer did not meet the minimum requirement of %d", min)
		}
		return nil
	})
}

// Max validates the maximum value of the integer
func (t *IntegerType) Max(max int) *IntegerType {
	return t.Validate(func(val int) error {
		if val > max {
			return fmt.Errorf("value of integer did not meet the maximum requirement of %d", max)
		}
		return nil
	})
}

// Valid implements the Validator interface to validate the int input
func (t *IntegerType) Valid(val interface{}) error {
	i := val.(int)
	for _, val := range t.validators {
		if err := val(i); err != nil {
			return err
		}
	}
	return nil
}

var _ DataType = &IntegerType{}

// BoolType is the datatype for boolean fields
type BoolType struct{}

// Type returns false to satisfy the DataType interface
func (t *BoolType) Type() interface{} {
	return false
}

var _ DataType = &BoolType{}

// FloatType is the datatype for float fields
type FloatType struct {
	validators []func(float64) error
}

// Type returns 0.0 to satisfy the DataType interface
func (t *FloatType) Type() interface{} {
	return 0.0
}

// Validate takes a function that Validates the value of the float64
func (t *FloatType) Validate(fn func(float64) error) *FloatType {
	t.validators = append(t.validators, fn)
	return t
}

// Positive validates that the float64 is "positive". Uses a minimum value of 0.0000000001
func (t *FloatType) Positive() *FloatType {
	return t.Min(1e-10)
}

// Negative validates that the float64 is "negative". Uses a maximum value of 0.0000000001
func (t *FloatType) Negative() *FloatType {
	return t.Max(1e-10)
}

// Min validates the minimum value of the float64
func (t *FloatType) Min(min float64) *FloatType {
	return t.Validate(func(val float64) error {
		if val < min {
			return fmt.Errorf("value of integer did not meet the minimum requirement of %f", min)
		}
		return nil
	})
}

// Max validates the maximum value of the float64
func (t *FloatType) Max(max float64) *FloatType {
	return t.Validate(func(val float64) error {
		if val > max {
			return fmt.Errorf("value of float did not meet the maximum requirement of %f", max)
		}
		return nil
	})
}

// Valid implements the Validator interface to validate the float64 input
func (t *FloatType) Valid(val interface{}) error {
	f, err := cast.ToFloat(val)
	if err != nil {
		return err
	}
	for _, val := range t.validators {
		if err := val(f); err != nil {
			return err
		}
	}
	return nil
}

var _ DataType = &FloatType{}

// timeType is the datatype for time fields
type timeType struct {
	validators []func(time.Time) error
	formatters []func(time.Time) time.Time
}

// Type returns zero-value of time to satisfy the DataType interface
func (t *timeType) Type() interface{} {
	return time.Time{}
}

// PkgPath returns package that should be imported when this datatype is defined
func (t *timeType) PkgPath() string {
	return "time"
}

func (t *timeType) Validate(fn func(time.Time) error) *timeType {
	t.validators = append(t.validators, fn)
	return t
}

func (t *timeType) Formatter(fn func(time.Time) time.Time) *timeType {
	t.formatters = append(t.formatters, fn)
	return t
}

// FutureDate validates that the time is of a date in the future
func (t *timeType) FutureDate() *timeType {
	// this will get lazily re-evaluated at beginning of request so should be fine?
	return t.After(time.Now())
}

// PastDate validates that the time is of a date in the past
func (t *timeType) PastDate() *timeType {
	// this will get lazily re-evaluated at beginning of request so should be fine?
	return t.Before(time.Now())
}

// After validates that the time is after a given time
func (t *timeType) After(after time.Time) *timeType {
	return t.Validate(func(t time.Time) error {
		if t.After(after) {
			return nil
		}
		return fmt.Errorf("time was not after %s", after.Format(time.RFC3339))
	})
}

// Before validates that the time is after a given time
func (t *timeType) Before(after time.Time) *timeType {
	return t.Validate(func(t time.Time) error {
		if t.Before(after) {
			return nil
		}
		return fmt.Errorf("time was not before %s", after.Format(time.RFC3339))
	})
}

// Within validates that the time is within the passed-in duration
// TODO: this may not be the best name
// Used to validate things like within the next 30 days or past 7 days
// Easier to calculate than exact date in the future/past
func (t *timeType) Within(d time.Duration) *timeType {
	return t.Validate(func(t time.Time) error {
		// within 30 days or whatever
		// say something that shoulkd
		now := time.Now()
		expect := now.Add(d)

		// negative time period
		if d < 0 {
			// 3 days ago expectation
			if t.Before(expect) {
				return fmt.Errorf("time is not within expected range %s...%s", expect.Format(time.RFC3339), now.Format(time.RFC3339))
			}
		} else {
			if t.After(expect) {
				return fmt.Errorf("time is not within expected range %s...%s", now.Format(time.RFC3339), expect.Format(time.RFC3339))
			}
		}
		return nil
	})
}

// Round rounds the time up to the nearest multiple of d. See Time.Round for implementation details
func (t *timeType) Round(d time.Duration) *timeType {
	return t.Formatter(func(t time.Time) time.Time {
		return t.Round(d)
	})
}

// Add adds the duration of d to the value of the time. See Time.Add
func (t *timeType) Add(d time.Duration) *timeType {
	return t.Formatter(func(t time.Time) time.Time {
		return t.Add(d)
	})
}

// Truncate rounds the time down to the nearest multiple of d. See Time.Truncate for implementation details
func (t *timeType) Truncate(d time.Duration) *timeType {
	return t.Formatter(func(t time.Time) time.Time {
		return t.Truncate(d)
	})
}

// Valid implements the Validator interface to validate the time input
func (t *timeType) Valid(val interface{}) error {
	tVal := val.(time.Time)
	for _, val := range t.validators {
		if err := val(tVal); err != nil {
			return err
		}
	}
	return nil
}

// Format implements the Formatter interface to format the time input before storing
func (t *timeType) Format(val interface{}) (interface{}, error) {
	tVal := val.(time.Time)
	for _, format := range t.formatters {
		tVal = format(tVal)
	}
	return tVal, nil
}

var _ ImportableDataType = &timeType{}

type jsonType struct {
	formatters []func(interface{}) interface{}
	validators []func(interface{}) error
	base       interface{}
	typ        reflect.Type
}

// Type returns the empty string to satisfy the DataType interface
func (t *jsonType) Type() interface{} {
	return ""
}

// EnforceType enforces that the stored value of the field is the same as the expected type
func (t *jsonType) EnforceType() *jsonType {
	return t.Validate(func(val interface{}) error {
		if t.base == nil {
			return errors.New("don't have a base type to compare against")
		}
		valType := reflect.TypeOf(val)
		if valType != t.typ {
			return fmt.Errorf("type of passed in field %T is not the same as the expected type %T", valType, t.typ)
		}
		return nil
	})
}

// Formatter takes a function that takes the value passed in and re-formats it
// The order in which functions are passed in here should not matter ala the associative property in math
func (t *jsonType) Formatter(fn func(interface{}) interface{}) *jsonType {
	t.formatters = append(t.formatters, fn)
	return t
}

// Validate takes a function that Validates the passed in value
func (t *jsonType) Validate(fn func(interface{}) error) *jsonType {
	t.validators = append(t.validators, fn)
	return t
}

// Format implements the Formatter interface to format the input before storing
// Calls all formatters and then marshals the json field as the last step
func (t *jsonType) Format(val interface{}) (interface{}, error) {
	for _, format := range t.formatters {
		val = format(val)
	}

	// we need to do the json.Marshal step last
	buf, err := json.Marshal(val)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

// Valid implements the Validator interface to validate the input
func (t *jsonType) Valid(val interface{}) error {
	for _, validator := range t.validators {
		if err := validator(val); err != nil {
			return err
		}
	}
	return nil
}

// PkgPath returns package that should be imported when this datatype is defined
func (t *jsonType) PkgPath() string {
	return PkgPath(t.typ)
}

var _ ImportableDataType = &jsonType{}

// PkgPath is a recursive function that's called to get the underlying package that should be included
// to use this type
func PkgPath(typ reflect.Type) string {
	// if we have a value even though slice or something, return that
	// e.g json.RawMessage which is a named alias to []byte
	if typ.PkgPath() != "" {
		return typ.PkgPath()
	}
	// call recursively until we get to a base object
	switch typ.Kind() {
	case reflect.Ptr, reflect.Array, reflect.Slice, reflect.Map:
		// TODO doesn't handle map with non-scalar keys that need imports. Seems like a crazy edge case not worth dealing with yet
		// can provide a hook or have this return multiple strings or something
		return PkgPath(typ.Elem())
	case reflect.Chan:
		panic("trying to store a channel. why??")
	}

	return typ.PkgPath()
}
