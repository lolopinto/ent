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
	"github.com/lolopinto/ent/ent/config"
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

// types that also support Typescript
// TODO need to eventually add this for all things but starting with primitives for now
type TSType interface {
	EntType
	GetTSType() string
}

type TSTypeWithImports interface {
	TSType
	GetTsTypeImports() []string
}

type TSGraphQLType interface {
	TSType
	// returns imports from outside in
	// e.g. required string => []fileImport{newGQLFileImport("GraphQLNonNull"), newGQLFileImport("GraphQLString")}
	GetTSGraphQLImports() []FileImport
}

// type TSObjectType interface {
// 	TSGraphQLType
// 	GetTSName() string
// }

type IDMarkerInterface interface {
	TSGraphQLType
	IsIDType() bool
}

type ConvertDataType interface {
	TSType
	Convert() FileImport
}

type TSTypeWithActionFields interface {
	TSGraphQLType
	GetActionName() string
}

type ImportType string

const (
	GraphQL    ImportType = "graphql"
	Node       ImportType = "node"
	Enum       ImportType = "enum"
	Connection ImportType = "connection"
	// EntGraphQL refers to graphql scalars or things in the ent graphql space
	EntGraphQL ImportType = "ent_graphql"
	Package    ImportType = "package"
)

// for imports that are not from "graphql"
// we need a way to flag different import types
// e.g. Node of type User
// or enum of type RequestStatus
// and have the import path be handled separately/later
type FileImport struct {
	Type       string
	ImportType ImportType // so instead of the path being hardcoded, we indicate we're exposing an enum of a given type
}

// helper to more easily create a GraphQL import since very common
func NewGQLFileImport(typ string) FileImport {
	return FileImport{
		Type:       typ,
		ImportType: GraphQL,
	}
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

// EnumeratedType indicates that this is an enum type
type EnumeratedType interface {
	TSType
	// GetTSName refers to the name of the generated enum
	GetTSName() string
	GetGraphQLName() string
	GetEnumValues() []string
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

func (t *StringType) GetTSType() string {
	return "string"
}

func (t *StringType) GetCastToMethod() string {
	return "cast.ToString"
}

func (t *StringType) GetNullableType() Type {
	return &NullableStringType{}
}

func (t *StringType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLNonNull"), NewGQLFileImport("GraphQLString"),
	}
}

type NullableStringType struct {
	stringType
}

func (t *NullableStringType) GetGraphQLType() string {
	return "String"
}

func (t *NullableStringType) GetTSType() string {
	return "string | null"
}

func (t *NullableStringType) GetCastToMethod() string {
	return "cast.ToNullableString"
}

func (t *NullableStringType) GetNonNullableType() Type {
	return &StringType{}
}

func (t *NullableStringType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLString"),
	}
}

type boolType struct{}

func (t *boolType) GetDBType() string {
	return "sa.Boolean()"
}

func (t *boolType) GetZeroValue() string {
	return "false"
}

func (t *boolType) Convert() FileImport {
	return FileImport{
		Type:       "convertBool",
		ImportType: Package,
	}
}

type BoolType struct {
	boolType
}

func (t *BoolType) GetGraphQLType() string {
	return "Boolean!"
}

func (t *BoolType) GetTSType() string {
	return "boolean"
}

func (t *BoolType) GetCastToMethod() string {
	return "cast.ToBool"
}

func (t *BoolType) GetNullableType() Type {
	return &NullableBoolType{}
}

func (t *BoolType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLNonNull"), NewGQLFileImport("GraphQLBoolean"),
	}
}

type NullableBoolType struct {
	boolType
}

func (t *NullableBoolType) GetGraphQLType() string {
	return "Boolean"
}

func (t *NullableBoolType) GetTSType() string {
	return "boolean | null"
}

func (t *NullableBoolType) GetCastToMethod() string {
	return "cast.ToNullableBool"
}

func (t *NullableBoolType) GetNonNullableType() Type {
	return &BoolType{}
}

func (t *NullableBoolType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLBoolean"),
	}
}

func (t *NullableBoolType) Convert() FileImport {
	return FileImport{
		Type:       "convertNullableBool",
		ImportType: Package,
	}
}

// TODO uuid support needed
// and eventually need to work for non uuid types...

type idType struct{}

func (t *idType) IsIDType() bool {
	return true
}

func (t *idType) GetDBType() string {
	if config.IsSQLiteDialect() {
		// SQLite doesn't support UUID so do the translation here
		return "sa.Text()"
	}
	return "postgresql.UUID()"
}

func (t *idType) GetZeroValue() string {
	return ""
}

func (t *idType) GetTsTypeImports() []string {
	// so that we "useImport ID" in the generation
	return []string{"ID"}
}

type IDType struct {
	idType
}

func (t *IDType) GetGraphQLType() string {
	return "ID!"
}

func (t *IDType) GetTSType() string {
	return "ID"
}

func (t *IDType) GetCastToMethod() string {
	return "cast.ToUUIDString"
}

func (t *IDType) GetNullableType() Type {
	return &NullableIDType{}
}

func (t *IDType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLNonNull"),
		NewGQLFileImport("GraphQLID"),
	}
}

type NullableIDType struct {
	idType
}

func (t *NullableIDType) GetGraphQLType() string {
	return "ID"
}

func (t *NullableIDType) GetTSType() string {
	return "ID | null"
}

func (t *NullableIDType) GetCastToMethod() string {
	return "cast.ToNullableUUIDString"
}

func (t *NullableIDType) GetNonNullableType() Type {
	return &IDType{}
}

func (t *NullableIDType) GetTSGraphQLImports() []FileImport {
	return []FileImport{NewGQLFileImport("GraphQLID")}
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

func (t *IntegerType) GetTSType() string {
	return "number"
}

func (t *IntegerType) GetCastToMethod() string {
	return "cast.ToInt"
}

func (t *IntegerType) GetNullableType() Type {
	return &NullableIntegerType{}
}

func (t *IntegerType) GetTSGraphQLImports() []FileImport {
	return []FileImport{NewGQLFileImport("GraphQLNonNull"), NewGQLFileImport("GraphQLInt")}
}

type NullableIntegerType struct {
	intType
}

func (t *NullableIntegerType) GetGraphQLType() string {
	return "Int"
}

func (t *NullableIntegerType) GetTSType() string {
	return "number | null"
}

func (t *NullableIntegerType) GetCastToMethod() string {
	return "cast.ToNullableInt"
}

func (t *NullableIntegerType) GetNonNullableType() Type {
	return &IntegerType{}
}

func (t *NullableIntegerType) GetTSGraphQLImports() []FileImport {
	return []FileImport{NewGQLFileImport("GraphQLInt")}
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

func (t *FloatType) GetTSType() string {
	return "number"
}

func (t *FloatType) GetCastToMethod() string {
	return "cast.ToFloat"
}

func (t *FloatType) GetNullableType() Type {
	return &NullableFloatType{}
}

func (t *FloatType) GetTSGraphQLImports() []FileImport {
	return []FileImport{NewGQLFileImport("GraphQLNonNull"), NewGQLFileImport("GraphQLFloat")}
}

type NullableFloatType struct {
	floatType
}

func (t *NullableFloatType) GetGraphQLType() string {
	return "Float"
}

func (t *NullableFloatType) GetTSType() string {
	return "number | null"
}

func (t *NullableFloatType) GetCastToMethod() string {
	return "cast.ToNullableFloat"
}

func (t *NullableFloatType) GetNonNullableType() Type {
	return &FloatType{}
}

func (t *NullableFloatType) GetTSGraphQLImports() []FileImport {
	return []FileImport{NewGQLFileImport("GraphQLFloat")}
}

type timestampType struct{}

func (t *timestampType) GetDBType() string {
	return "sa.TIMESTAMP()"
}

func (t *timestampType) GetZeroValue() string {
	return "time.Time{}"
}

func (t *timestampType) DefaultGraphQLFieldName() string {
	return "time"
}

func (t *timestampType) Convert() FileImport {
	return FileImport{
		Type:       "convertDate",
		ImportType: Package,
	}
}

type TimestampType struct {
	timestampType
}

// use the built in graphql type
func (t *TimestampType) GetGraphQLType() string {
	return "Time!"
}

func (t *TimestampType) GetTSType() string {
	return "Date"
}

func (t *TimestampType) GetCastToMethod() string {
	return "cast.ToTime"
}

func (t *TimestampType) GetNullableType() Type {
	return &NullableTimestampType{}
}

func (t *TimestampType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLNonNull"),
		{
			Type:       "GraphQLTime",
			ImportType: EntGraphQL,
		},
	}
}

type TimestamptzType struct {
	TimestampType
}

func (t *TimestamptzType) GetDBType() string {
	return "sa.TIMESTAMP(timezone=True)"
}

func (t *TimestamptzType) GetNullableType() Type {
	return &NullableTimestamptzType{}
}

type DateType struct {
	TimestampType
}

func (t *DateType) GetDBType() string {
	return "sa.Date()"
}

func (t *DateType) GetNullableType() Type {
	return &NullableDateType{}
}

type NullableTimestampType struct {
	timestampType
}

func (t *NullableTimestampType) GetCastToMethod() string {
	return "cast.ToNullableTime"
}

func (t *NullableTimestampType) GetGraphQLType() string {
	return "Time"
}

func (t *NullableTimestampType) GetTSType() string {
	return "Date | null"
}

func (t *NullableTimestampType) GetNonNullableType() Type {
	return &TimestampType{}
}

func (t *NullableTimestampType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		{
			Type:       "GraphQLTime",
			ImportType: EntGraphQL,
		},
	}
}

func (t *NullableTimestampType) Convert() FileImport {
	return FileImport{
		Type:       "convertNullableDate",
		ImportType: Package,
	}
}

type NullableTimestamptzType struct {
	NullableTimestampType
}

func (t *NullableTimestamptzType) GetDBType() string {
	return "sa.TIMESTAMP(timezone=True)"
}

func (t *NullableTimestamptzType) GetNonNullableType() Type {
	return &TimestamptzType{}
}

type NullableDateType struct {
	NullableTimestampType
}

func (t *NullableDateType) GetDBType() string {
	return "sa.Date()"
}

func (t *NullableDateType) GetNonNullableType() Type {
	return &DateType{}
}

type TimeType struct {
	TimestampType
}

func (t *TimeType) GetDBType() string {
	return "sa.Time()"
}

func (t *TimeType) GetNullableType() Type {
	return &NullableTimeType{}
}

func (t *TimeType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLNonNull"),
		// string format for time. or do we want a new scalar time?
		NewGQLFileImport("GraphQLString"),
	}
}

func (t *TimeType) GetGraphQLType() string {
	return "String!"
}

type TimetzType struct {
	TimeType
}

func (t *TimetzType) GetDBType() string {
	return "sa.Time(timezone=True)"
}

func (t *TimetzType) GetNullableType() Type {
	return &NullableTimetzType{}
}

type NullableTimeType struct {
	NullableTimestampType
}

func (t *NullableTimeType) GetDBType() string {
	return "sa.Time()"
}

func (t *NullableTimeType) GetNonNullableType() Type {
	return &TimeType{}
}

func (t *NullableTimeType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		// string format for time. or do we want a new scalar time?
		NewGQLFileImport("GraphQLString"),
	}
}

func (t *NullableTimeType) GetGraphQLType() string {
	return "String"
}

type NullableTimetzType struct {
	NullableTimeType
}

func (t *NullableTimetzType) GetDBType() string {
	return "sa.Time(timezone=True)"
}

func (t *NullableTimetzType) GetNonNullableType() Type {
	return &TimetzType{}
}

// public for tests
type CommonObjectType struct {
	TSType      string
	GraphQLType string
	ActionName  string
}

func (t *CommonObjectType) GetDBType() string {
	panic("objectType not a DB type yet")
}

func (t *CommonObjectType) GetZeroValue() string {
	return "{}"
}

func (t *CommonObjectType) GetCastToMethod() string {
	panic("GetCastToMethod doesn't apply for objectType")
}

func (t *CommonObjectType) GetActionName() string {
	return t.ActionName
}

type ObjectType struct {
	CommonObjectType
}

func (t *ObjectType) GetGraphQLType() string {
	return fmt.Sprintf("%s!", t.GraphQLType)
}

func (t *ObjectType) GetTSType() string {
	return t.TSType
}

func (t *ObjectType) GetNullableType() Type {
	return &NullableObjectType{}
}

func (t *ObjectType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		NewGQLFileImport("GraphQLNonNull"),
		{
			Type: t.GraphQLType,
		},
	}
}

type NullableObjectType struct {
	CommonObjectType
}

func (t *NullableObjectType) GetGraphQLType() string {
	return t.GraphQLType
}

func (t *NullableObjectType) GetTSType() string {
	return fmt.Sprintf("%s | null", t.TSType)
}

func (t *NullableObjectType) GetNullableType() Type {
	return &ObjectType{}
}

func (t *NullableObjectType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		{
			Type: t.GraphQLType,
		},
	}
}

type ListWrapperType struct {
	Type TSGraphQLType
	// doesn't care if content is nullable. that's handled by Type passed...
	Nullable bool
}

func (t *ListWrapperType) GetDBType() string {
	panic("ListWrapperType not a DB type yet")
}

func (t *ListWrapperType) GetZeroValue() string {
	return "{}"
}

func (t *ListWrapperType) GetCastToMethod() string {
	panic("GetCastToMethod doesn't apply for ListWrapperType")
}

func (t *ListWrapperType) GetGraphQLType() string {
	if t.Nullable {
		return fmt.Sprintf("[%s]", t.Type.GetGraphQLType())
	}
	return fmt.Sprintf("[%s]!", t.Type.GetGraphQLType())
}

func (t *ListWrapperType) GetTSType() string {
	if t.Nullable {
		return fmt.Sprintf("%s[] | null", t.Type.GetTSType())
	}
	return fmt.Sprintf("%s[]", t.Type.GetTSType())
}

func (t *ListWrapperType) GetNullableType() Type {
	return &ListWrapperType{
		Type:     t.Type,
		Nullable: true,
	}
}

func (t *ListWrapperType) GetNonNullableType() Type {
	return &ListWrapperType{
		Type:     t.Type,
		Nullable: false,
	}
}

func (t *ListWrapperType) GetTSGraphQLImports() []FileImport {
	var ret = []FileImport{}

	if !t.Nullable {
		ret = append(ret, NewGQLFileImport("GraphQLNonNull"))
	}
	ret = append(ret, NewGQLFileImport("GraphQLList"))
	ret = append(ret, t.Type.GetTSGraphQLImports()...)
	return ret
}

func (t *ListWrapperType) GetActionName() string {
	t2, ok := t.Type.(TSTypeWithActionFields)
	if !ok {
		return ""
	}
	return t2.GetActionName()
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

func (t *jsonTypeImpl) GetCastToMethod() string {
	return "cast.UnmarshallJSON"
}

type RawJSONType struct {
	jsonTypeImpl
}

func (t *RawJSONType) GetGraphQLType() string {
	panic("TODO implement this later")
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

type enumType struct {
}

func (t *enumType) GetZeroValue() string {
	panic("enum type not supported in go-lang yet")
}

func (t *enumType) getDBTypeForEnumDBType(values []string, typ string) string {
	var sb strings.Builder
	for _, v := range values {
		sb.WriteString(strconv.Quote(v))
		sb.WriteString(", ")
	}
	// TODO eventually provide option to define enum type
	// for now we take it from TSType if that's given since it makes sense to be consistent with that
	// if not provided, we use the name
	// we also need DBTypeName or something too
	enumType := strconv.Quote(strcase.ToSnake(typ))
	sb.WriteString(fmt.Sprintf("name=%s", enumType))
	return fmt.Sprintf("postgresql.ENUM(%s)", sb.String())

}

type EnumType struct {
	enumType
	EnumDBType  bool
	Type        string
	GraphQLType string
	Values      []string
}

func (t *EnumType) GetDBType() string {
	if t.EnumDBType {
		return t.getDBTypeForEnumDBType(t.Values, t.Type)
	}
	return "sa.Text()"
}

func (t *EnumType) GetEnumValues() []string {
	return t.Values
}

func (t *EnumType) GetGraphQLType() string {
	return fmt.Sprintf("%s!", t.GraphQLType)
}

func (t *EnumType) GetTSName() string {
	return t.Type
}

func (t *EnumType) GetGraphQLName() string {
	return t.GraphQLType
}

func (t *EnumType) GetTSType() string {
	return t.Type
}

func (t *EnumType) GetTsTypeImports() []string {
	return []string{t.Type}
}

func (t *EnumType) GetCastToMethod() string {
	panic("enum type not supported in go-lang yet")
}

func (t *EnumType) GetNullableType() Type {
	return &NullableEnumType{
		Type:        t.Type,
		GraphQLType: t.GraphQLType,
		Values:      t.Values,
	}
}

func (t *EnumType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		{
			ImportType: GraphQL,
			Type:       "GraphQLNonNull",
		},
		{
			ImportType: Enum,
			Type:       t.GraphQLType,
		},
	}
}

type NullableEnumType struct {
	enumType
	EnumDBType  bool
	Type        string
	GraphQLType string
	Values      []string
}

func (t *NullableEnumType) GetDBType() string {
	if t.EnumDBType {
		return t.getDBTypeForEnumDBType(t.Values, t.Type)
	}
	return "sa.Text()"
}

func (t *NullableEnumType) GetEnumValues() []string {
	return t.Values
}

func (t *NullableEnumType) GetGraphQLType() string {
	return t.GraphQLType
}

func (t *NullableEnumType) GetTSName() string {
	return t.Type
}

func (t *NullableEnumType) GetGraphQLName() string {
	return t.GraphQLType
}

func (t *NullableEnumType) GetTSType() string {
	return fmt.Sprintf("%s | null", t.Type)
}

func (t *NullableEnumType) GetTsTypeImports() []string {
	return []string{t.Type}
}

func (t *NullableEnumType) GetCastToMethod() string {
	panic("enum type not supported in go-lang yet")
}

func (t *NullableEnumType) GetNonNullableType() Type {
	return &EnumType{
		Type:        t.Type,
		GraphQLType: t.GraphQLType,
		Values:      t.Values,
	}
}

func (t *NullableEnumType) GetTSGraphQLImports() []FileImport {
	return []FileImport{
		{
			ImportType: Enum,
			Type:       t.GraphQLType,
		},
	}
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
		return &TimestampType{}
	case "*time.Time":
		return &NullableTimestampType{}
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

func IsConvertDataType(t EntType) bool {
	_, ok := t.(ConvertDataType)
	return ok
}

func ConvertFunc(t EntType) string {
	tt, ok := t.(ConvertDataType)
	if !ok {
		return ""
	}
	return tt.Convert().Type
}
