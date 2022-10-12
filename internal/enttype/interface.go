package enttype

import (
	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/internal/tsimport"
)

type Config interface {
	Base64EncodeIDs() bool
}

// Type represents a Type that's expressed in the framework
// The only initial requirement is GraphQL/db since that's exposed everywhere
type Type interface {
	GetGraphQLType() string
	GetDBType() string
}

// types that also support Typescript
type TSType interface {
	Type
	GetTSType() string
	// returns imports from outside in
	// e.g. required string => []tsimport.ImportPath{tsimport.NewGQLClassImportPath("GraphQLNonNull"), tsimport.NewGQLImportPath("GraphQLString")}
	GetTSGraphQLImports(input bool) []*tsimport.ImportPath
}

type TSTypeWithImports interface {
	TSType
	GetTsTypeImports() []*tsimport.ImportPath
}

type TSCodegenableType interface {
	TSType
	GetImportType() Import
}

// rendering of fields in actions
// e.g. converting a graphql id to ent id
// or converting say an enum value from graphql to Node representation
// if said conversion was not supported natively
type CustomGQLRenderer interface {
	TSType
	CustomGQLRender(cfg Config, v string) string
	ArgImports(cfg Config) []*tsimport.ImportPath
}

type ConvertDataTypeRet map[config.Dialect][]*tsimport.ImportPath
type ConvertDataType interface {
	TSType
	// return convert info for each dialect. a lot of these only apply for one dialect
	Convert() ConvertDataTypeRet
}

type convertListElemType interface {
	ConvertDataType
	convertListWithItem() ConvertDataTypeRet
	convertNullableListWithItem() ConvertDataTypeRet
}

type ActionFieldsInfo struct {
	ActionName     string
	ExcludedFields []string
}

type CustomType string

const (
	CustomInterface CustomType = "custom_interface"
	CustomUnion     CustomType = "custom_union"
)

type CustomTypeInfo struct {
	TSInterface      string
	GraphQLInterface string
	Type             CustomType
}

type TSTypeWithCustomType interface {
	TSType
	GetCustomTypeInfo() *CustomTypeInfo
	// TODO collapse TSTypeWithActionFields, TSWithSubFields, TSWithSubFields all into CustomTypeInfo
}

type TSTypeWithActionFields interface {
	TSTypeWithCustomType
	GetActionFieldsInfo() *ActionFieldsInfo
}

type ImportDepsType interface {
	TSType
	GetImportDepsType() *tsimport.ImportPath
}

type TSWithSubFields interface {
	TSTypeWithCustomType
	// this is interface{} so as to avoid circular-dependencies with input.Fields
	GetSubFields() interface{}
}

type TSWithUnionFields interface {
	TSTypeWithCustomType
	// this is interface{} so as to avoid circular-dependencies with input.Fields
	GetUnionFields() interface{}
}

// NullableType refers to a Type that has the nullable version of the same type
type NullableType interface {
	TSType
	GetNullableType() TSType
}

type NonNullableType interface {
	TSType
	GetNonNullableType() TSType
}

type EnumData struct {
	// TSName refers to the name of the generated enum
	TSName               string
	GraphQLName          string
	Values               []string
	EnumMap              map[string]string
	IntEnumMap           map[string]int
	DeprecatedIntEnumMap map[string]int
}

// EnumeratedType indicates that this is an enum type
type EnumeratedType interface {
	TSType
	GetEnumData() *EnumData
}
