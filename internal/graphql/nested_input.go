package graphql

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/tsimport"
)

type nestedInputVisit struct{ recursive bool }

// Copy only the GraphQL input boundary; stored structs and cached entities keep
// raw IDs. Guard each level so null, undefined and empty lists retain meaning.
func renderNestedActionInput(processor *codegen.Processor, a action.Action, typ enttype.Type, value string, visiting map[string]*nestedInputVisit) (string, []*tsimport.ImportPath) {
	custom, ok := typ.(enttype.TSTypeWithCustomType)
	if !ok || custom.GetCustomTypeInfo() == nil {
		return value, nil
	}
	ct := customTypeForActionField(processor, a, custom.GetCustomTypeInfo().TSInterface)
	if ct == nil {
		return value, nil
	}
	actionFields, actionInput := typ.(enttype.TSTypeWithActionFields)
	actionInput = actionInput && actionFields.GetActionFieldsInfo() != nil
	return renderCustomActionInput(processor, a, ct, enttype.IsListType(typ), actionInput, value, visiting)
}

func customTypeForActionField(processor *codegen.Processor, a action.Action, name string) customtype.CustomType {
	if ct, ok := processor.Schema.GetCustomTypeByTSName(name).(customtype.CustomType); ok {
		return ct
	}
	for _, root := range a.GetCustomInterfaces() {
		for _, ct := range root.GetAllCustomTypes() {
			if ct.GetTSType() == name {
				return ct
			}
		}
	}
	return nil
}

func renderCustomActionInput(processor *codegen.Processor, a action.Action, ct customtype.CustomType, list, actionInput bool, value string, visiting map[string]*nestedInputVisit) (string, []*tsimport.ImportPath) {
	name := ct.GetTSType()
	if visit := visiting[name]; visit != nil {
		visit.recursive = true
		return fmt.Sprintf("convertInput%s(%s, %t)", name, value, list), nil
	}
	visit := &nestedInputVisit{}
	visiting[name] = visit
	defer delete(visiting, name)
	// A separate lexical scope at every level keeps nested list variables distinct.
	source := "v"
	if list {
		source = "item"
	}
	var result string
	var imports []*tsimport.ImportPath
	switch typ := ct.(type) {
	case *customtype.CustomUnion:
		// Decode the selected member before discarding its GraphQL variant key.
		// Flattening first loses the information needed to select its converters.
		var members []string
		for _, member := range typ.Interfaces {
			converted, memberImports := renderCustomActionInput(processor, a, member, false, false, "v", visiting)
			imports = append(imports, memberImports...)
			members = append(members, fmt.Sprintf("%s: (v: any) => %s", strconv.Quote(member.GraphQLFieldName), converted))
		}
		imports = append(imports, tsimport.NewEntGraphQLImportPath("transformUnionInput"))
		result = fmt.Sprintf("transformUnionInput(%s, {%s})", source, strings.Join(members, ", "))
	case *customtype.CustomInterface:
		var fields []action.ActionField
		for _, f := range typ.Fields {
			// Action inputs already select their public API fields, including edit/delete IDs.
			if actionInput || f.EditableGraphQLField() {
				fields = append(fields, f)
			}
		}
		for _, f := range typ.NonEntFields {
			if f.ExposeToGraphQL() {
				fields = append(fields, f)
			}
		}
		var entries []string
		for _, f := range fields {
			original := fmt.Sprintf("%s.%s", source, f.GetGraphQLName())
			converted := original
			fieldType := f.GetFieldType()
			optional := f.Nullable() || f.ForceOptionalInAction()
			if optional {
				if nullable, ok := fieldType.(enttype.NullableType); ok {
					fieldType = nullable.GetNullableType()
				}
			}
			decode := true
			if schemaField, ok := f.(*field.Field); ok && !actionInput {
				if id, _ := scalarIDType(fieldType); id {
					// A raw scalar must round-trip without being treated as a Relay ID.
					nodeType, _ := fieldScalarReferenceNodeType(processor, schemaField)
					decode = nodeType != "" || getDeclaredStructFieldEdgeInfo(schemaField) != nil
				}
			}
			if renderer, ok := fieldType.(enttype.CustomGQLRenderer); ok && decode {
				converted = renderer.CustomGQLRender(processor.Config, original)
				imports = append(imports, getGQLFileImports(renderer.ArgImports(processor.Config), true)...)
			}
			// Nullable scalar rendering must not replace the original object type metadata.
			nested, nestedImports := renderNestedActionInput(processor, a, f.GetFieldType(), converted, visiting)
			imports = append(imports, nestedImports...)
			if nested != original || f.TSPublicAPIName() != f.GetGraphQLName() {
				entry := fmt.Sprintf("%s: %s", f.TSPublicAPIName(), nested)
				if optional {
					// Preserve omitted keys as well as explicit nulls.
					entry = fmt.Sprintf("...(%s === undefined ? {} : {%s})", original, entry)
				}
				entries = append(entries, entry)
			}
		}
		if len(entries) == 0 {
			return value, nil
		}
		result = fmt.Sprintf("({...%s, %s})", source, strings.Join(entries, ", "))
	default:
		return value, nil
	}
	if visit.recursive {
		// Name only cyclic converters. References to an ancestor type reuse this
		// lexical function at runtime, so codegen terminates without truncating IDs.
		return fmt.Sprintf("(function convertInput%s(v: any, list: boolean): any { const convertItem = (%s: any): any => %s == null ? %s : %s; return v == null ? v : list ? v.map(convertItem) : convertItem(v); })(%s, %t)", name, source, source, source, result, value, list), imports
	}
	if list {
		result = fmt.Sprintf("v.map((item: any) => item == null ? item : %s)", result)
	}
	return fmt.Sprintf("((v: any) => v == null ? v : %s)(%s)", result, value), imports
}
