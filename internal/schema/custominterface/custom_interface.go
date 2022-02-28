package custominterface

// TODO need to figure out the right package here

import "github.com/lolopinto/ent/internal/field"

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

// TODO kill...
func (ci *CustomInterface) GetEnumImports() []string {
	// TODO https://github.com/lolopinto/ent/issues/703
	// if we had the correct imports in TsBuilderImports, we don't need this.
	// can just reserveImports and skip this.
	return ci.enumImports
}

func (ci *CustomInterface) AddEnumImport(enumImport string) {
	ci.enumImports = append(ci.enumImports, enumImport)

}
