package field

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
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
func Time() *TimeType {
	return &TimeType{}
}

// TODO Ints, Floats, Strings, Enum, Map, complex objects
// come back for that

// DataType interface represents a piece of datum stored in any field
// in any of the nodes in the graph
type DataType interface {

	// Type method is used to determine the underlying type of the data
	// that's stored here. Implementors should return the zero-value of the
	// type stored here.
	// We currently use static-analysis to infer the type based on what's returned here.
	Type() interface{}
}

// ImportableDataType interface represents data that need to import a package to
// be referenced
// e.g. "time" for time datatype
type ImportableDataType interface {
	DataType
	// PackagePath returns package that should be imported when this datatype is
	PackagePath() string
}

// StringType is the datatype for string fields
type StringType struct {
	validators []func(string) error
	processors []func(string) string
}

// Type returns the empty string to satisfy the DataType interface
func (t *StringType) Type() interface{} {
	return ""
}

// NotEmpty ensures that the string is not empty
func (t *StringType) NotEmpty() *StringType {
	return t.Validate(func(s string) error {
		if len(s) == 0 {
			return errors.New("not empty")
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

// ToLower returns string with all Unicode letters mapped to their lower case.
func (t *StringType) ToLower() *StringType {
	return t.Process(func(s string) string {
		return strings.ToLower(s)
	})
}

// Validate takes a function that Validates the value of the string
func (t *StringType) Validate(fn func(string) error) *StringType {
	t.validators = append(t.validators, fn)
	return t
}

// Process takes a function that takes the value of the string and re-formats it
func (t *StringType) Process(fn func(string) string) *StringType {
	t.processors = append(t.processors, fn)
	return t
}

var _ DataType = &StringType{}

// IntegerType is the datatype for int fields
type IntegerType struct {
}

// Type returns 0 to satisfy the DataType interface
func (t *IntegerType) Type() interface{} {
	return 0
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
type FloatType struct{}

// Type returns 0.0 to satisfy the DataType interface
func (t *FloatType) Type() interface{} {
	return 0.0
}

var _ DataType = &FloatType{}

// TimeType is the datatype for time fields
type TimeType struct{}

// Type returns zero-value of time to satisfy the DataType interface
func (t *TimeType) Type() interface{} {
	return time.Time{}
}

// PackagePath returns package that should be imported when this datatype is defined
func (t *TimeType) PackagePath() string {
	return "time"
}

var _ ImportableDataType = &TimeType{}

// Field represents a field that's available on an ent
// Field exists separate from DataType to store information that's common
// across different datatypes and to make it easy to add new datatypes that
// don't have to be bothered with these details.
// The API here is also good for static analysis, which is the current way the
// information is parsed and ingested
type Field struct {
	dataType        DataType
	nullable        bool
	serverDefault   interface{}
	db              string
	graphQL         string
	unique          bool
	hideFromGraphQL bool
	index           bool
	fkeyConfig      string
	fkeyField       string
}

// Option is a function that takes a Field and modifies it in any way.
// Provides a consistent public API to modify Field as needed
type Option func(*Field)

// Nullable option indicates that a field can be set to nil.
// Adds NULL to the db and also generates a pointer in the struct
func Nullable() Option {
	return func(f *Field) {
		f.nullable = true
	}
}

// ServerDefault sets the default value of a field. This is stored in the DB
// and should be a static value
// This is different from Default and UpdateDefault that may be present on some DataTypes
// and is determined at run time
func ServerDefault(val interface{}) Option {
	return func(f *Field) {
		f.serverDefault = val
	}
}

// Unique indicates that each value of a datatype within a table/underlying storage should be unique
// creates a unique index on the column in the table
func Unique() Option {
	return func(f *Field) {
		f.unique = true
	}
}

// HideFromGraphQL does not expose this Field to GraphQL
func HideFromGraphQL() Option {
	return func(f *Field) {
		f.hideFromGraphQL = true
	}
}

// DB overrides the default name of the column generated for this field in the db
// Provides a way to change the name of an existing field and keep the underlying db columne the same
func DB(name string) Option {
	return func(f *Field) {
		f.db = name
	}
}

// GraphQL overrides the default name of the field generated for GraphQL
// Provides a way to change the name of an existing field and keep the existing graphQL API the same
func GraphQL(name string) Option {
	return func(f *Field) {
		f.graphQL = name
	}
}

// Index adds an index to this column in the db
func Index() Option {
	return func(f *Field) {
		f.index = true
	}
}

// ForeignKey adds a foreignkey index on a separate Node/field combo
func ForeignKey(configName, fieldName string) Option {
	return func(f *Field) {
		f.fkeyConfig = configName
		f.fkeyField = fieldName
	}
}

// F takes a datatype and 0 or more options and configures the Field
// usage is as follows:
//
//  func (config *UserConfig) GetFields() ent.FieldMap {
//	  return ent.FieldMap {
//	  	"FirstName": field.F(
//	 	 		field.String(),
// 	  	),
// 			"EmailAddress": field.F(
//				field.String(),
//				field.Unique(),
//				field.DB("email"),
//      ),
//  	},
//  }
//
func F(d DataType, opts ...Option) Field {
	f := Field{dataType: d}
	for _, opt := range opts {
		opt(&f)
	}
	return f
}
