package enttype

import (
	"fmt"
	"go/types"
	"strconv"
)

type FieldType interface {
	GetDBType() string
	GetGraphQLType() string
	GetCastToMethod() string // returns the method in cast.go (cast.To***) which casts from interface{} to strongly typed
	GetZeroValue() string
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

type NullableTimeType struct {
	TimeType
}

func (t *NullableTimeType) GetCastToMethod() string {
	return "cast.ToNullableTime"
}

func (t *NullableTimeType) GetGraphQLType() string {
	return "Time"
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
	}
	panic(fmt.Errorf("unsupported type %s for now", typ.String()))
}
