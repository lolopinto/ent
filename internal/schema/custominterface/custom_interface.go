package custominterface

// TODO need to figure out the correct name of the package here

import (
	"github.com/lolopinto/ent/internal/enttype"
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
	// TODO exported
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

// local enums
func (ci *CustomInterface) GetTSEnums() []*enum.Enum {
	var ret []*enum.Enum

	for _, f := range ci.Fields {
		typ := f.GetFieldType()
		enumTyp, ok := enttype.GetEnumType(typ)
		if !ok {
			continue
		}
		input := enum.NewInputFromEnumType(enumTyp)
		tsEnum, _ := enum.GetEnums(input)
		ret = append(ret, tsEnum)
	}
	return ret
}

func (ci *CustomInterface) ForeignImport(typ string) bool {
	// PS: this needs to be sped up
	for _, v := range ci.GetTSEnums() {
		if v.Name == typ {
			return false
		}
	}

	for _, v := range ci.SubInterfaces {
		if v.TSType == typ {
			return false
		}
	}

	return true
}
