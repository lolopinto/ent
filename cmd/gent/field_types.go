package main

import (
	"fmt"
	"go/types"
	"path/filepath"

	"github.com/davecgh/go-spew/spew"
)

type fieldType interface {
	GetDBType() string
	// for now we're going to assume every GraphQL Type is required
	GetGraphQLType() string
}

type fieldWithOverridenStructType interface {
	GetStructType() string
}

type stringType struct{}

func (t *stringType) GetDBType() string {
	return "sa.Text()"
}

func (t *stringType) GetGraphQLType() string {
	return "String!"
}

type boolType struct{}

func (t *boolType) GetDBType() string {
	return "sa.Boolean()"
}

func (t *boolType) GetGraphQLType() string {
	return "Boolean!"
}

// TODO uuid support needed
// and eventually need to work for non uuid types...
type idType struct{}

func (t *idType) GetDBType() string {
	return "UUID()"
}

func (t *idType) GetGraphQLType() string {
	return "ID!"
}

type integerType struct{}

func (t *integerType) GetDBType() string {
	return "sa.Integer()"
}

func (t *integerType) GetGraphQLType() string {
	return "Int!"
}

type floatType struct{}

func (t *floatType) GetDBType() string {
	return "sa.Float()"
}

func (t *floatType) GetGraphQLType() string {
	return "Float!"
}

type timeType struct{}

func (t *timeType) GetDBType() string {
	return "sa.TIMESTAMP()"
}

//use the built in graphql type
func (t *timeType) GetGraphQLType() string {
	return "Time!"
}

type namedType struct {
	actualType types.Type
}

func (t *namedType) getUnderlyingType() fieldType {
	return getTypeForFieldFtype(t.actualType.Underlying())
}

func (t *namedType) GetDBType() string {
	return t.getUnderlyingType().GetDBType()
}

func (t *namedType) GetGraphQLType() string {
	return t.getUnderlyingType().GetGraphQLType()
}

func (t *namedType) GetStructType() string {
	// get the string version of the type and return the filepath
	// we can eventually use this to gather import paths...
	ret := t.actualType.String()
	spew.Dump("GetStructType", ret)
	gg, fp := filepath.Split(ret)
	spew.Dump(gg, fp)
	return fp
}

func getTypeForField(f *fieldInfo) fieldType {
	// fixed graphql but broke ent because it has string instead of ent.NodeType
	// need to fix this next so it handles the underlying types and handles
	// the different contexts correctly.
	// and it needs to eventually handle enums that we do want to send to GraphQL
	return getTypeForFieldFtype(f.FieldType)
}

func getTypeForFieldFtype(tt types.Type) fieldType {
	switch tt.(type) {
	case *types.Basic:
		if t, ok := tt.(*types.Basic); ok {
			switch t.Kind() {
			case types.String:
				return &stringType{}
			case types.Bool:
				return &boolType{}
			case types.Int, types.Int16, types.Int32, types.Int64:
				return &integerType{}
			case types.Float32, types.Float64:
				return &floatType{}
			}
		}
	case *types.Named:
		//		typ := tt.(*types.Named)

		// TODO figure out all of this. not sure why it's a NamedType in one scenario and a StructType in another
		switch tt.String() {
		case "time.Time":
			return &timeType{}
		}

		return &namedType{actualType: tt}
	case *types.Struct:
		switch tt.String() {
		case "time.Time":
			return &timeType{}
		}
	}

	// fs := getFieldString(f)
	panic(fmt.Errorf("unsupported type %s for now", tt.String()))
}

func getDbTypeForField(f *fieldInfo) string {
	return getTypeForField(f).GetDBType()
}

func getGraphQLTypeForField(f *fieldInfo) string {
	return getTypeForField(f).GetGraphQLType()
}
