package enttype

import (
	"fmt"
	"github.com/davecgh/go-spew/spew"
	"go/types"
	"path/filepath"
	"strconv"
)

// NOTE: a lot of the tests for this file are in internal/field/field_test.go

type FieldType interface {
	GetDBType() string
	GetGraphQLType() string
	GetCastToMethod() string // returns the method in cast.go (cast.To***) which casts from interface{} to strongly typed
	GetZeroValue() string
}

type NullableFieldType interface {
	GetNullableType() FieldType
}

type FieldWithOverridenStructType interface {
	GetStructType() string
}

type FieldWithUnderlyingType interface {
	GetUnderlyingType() types.Type
	getTypeName() string
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

func (t *StringType) GetNullableType() FieldType {
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

func (t *BoolType) GetNullableType() FieldType {
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

func (t *IDType) GetNullableType() FieldType {
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

func (t *IntegerType) GetNullableType() FieldType {
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

func (t *FloatType) GetNullableType() FieldType {
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

func (t *TimeType) GetNullableType() FieldType {
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

type fieldWithUnderlyingType struct {
	actualType types.Type
	FieldWithUnderlyingType
}

func (t *fieldWithUnderlyingType) GetUnderlyingType() types.Type {
	return t.actualType
}

func (t *fieldWithUnderlyingType) getUnderlyingType() FieldType {
	return GetType(t.actualType.Underlying())
}

func (t *fieldWithUnderlyingType) GetDBType() string {
	return t.getUnderlyingType().GetDBType()
}

func (t *fieldWithUnderlyingType) GetGraphQLType() string {
	return t.getUnderlyingType().GetGraphQLType()
}

func (t *fieldWithUnderlyingType) GetCastToMethod() string {
	panic(fmt.Errorf("GetCastToMethod of %s not implemented yet!", t.getTypeName()))
}

func (t *fieldWithUnderlyingType) GetZeroValue() string {
	panic(fmt.Errorf("GetZeroValue of %s not implemented yet!", t.getTypeName()))
}

func (t *fieldWithUnderlyingType) GetStructType() string {
	// get the string version of the type and return the filepath
	// we can eventually use this to gather import paths...
	// This converts something like "github.com/lolopinto/ent/ent.NodeType" to "ent.NodeType"
	ret := t.actualType.String()
	_, fp := filepath.Split(ret)
	return fp
}

type NamedType struct {
	fieldWithUnderlyingType
}

func (t *NamedType) getTypeName() string {
	return "NamedType"
}

type PointerType struct {
	fieldWithUnderlyingType
}

func (t *PointerType) getTypeName() string {
	return "PointerType"
}

type InterfaceType struct {
	typ *types.Interface
}

func (t *InterfaceType) getTypeName() string {
	return "InterfaceType"
}

// TODO make this easier for not implemented yet contexts...
func (t *InterfaceType) GetDBType() string {
	panic("GetDBType of InterfaceType not implemented yet!")
}

func (t *InterfaceType) GetGraphQLType() string {
	panic("GetGraphQLType of InterfaceType not implemented yet!")
}

func (t *InterfaceType) GetCastToMethod() string {
	panic("GetCastToMethod of InterfaceType not implemented yet!")
}

func (t *InterfaceType) GetZeroValue() string {
	panic("GetZeroValue of InterfaceType not implemented yet!")
}

func GetType(typ types.Type) FieldType {
	switch types.TypeString(typ, nil) {
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
		switch typ2 := typ.(type) {
		case *types.Named:
			t := &NamedType{}
			t.actualType = typ
			return t
		case *types.Pointer:
			t := &PointerType{}
			t.actualType = typ
			return t

		case *types.Interface:
			spew.Dump("interface type...", typ2)
			return &InterfaceType{typ2}
		}
	}
	panic(fmt.Errorf("unsupported type %s %T for now", typ.String(), typ))
}

// GetNullableType takes a type where the nullable-ness is not encoded in the type but alas
// somewhere else so we need to get the nullable type from a different place
func GetNullableType(typ types.Type, nullable bool) FieldType {
	fieldType := GetType(typ)
	if !nullable {
		return fieldType
	}
	nullableType, ok := fieldType.(NullableFieldType)
	if ok {
		return nullableType.GetNullableType()
	}
	panic(fmt.Errorf("couldn't find nullable version of type %s", types.TypeString(typ, nil)))
}

func IsErrorType(typ FieldType) bool {
	// This is all not great but working on figuring out all of this....
	namedType, ok := typ.(*NamedType)
	if ok {
		return namedType.actualType.String() == "error"
	}
	intType, ok2 := typ.(*InterfaceType)
	if ok2 {
		return intType.typ.NumMethods() == 1 && intType.typ.Method(0).Name() == "Error"
	}
	return false
}

func IsContextType(typ FieldType) bool {
	namedType, ok := typ.(*NamedType)
	if !ok {
		return false
	}
	return namedType.actualType.String() == "context.Context"
}
