package customtype

import (
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/enum"
)

type CustomType interface {
	GetTSType() string
	GetGraphQLType() string
	IsCustomInterface() bool
	IsCustomUnion() bool
	GetTSTypes() []string
	GetAllEnums() []*enum.Enum
	// put self last because you can reference
	// want to render in order so that dependencies are rendered first
	GetAllCustomTypes() []CustomType
}

type CustomInterface struct {
	TSType       string
	GQLType      string
	Fields       []*field.Field
	NonEntFields []*field.NonEntField

	// if present, means that this interface should be imported in GraphQL instead...
	// interface{} to avoid circular dependencies
	Action interface{}

	// if part of input, we store GraphQLFieldName here and use it later on.
	GraphQLFieldName string

	enumImports []string

	// children of this interface. could be other interfaces or unions
	Children []CustomType

	Exported bool

	tsEnums  []*enum.Enum
	gqlEnums []*enum.GQLEnum
}

func (ci *CustomInterface) GetEnumImports() []string {
	// TODO https://github.com/lolopinto/ent/issues/703
	// if we had the correct imports in TsBuilderImports, we don't need this.
	// can just reserveImports and skip this.
	return ci.enumImports
}

func (ci *CustomInterface) AddEnumImport(enumImport string) {
	ci.enumImports = append(ci.enumImports, enumImport)
}

func (ci *CustomInterface) AddEnum(tsEnum *enum.Enum, gqlEnum *enum.GQLEnum) {
	ci.tsEnums = append(ci.tsEnums, tsEnum)
	ci.gqlEnums = append(ci.gqlEnums, gqlEnum)
}

// local enums
func (ci *CustomInterface) GetTSEnums() []*enum.Enum {
	return ci.tsEnums
}

func (ci *CustomInterface) GetAllEnums() []*enum.Enum {
	ret := []*enum.Enum{}
	ret = append(ret, ci.tsEnums...)
	for _, child := range ci.Children {
		ret = append(ret, child.GetAllEnums()...)
	}
	return ret
}

func (ci *CustomInterface) GetGraphQLEnums() []*enum.GQLEnum {
	return ci.gqlEnums
}

func (ci *CustomInterface) ForeignImport(typ string) bool {
	// PS: this needs to be sped up
	for _, v := range ci.GetTSTypes() {
		if v == typ {
			return false
		}
	}

	for _, v := range ci.Children {
		tsTypes := v.GetTSTypes()
		for _, tsType := range tsTypes {
			if tsType == typ || tsType == typ+"Type" {
				return false
			}
		}
	}

	return true
}

func (ci *CustomInterface) GetTSType() string {
	return ci.TSType
}

func (ci *CustomInterface) GetTSTypes() []string {
	types := []string{ci.TSType}
	for _, v := range ci.GetTSEnums() {
		types = append(types, v.Name)
	}
	return types
}

func (ci *CustomInterface) GetGraphQLType() string {
	return ci.GQLType
}

func (ci *CustomInterface) IsCustomInterface() bool {
	return true
}

func (ci *CustomInterface) IsCustomUnion() bool {
	return false
}

func (ci *CustomInterface) GetAllCustomTypes() []CustomType {
	var ret []CustomType

	for _, child := range ci.Children {
		ret = append(ret, child.GetAllCustomTypes()...)
	}

	// put self last
	ret = append(ret, ci)
	return ret
}

func CustomInterfaceEqual(ci1, ci2 *CustomInterface) bool {
	ret := change.CompareNilVals(ci1.Action == nil, ci2.Action == nil)
	if ret != nil && !*ret {
		return false
	}

	return ci1.TSType == ci2.TSType &&
		ci1.GQLType == ci2.GQLType &&
		field.FieldsEqual(ci1.Fields, ci2.Fields) &&
		field.NonEntFieldsEqual(ci1.NonEntFields, ci2.NonEntFields) &&
		change.StringListEqual(ci1.enumImports, ci2.enumImports)
}

func CompareInterfacesMapEqual(m1, m2 map[string]*CustomInterface) bool {
	if len(m1) != len(m2) {
		return false
	}

	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok || !CustomInterfaceEqual(v, v2) {
			return false
		}
	}
	return true
}
