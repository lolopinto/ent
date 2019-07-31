package field

import (
	"fmt"
	"go/types"
	"path/filepath"
)

type FieldType interface {
	GetDBType() string
	// for now we're going to assume every GraphQL Type is required
	GetGraphQLType() string
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

type BoolType struct{}

func (t *BoolType) GetDBType() string {
	return "sa.Boolean()"
}

func (t *BoolType) GetGraphQLType() string {
	return "Boolean!"
}

// TODO uuid support needed
// and eventually need to work for non uuid types...
type IdType struct{}

func (t *IdType) GetDBType() string {
	return "UUID()"
}

func (t *IdType) GetGraphQLType() string {
	return "ID!"
}

type IntegerType struct{}

func (t *IntegerType) GetDBType() string {
	return "sa.Integer()"
}

func (t *IntegerType) GetGraphQLType() string {
	return "Int!"
}

type FloatType struct{}

func (t *FloatType) GetDBType() string {
	return "sa.Float()"
}

func (t *FloatType) GetGraphQLType() string {
	return "Float!"
}

type TimeType struct{}

func (t *TimeType) GetDBType() string {
	return "sa.TIMESTAMP()"
}

//use the built in graphql type
func (t *TimeType) GetGraphQLType() string {
	return "Time!"
}

type NamedType struct {
	actualType types.Type
}

func (t *NamedType) getUnderlyingType() FieldType {
	return getTypeForEntType(t.actualType.Underlying())
}

func (t *NamedType) GetDBType() string {
	return t.getUnderlyingType().GetDBType()
}

func (t *NamedType) GetGraphQLType() string {
	return t.getUnderlyingType().GetGraphQLType()
}

func (t *NamedType) GetStructType() string {
	// get the string version of the type and return the filepath
	// we can eventually use this to gather import paths...
	ret := t.actualType.String()
	//	spew.Dump("GetStructType", ret)
	_, fp := filepath.Split(ret)
	//spew.Dump(gg, fp)
	return fp
}

func getTypeForEntType(entType types.Type) FieldType {
	// this needs to eventually handle enums that we want to send to GraphQL

	switch entType.(type) {
	case *types.Basic:
		if t, ok := entType.(*types.Basic); ok {
			switch t.Kind() {
			case types.String:
				return &StringType{}
			case types.Bool:
				return &BoolType{}
			case types.Int, types.Int16, types.Int32, types.Int64:
				return &IntegerType{}
			case types.Float32, types.Float64:
				return &FloatType{}
			}
		}
	case *types.Named:
		//		typ := tt.(*types.Named)

		// TODO figure out all of this. not sure why it's a NamedType in one scenario and a StructType in another
		switch entType.String() {
		case "time.Time":
			return &TimeType{}
		}

		return &NamedType{actualType: entType}
	case *types.Struct:
		switch entType.String() {
		case "time.Time":
			return &TimeType{}
		}
	}

	// fs := getFieldString(f)
	panic(fmt.Errorf("unsupported type %s for now", entType.String()))
}
