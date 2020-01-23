package enttype

import (
	"fmt"
	"go/types"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
)

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

type ListType interface {
	Type
	GetElemGraphQLType() string
}

// NullableType refers to a Type that has the nullable version of the same type
type NullableType interface {
	Type
	GetNullableType() Type
}

type NonNullableType interface {
	Type
	GetNonNullableType() Type
}

type DefaulFieldNameType interface {
	DefaultGraphQLFieldName() string
}

type stringType struct {
	underlyingType types.Type
}

func (t *stringType) GetDBType() string {
	return "sa.Text()"
}

// hmm we don't use these for the nullable types right now. unclear if right thing...
func (t *stringType) GetZeroValue() string {
	return strconv.Quote("")
}

type StringType struct {
	stringType
}

func (t *StringType) GetGraphQLType() string {
	return "String!"
}

func (t *StringType) GetCastToMethod() string {
	return "cast.ToString"
}

func (t *StringType) GetNullableType() Type {
	return &NullableStringType{}
}

type NullableStringType struct {
	stringType
}

func (t *NullableStringType) GetGraphQLType() string {
	return "String"
}

func (t *NullableStringType) GetCastToMethod() string {
	return "cast.ToNullableString"
}

func (t *NullableStringType) GetNonNullableType() Type {
	return &StringType{}
}

type boolType struct{}

func (t *boolType) GetDBType() string {
	return "sa.Boolean()"
}

func (t *boolType) GetZeroValue() string {
	return "false"
}

type BoolType struct {
	boolType
}

func (t *BoolType) GetGraphQLType() string {
	return "Boolean!"
}

func (t *BoolType) GetCastToMethod() string {
	return "cast.ToBool"
}

func (t *BoolType) GetNullableType() Type {
	return &NullableBoolType{}
}

type NullableBoolType struct {
	boolType
}

func (t *NullableBoolType) GetGraphQLType() string {
	return "Boolean"
}

func (t *NullableBoolType) GetCastToMethod() string {
	return "cast.ToNullableBool"
}

func (t *NullableBoolType) GetNonNullableType() Type {
	return &BoolType{}
}

// TODO uuid support needed
// and eventually need to work for non uuid types...

type idType struct{}

func (t *idType) GetDBType() string {
	return "UUID()"
}

func (t *idType) GetZeroValue() string {
	return ""
}

type IDType struct {
	idType
}

func (t *IDType) GetGraphQLType() string {
	return "ID!"
}

func (t *IDType) GetCastToMethod() string {
	return "cast.ToUUIDString"
}

func (t *IDType) GetNullableType() Type {
	return &NullableIDType{}
}

type NullableIDType struct {
	idType
}

func (t *NullableIDType) GetGraphQLType() string {
	return "ID"
}

func (t *NullableIDType) GetCastToMethod() string {
	return "cast.ToNullableUUIDString"
}

func (t *NullableIDType) GetNonNullableType() Type {
	return &IDType{}
}

type intType struct{}

func (t *intType) GetDBType() string {
	return "sa.Integer()"
}
func (t *intType) GetZeroValue() string {
	return "0"
}

type IntegerType struct {
	intType
}

func (t *IntegerType) GetGraphQLType() string {
	return "Int!"
}

func (t *IntegerType) GetCastToMethod() string {
	return "cast.ToInt"
}

func (t *IntegerType) GetNullableType() Type {
	return &NullableIntegerType{}
}

type NullableIntegerType struct {
	intType
}

func (t *NullableIntegerType) GetGraphQLType() string {
	return "Int"
}

func (t *NullableIntegerType) GetCastToMethod() string {
	return "cast.ToNullableInt"
}

func (t *NullableIntegerType) GetNonNullableType() Type {
	return &IntegerType{}
}

type floatType struct{}

func (t *floatType) GetDBType() string {
	return "sa.Float()"
}

func (t *floatType) GetZeroValue() string {
	return "0.0"
}

type FloatType struct {
	floatType
}

func (t *FloatType) GetGraphQLType() string {
	return "Float!"
}

func (t *FloatType) GetCastToMethod() string {
	return "cast.ToFloat"
}

func (t *FloatType) GetNullableType() Type {
	return &NullableFloatType{}
}

type NullableFloatType struct {
	floatType
}

func (t *NullableFloatType) GetGraphQLType() string {
	return "Float"
}

func (t *NullableFloatType) GetCastToMethod() string {
	return "cast.ToNullableFloat"
}

func (t *NullableFloatType) GetNonNullableType() Type {
	return &FloatType{}
}

type timeType struct{}

func (t *timeType) GetDBType() string {
	return "sa.TIMESTAMP()"
}

func (t *timeType) GetZeroValue() string {
	return "time.Time{}"
}

func (t *timeType) DefaultGraphQLFieldName() string {
	return "time"
}

type TimeType struct {
	timeType
}

// use the built in graphql type
func (t *TimeType) GetGraphQLType() string {
	return "Time!"
}

func (t *TimeType) GetCastToMethod() string {
	return "cast.ToTime"
}

func (t *TimeType) GetNullableType() Type {
	return &NullableTimeType{}
}

type NullableTimeType struct {
	timeType
}

func (t *NullableTimeType) GetCastToMethod() string {
	return "cast.ToNullableTime"
}

func (t *NullableTimeType) GetGraphQLType() string {
	return "Time"
}

func (t *NullableTimeType) GetNonNullableType() Type {
	return &TimeType{}
}

type typeConfig struct {
	forceNullable    bool
	forceNonNullable bool
}

func forceNullable() func(*typeConfig) {
	return func(cfg *typeConfig) {
		cfg.forceNullable = true
	}
}

func forceNonNullable() func(*typeConfig) {
	return func(cfg *typeConfig) {
		cfg.forceNonNullable = true
	}
}

func getGraphQLType(typ types.Type, opts ...func(*typeConfig)) string {
	// handle string, *string and other "basic types" etc
	if basicType := getBasicType(typ); basicType != nil {
		return basicType.GetGraphQLType()
	}

	var nullable bool
	var graphQLType string
	typeStr := typ.String()
	if strings.HasPrefix(typeStr, "*") {
		nullable = true
		typeStr = strings.TrimPrefix(typeStr, "*")
	}
	cfg := &typeConfig{}
	for _, opt := range opts {
		opt(cfg)
	}
	// TODO support this for basic types...
	if cfg.forceNullable && cfg.forceNonNullable {
		panic("cannot force nullable and non-nullable at the same time")
	}
	if cfg.forceNullable {
		nullable = true
	}
	if cfg.forceNonNullable {
		nullable = false
	}

	_, fp := filepath.Split(typeStr)
	parts := strings.Split(fp, ".")
	if len(parts) != 2 {
		panic(fmt.Errorf("invalid type string. expected a complex type of the form package.Type got %s instead", typeStr))
	}
	graphQLType = parts[1]

	// TODO correct mappings is better...
	//graphQLType, ok := t.pathMap[goPath]

	if !nullable {
		graphQLType = graphQLType + "!"
	}

	return graphQLType
	//	panic(fmt.Errorf("couldn't find graphql type for %s", goPath))
}

func getSliceGraphQLType(typ, elemType types.Type) string {
	graphQLType := "[" + getGraphQLType(elemType) + "]"
	// not nullable
	if strings.HasPrefix(typ.String(), "*") {
		return graphQLType
	}
	return graphQLType + "!"
}

func getDefaultGraphQLFieldName(typ types.Type) string {
	typeStr := typ.String()

	_, fp := filepath.Split(typeStr)
	parts := strings.Split(fp, ".")
	if len(parts) != 2 {
		return ""
	}
	return strcase.ToLowerCamel(parts[1])
}

func getDefaultSliceGraphQLFieldName(typ types.Type) string {
	return inflection.Plural(getDefaultGraphQLFieldName(typ))
}

// hmm do I still need this?
type fieldWithActualType struct {
	actualType       types.Type
	forceNullable    bool
	forceNonNullable bool
	//	pathMap    map[string]string
}

func (t *fieldWithActualType) GetGraphQLType() string {
	var opts []func(*typeConfig)
	if t.forceNullable {
		opts = append(opts, forceNullable())
	}
	if t.forceNonNullable {
		opts = append(opts, forceNonNullable())
	}
	return getGraphQLType(t.actualType, opts...)
}

func (t *fieldWithActualType) DefaultGraphQLFieldName() string {
	return getDefaultGraphQLFieldName(t.actualType)
}

func (t *fieldWithActualType) getNullableType() fieldWithActualType {
	return fieldWithActualType{
		actualType:    t.actualType,
		forceNullable: true,
	}
}

func (t *fieldWithActualType) getNonNullableType() fieldWithActualType {
	return fieldWithActualType{
		actualType:       t.actualType,
		forceNonNullable: true,
	}
}

type NamedType struct {
	fieldWithActualType
	jsonTypeImpl
}

func (t *NamedType) GetZeroValue() string {
	if types.IsInterface(t.actualType) {
		return "nil"
	}
	str := GetGoType(t.actualType)
	// remove leading *
	if str[0] == '*' {
		str = str[1:]
	}
	// This doesn't guarantee a fully functioning zero value because no constructor being called
	return str + "{}"
}

func (t *NamedType) GetNullableType() Type {
	return &NamedType{fieldWithActualType: t.getNullableType()}
}

func (t *NamedType) GetNonNullableType() Type {
	return &NamedType{fieldWithActualType: t.getNonNullableType()}
}

func newFieldWithActualType(typ types.Type, forceNullable, forceNonNullable bool) *fieldWithActualType {
	return &fieldWithActualType{
		actualType:       typ,
		forceNullable:    forceNullable,
		forceNonNullable: forceNonNullable,
	}
}

func NewNamedType(typ types.Type, forceNullable, forceNonNullable bool) *NamedType {
	return &NamedType{
		fieldWithActualType: fieldWithActualType{
			actualType:       typ,
			forceNullable:    forceNullable,
			forceNonNullable: forceNonNullable,
		},
	}
}

func NewPointerType(typ types.Type, forceNullable, forceNonNullable bool) *PointerType {
	ptrType := typ.(*types.Pointer)
	return &PointerType{
		ptrType: ptrType,
		fieldWithActualType: fieldWithActualType{
			actualType:       typ,
			forceNullable:    forceNullable,
			forceNonNullable: forceNonNullable,
		},
	}
}

type PointerType struct {
	ptrType *types.Pointer
	fieldWithActualType
	jsonTypeImpl
}

func (t *PointerType) GetNullableType() Type {
	return &PointerType{
		ptrType:             t.ptrType,
		fieldWithActualType: t.getNullableType(),
	}
}

func (t *PointerType) GetNonNullableType() Type {
	return &PointerType{
		ptrType:             t.ptrType,
		fieldWithActualType: t.getNonNullableType(),
	}
}

func (t *PointerType) GetGraphQLType() string {
	// get type of base element
	typ := GetType(t.ptrType.Elem())

	graphqlType := typ.GetGraphQLType()

	if t.forceNullable || !t.forceNonNullable {
		// pointer type and named type should return different versions of themselves?
		return strings.TrimSuffix(graphqlType, "!")
	}
	return graphqlType
}

func (t *PointerType) DefaultGraphQLFieldName() string {
	switch t.ptrType.Elem().(type) {
	case *types.Array, *types.Slice:
		return getDefaultSliceGraphQLFieldName(t.actualType)
	}
	return getDefaultGraphQLFieldName(t.actualType)
}

type jsonTypeImpl struct {
}

// json fields are stored as strings in the db
func (t *jsonTypeImpl) GetDBType() string {
	return "sa.Text()"
}

func (t *jsonTypeImpl) GetZeroValue() string {
	return "nil"
}

// TODO we need something better here that indicates we're going to need to json.Unmarshall this...
func (t *jsonTypeImpl) GetCastToMethod() string {
	return ""
}

type SliceType struct {
	typ *types.Slice
	jsonTypeImpl
}

func (t *SliceType) GetGraphQLType() string {
	return getSliceGraphQLType(t.typ, t.typ.Elem())
}

func (t *SliceType) DefaultGraphQLFieldName() string {
	return getDefaultSliceGraphQLFieldName(t.typ.Elem())
}

func (t *SliceType) GetElemGraphQLType() string {
	return getGraphQLType(t.typ.Elem())
}

func NewSliceType(typ *types.Slice) *SliceType {
	return &SliceType{typ: typ}
}

type ArrayType struct {
	typ *types.Array
	jsonTypeImpl
}

func (t *ArrayType) GetGraphQLType() string {
	return getSliceGraphQLType(t.typ, t.typ.Elem())
}

func (t *ArrayType) GetElemGraphQLType() string {
	return getGraphQLType(t.typ.Elem())
}

func (t *ArrayType) DefaultGraphQLFieldName() string {
	return getDefaultSliceGraphQLFieldName(t.typ.Elem())
}

type MapType struct {
	typ *types.Map
	jsonTypeImpl
}

func (t *MapType) GetGraphQLType() string {
	return "Map" // this is fine for now
	// TODO nullable vs not. it's a map which can be nil.
	// this is sadly not consistent with behavior of slices
	// TODO: need to add Map scalar to schema.graphql if we encounter this
	// TODO need to convert to/from map[string]interface{} to return in gql
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
		t.ptrType = typ2
		t.actualType = typ2
		return t

	case *types.Interface:
		panic("todo interface unsupported for now")

	case *types.Struct:
		panic("todo struct unsupported for now")

	case *types.Chan:
		panic("todo chan unsupported for now")

	case *types.Map:
		t := &MapType{}
		t.typ = typ2
		return t

	case *types.Signature:
		panic("todo signature unsupported for now")

	case *types.Tuple:
		panic("todo tuple unsupported for now")

	case *types.Slice:
		return &SliceType{typ: typ2}

	case *types.Array:
		return &ArrayType{typ: typ2}

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

func GetNonNullableType(typ types.Type, forceRequired bool) Type {
	fieldType := GetType(typ)
	if !forceRequired {
		return fieldType
	}
	nonNullableType, ok := fieldType.(NonNullableType)
	if ok {
		return nonNullableType.GetNonNullableType()
	}
	panic(fmt.Errorf("couldn't find non-nullable version of type %s", types.TypeString(typ, nil)))
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

func IsNullType(typ Type) bool {
	_, ok := typ.(*PointerType)
	if ok {
		return true
	}
	gqlType := typ.GetGraphQLType()
	return !strings.HasSuffix(gqlType, "!")
}

// GetGoType returns the type that should be put in a golang-declaration
// for the type e.g. in structs, in generated graphql code, etc
func GetGoType(typ types.Type) string {
	str := typ.String()

	var letterIdx int
	for idx, c := range str {
		if unicode.IsLetter(c) {
			letterIdx = idx
			break
		}
	}

	_, fp := filepath.Split(str[letterIdx:])
	if letterIdx == 0 {
		return fp
	}
	return str[:letterIdx] + fp
}
