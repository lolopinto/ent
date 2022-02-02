package customtype

import (
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/enum"
)

type CustomInterface struct {
	TSType       string
	GQLType      string
	Fields       []*field.Field
	NonEntFields []*field.NonEntField

	// if present, means that this interface should be imported in GraphQL instead...
	// interface{} to avoid circular dependencies
	Action interface{}

	enumImports []string

	// sub interfaces that this uses
	SubInterfaces []*CustomInterface
	Exported      bool

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

func (ci *CustomInterface) GetGraphQLEnums() []*enum.GQLEnum {
	return ci.gqlEnums
}

func (ci *CustomInterface) ForeignImport(typ string) bool {
	// PS: this needs to be sped up
	for _, v := range ci.GetTSEnums() {
		if v.Name == typ {
			return false
		}
	}

	for _, v := range ci.SubInterfaces {
		if v.TSType == typ || v.TSType == typ+"Type" {
			return false
		}
	}

	return true
}
