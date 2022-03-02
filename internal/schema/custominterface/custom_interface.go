package custominterface

// TODO need to figure out the right package here

import (
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/change"
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

func (ci *CustomInterface) GetEnumImports() []string {
	// TODO https://github.com/lolopinto/ent/issues/703
	// if we had the correct imports in TsBuilderImports, we don't need this.
	// can just reserveImports and skip this.
	return ci.enumImports
}

func (ci *CustomInterface) AddEnumImport(enumImport string) {
	ci.enumImports = append(ci.enumImports, enumImport)
}
