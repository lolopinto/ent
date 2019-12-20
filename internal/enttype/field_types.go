package enttype

import (
	"fmt"
	"go/types"
	"path/filepath"
	"strconv"
	"strings"
)

// NOTE: a lot of the tests for this file are in internal/field/field_test.go

// Type represents a Type that's expressed in the framework
// The only initial requirement is GraphQL since that's exposed everywhere
type Type interface {
	GetGraphQLType() string
}

// EntType interface is for fields exposed to Ents (stored in the DB) etc
type EntType interface {
	Type
	GetDBType() string
	GetCastToMethod() string // returns the method in cast.go (cast.To***) which casts from interface{} to strongly typed
	GetZeroValue() string
}

// NullableType refers to a Type that has the nullable version of the same type
type NullableType interface {
	Type
	GetNullableType() Type
}

type FieldWithOverridenStructType interface {
	GetStructType() string
}

type StringType struct{}

func (t *StringType) GetDBType() string {
	return "sa.Text()"
}

func (t *StringType) GetGraphQLType() string {
	return "String!"
}

func (t *StringType) GetCastToMethod() string {
	return "cast.ToString"
}

func (t *StringType) GetZeroValue() string {
	return strconv.Quote("")
}

func (t *StringType) GetNullableType() Type {
	return &NullableStringType{}
}

type NullableStringType struct {
	StringType
}

func (t *NullableStringType) GetGraphQLType() string {
	return "String"
}

func (t *NullableStringType) GetCastToMethod() string {
	return "cast.ToNullableString"
}

type BoolType struct{}

func (t *BoolType) GetDBType() string {
	return "sa.Boolean()"
}

func (t *BoolType) GetGraphQLType() string {
	return "Boolean!"
}

func (t *BoolType) GetCastToMethod() string {
	return "cast.ToBool"
}

func (t *BoolType) GetZeroValue() string {
	return "false"
}

func (t *BoolType) GetNullableType() Type {
	return &NullableBoolType{}
}

type NullableBoolType struct {
	BoolType
}

func (t *NullableBoolType) GetGraphQLType() string {
	return "Boolean"
}

func (t *NullableBoolType) GetCastToMethod() string {
	return "cast.ToNullableBool"
}

// TODO uuid support needed
// and eventually need to work for non uuid types...
type IDType struct{}

func (t *IDType) GetDBType() string {
	return "UUID()"
}

func (t *IDType) GetGraphQLType() string {
	return "ID!"
}

func (t *IDType) GetCastToMethod() string {
	return "cast.ToUUIDString"
}

func (t *IDType) GetZeroValue() string {
	return ""
}

func (t *IDType) GetNullableType() Type {
	return &NullableIDType{}
}

type NullableIDType struct {
	IDType
}

func (t *NullableIDType) GetGraphQLType() string {
	return "ID"
}

func (t *NullableIDType) GetCastToMethod() string {
	return "cast.ToNullableUUIDString"
}

type IntegerType struct{}

func (t *IntegerType) GetDBType() string {
	return "sa.Integer()"
}

func (t *IntegerType) GetGraphQLType() string {
	return "Int!"
}

func (t *IntegerType) GetCastToMethod() string {
	return "cast.ToInt"
}

func (t *IntegerType) GetZeroValue() string {
	return "0"
}

func (t *IntegerType) GetNullableType() Type {
	return &NullableIntegerType{}
}

type NullableIntegerType struct {
	IntegerType
}

func (t *NullableIntegerType) GetGraphQLType() string {
	return "Int"
}

func (t *NullableIntegerType) GetCastToMethod() string {
	return "cast.ToNullableInt"
}

type FloatType struct{}

func (t *FloatType) GetDBType() string {
	return "sa.Float()"
}

func (t *FloatType) GetGraphQLType() string {
	return "Float!"
}

func (t *FloatType) GetCastToMethod() string {
	return "cast.ToFloat"
}

func (t *FloatType) GetZeroValue() string {
	return "0.0"
}

func (t *FloatType) GetNullableType() Type {
	return &NullableFloatType{}
}

type NullableFloatType struct {
	FloatType
}

func (t *NullableFloatType) GetGraphQLType() string {
	return "Float"
}

func (t *NullableFloatType) GetCastToMethod() string {
	return "cast.ToNullableFloat"
}

type TimeType struct{}

func (t *TimeType) GetDBType() string {
	return "sa.TIMESTAMP()"
}

//use the built in graphql type
func (t *TimeType) GetGraphQLType() string {
	return "Time!"
}

func (t *TimeType) GetCastToMethod() string {
	return "cast.ToTime"
}

func (t *TimeType) GetZeroValue() string {
	return "time.Time{}"
}

func (t *TimeType) GetNullableType() Type {
	return &NullableTimeType{}
}

type NullableTimeType struct {
	TimeType
}

func (t *NullableTimeType) GetCastToMethod() string {
	return "cast.ToNullableTime"
}

func (t *NullableTimeType) GetGraphQLType() string {
	return "Time"
}

type fActualType interface {
	getTypeName() string
}

type fieldWithActualType struct {
	fActualType
	actualType types.Type
	//	pathMap    map[string]string
}

func (t *fieldWithActualType) GetGraphQLType() string {
	goPath := t.actualType.String()

	var slice, nullable bool
	if strings.HasPrefix(goPath, "[]") {
		slice = true
		goPath = strings.TrimPrefix(goPath, "[]")
	}
	if strings.HasPrefix(goPath, "*") {
		nullable = true
		goPath = strings.TrimPrefix(goPath, "*")
	}

	// TODO correct mappings is better...
	//graphQLType, ok := t.pathMap[goPath]

	_, fp := filepath.Split(goPath)
	parts := strings.Split(fp, ".")
	graphQLType := parts[1]

	if !nullable {
		graphQLType = graphQLType + "!"
	}
	if slice {
		graphQLType = "[" + graphQLType + "]"
	}

	return graphQLType
	//	panic(fmt.Errorf("couldn't find graphql type for %s", goPath))
}

func (t *fieldWithActualType) GetStructType() string {
	// get the string version of the type and return the filepath
	// This converts something like "github.com/lolopinto/ent/ent.NodeType" to "ent.NodeType"
	ret := t.actualType.String()
	_, fp := filepath.Split(ret)
	return fp
}

type NamedType struct {
	fieldWithActualType
}

func (t *NamedType) getTypeName() string {
	return "NamedType"
}

type PointerType struct {
	fieldWithActualType
}

func (t *PointerType) getTypeName() string {
	return "PointerType"
}

type SliceType struct {
	fieldWithActualType
}

func (t *SliceType) getTypeName() string {
	return "SliceType"
}

func getBasicType(typ types.Type) Type {
	typeStr := types.TypeString(typ, nil)
	switch typeStr {
	case "string":
		return &StringType{}
	case "*string":
		return &NullableStringType{}
	case "bool":
		return &BoolType{}
	case "*bool":
		return &NullableBoolType{}
	case "int", "int16", "int32", "int64":
		return &IntegerType{}
	case "*int", "*int16", "*int32", "*int64":
		return &NullableIntegerType{}
	case "float32", "float64":
		return &FloatType{}
	case "*float32", "*float64":
		return &NullableFloatType{}
	case "time.Time":
		return &TimeType{}
	case "*time.Time":
		return &NullableTimeType{}
	default:
		return nil
	}
}

func GetType(typ types.Type) Type {
	if ret := getBasicType(typ); ret != nil {
		return ret
	}
	switch typ2 := typ.(type) {
	case *types.Basic:
		panic("unsupported basic type")
	case *types.Named:

		// if the underlying type is a basic type, let that go through for now
		// ent.NodeType etc
		if basicType := getBasicType(typ2.Underlying()); basicType != nil {
			return basicType
		}
		// context.Context, error, etc
		t := &NamedType{}
		t.actualType = typ
		return t
	case *types.Pointer:
		// e.g. *github.com/lolopinto/ent/internal/test_schema/models.User
		t := &PointerType{}
		t.actualType = typ2
		return t

	case *types.Interface:
		panic("todo interface unsupported for now")

	case *types.Struct:
		panic("todo struct unsupported for now")

	case *types.Chan:
		panic("todo chan unsupported for now")

	case *types.Map:
		panic("todo map unsupported for now")

	case *types.Signature:
		panic("todo signature unsupported for now")

	case *types.Tuple:
		panic("todo tuple unsupported for now")

	case *types.Slice, *types.Array:
		// e.g. []*github.com/lolopinto/ent/internal/test_schema/models.User
		t := &SliceType{}
		t.actualType = typ2
		return t

	default:
		panic(fmt.Errorf("unsupported type %s for now", typ2.String()))
	}
}

// GetNullableType takes a type where the nullable-ness is not encoded in the type but alas
// somewhere else so we need to get the nullable type from a different place
func GetNullableType(typ types.Type, nullable bool) Type {
	fieldType := GetType(typ)
	if !nullable {
		return fieldType
	}
	nullableType, ok := fieldType.(NullableType)
	if ok {
		return nullableType.GetNullableType()
	}
	panic(fmt.Errorf("couldn't find nullable version of type %s", types.TypeString(typ, nil)))
}

func IsErrorType(typ Type) bool {
	namedType, ok := typ.(*NamedType)
	if ok {
		return namedType.actualType.String() == "error"
	}
	return false
}

func IsContextType(typ Type) bool {
	namedType, ok := typ.(*NamedType)
	if !ok {
		return false
	}
	return namedType.actualType.String() == "context.Context"
}
