package graphql

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/tsimport"
)

// Copy only the GraphQL input boundary; stored structs and cached entities keep
// raw IDs. Guard each level so null, undefined and empty lists retain meaning.
func renderNestedActionInput(processor *codegen.Processor, a action.Action, typ enttype.Type, value string, visiting map[string]bool) (string, []*tsimport.ImportPath) {
	custom, ok := typ.(enttype.TSTypeWithCustomType)
	if !ok || custom.GetCustomTypeInfo() == nil {
		return value, nil
	}
	name := custom.GetCustomTypeInfo().TSInterface
	if visiting[name] {
		return value, nil
	}
	ci, ok := customInterfaceForActionField(processor, a, name)
	if !ok {
		return value, nil
	}
	visiting[name] = true
	defer delete(visiting, name)
	var fields []action.ActionField
	for _, f := range ci.Fields {
		if f.EditableGraphQLField() {
			fields = append(fields, f)
		}
	}
	for _, f := range ci.NonEntFields {
		if f.ExposeToGraphQL() {
			fields = append(fields, f)
		}
	}
	list := enttype.IsListType(typ)
	// A separate lexical scope at every level keeps nested list variables distinct.
	source := "v"
	if list {
		source = "item"
	}
	var entries []string
	var imports []*tsimport.ImportPath
	for _, f := range fields {
		original := fmt.Sprintf("%s.%s", source, f.GetGraphQLName())
		converted := original
		if renderer, ok := f.GetFieldType().(enttype.CustomGQLRenderer); ok {
			converted = renderer.CustomGQLRender(processor.Config, original)
			imports = append(imports, getGQLFileImports(renderer.ArgImports(processor.Config), true)...)
		}
		nested, nestedImports := renderNestedActionInput(processor, a, f.GetFieldType(), converted, visiting)
		imports = append(imports, nestedImports...)
		if nested != original || f.TSPublicAPIName() != f.GetGraphQLName() {
			entries = append(entries, fmt.Sprintf("%s: %s", f.TSPublicAPIName(), nested))
		}
	}
	if len(entries) == 0 {
		return value, nil
	}
	result := fmt.Sprintf("({...%s, %s})", source, strings.Join(entries, ", "))
	if list {
		result = fmt.Sprintf("v.map((item: any) => %s)", result)
	}
	return fmt.Sprintf("((v: any) => v == null ? v : %s)(%s)", result, value), imports
}
