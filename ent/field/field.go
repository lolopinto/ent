package field

import (
	"fmt"

	"github.com/iancoleman/strcase"
)

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
	private         bool
	index           bool
	fkeyConfig      string
	fkeyField       string
	fieldEdgeConfig string
	fieldEdgeName   string
}

func (f *Field) Valid(name string, val interface{}) error {
	if val == nil {
		// nothing to do here
		if f.nullable {
			return nil
		}
		return fmt.Errorf("got a nil value for non-nillable field %s", name)
	}
	// TODO allow-blank check to skip validators
	// if allow blank or optional or whatever we end up calling this,
	// we allow this come through if the value is equal to the blank value
	if false && val == f.dataType.Type() {
		return nil
	}

	validator, ok := f.dataType.(Validator)
	if !ok {
		return nil
	}
	return validator.Valid(val)
}

func (f *Field) Format(val interface{}) (interface{}, error) {
	// can't format a nil value so nothing to do here.
	// Valid() will handle it as needed
	if val == nil {
		return val, nil
	}
	formatter, ok := f.dataType.(Formatter)
	if !ok {
		return val, nil
	}
	return formatter.Format(val)
}

func (f *Field) DBKey(fieldName string) string {
	if f.db != "" {
		return f.db
	}
	// this API doesn't seem as fun here...
	return strcase.ToSnake(fieldName)
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

// Private does not expose this Field outside the package
// It *also* automatically hides this from GraphQL.
// It *also* automatically doesn't expose this to actions by default except when an action explicitly includes that field
// Had to choose a default and we're choosing this default. The assumption is that
// any field that's private doesn't get default behavior and it's up to the developer to
// explicitly override this
func Private() Option {
	return func(f *Field) {
		f.private = true
		f.hideFromGraphQL = true
		// bonus: should eventually show an error if GraphQL() also called
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

// FieldEdge specifies that this field maps to an edge on a separate Node/edge combo
// when this field is written to, the corresponding edge is also written to
func FieldEdge(configName, edgeName string) Option {
	return func(f *Field) {
		f.fieldEdgeConfig = configName
		f.fieldEdgeName = edgeName
	}
}

// F takes a datatype and 0 or more options and configures the Field
// usage is as follows:
//
//  func (config *UserConfig) GetFields() ent.FieldMap {
//	  return ent.FieldMap {
//	  	"FirstName": field.F(
//	 	 		field.StringType(),
// 	  	),
// 			"EmailAddress": field.F(
//				field.StringType(),
//				field.Unique(),
//				field.DB("email"),
//      ),
//  	},
//  }
//
func F(d DataType, opts ...Option) *Field {
	f := &Field{dataType: d}
	for _, opt := range opts {
		opt(f)
	}
	return f
}
