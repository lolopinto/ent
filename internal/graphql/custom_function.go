package graphql

import (
	"fmt"
	"strings"

	"github.com/99designs/gqlgen/codegen/templates"
	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/internal/schemaparser"
)

type customFunction struct {
	SupportsContext    bool
	ReturnsError       bool
	ReturnsComplexType bool
	ReturnsDirectly    bool
	Function           *schemaparser.Function
	IDFields           map[string]*idField
	hasInputObject     bool
}

type idField struct {
	Field       *schemaparser.Field
	FieldType   string
	Slice       bool
	goFieldName string
	fn          *customFunction
}

func (f *idField) GoFieldName() string {
	if f.fn.hasInputObject {
		return "input." + strcase.ToCamel(f.goFieldName)
	}
	return f.goFieldName
}

func (f *idField) IDName() string {
	if f.fn.hasInputObject {
		return "input." + strcase.ToCamel(f.Field.Name) + "ID"
	}
	return f.Field.Name + "ID"
}

// returns the plural version of field in Result
// e.g UserResult.Users
func (f *idField) pluraFieldInResult() string {
	return inflection.Plural(f.FieldType)
}

func (fn *customFunction) FlagIDField(
	field *schemaparser.Field,
	fieldType, fieldName string,
	slice bool,
) {
	if fn.IDFields == nil {
		fn.IDFields = make(map[string]*idField)
	}
	fn.IDFields[field.Name] = &idField{
		Field:       field,
		FieldType:   fieldType,
		goFieldName: fieldName,
		Slice:       slice,
		fn:          fn,
	}
}

type idFieldsAssignment struct {
	LHS string
	RHS string
}

func (fn *customFunction) OrderedIDFields() idFieldsAssignment {
	lhs := make([]string, len(fn.IDFields))
	rhs := make([]string, len(fn.IDFields))

	idx := 0
	for _, arg := range fn.Function.Args {
		field := fn.IDFields[arg.Name]
		if field == nil {
			continue
		}

		lhs[idx] = fmt.Sprintf("%sResult", field.Field.Name)
		// TODO this could be too long and putting it on each line seems better...
		rhs[idx] = fmt.Sprintf("<-models.GenLoad%sFromContext(ctx, %s)", field.FieldType, field.IDName())
		idx++
	}
	return idFieldsAssignment{
		LHS: strings.Join(lhs, ", "),
		RHS: strings.Join(rhs, ","),
	}
}

func (fn *customFunction) GetFirstFnField() *idField {
	for _, arg := range fn.IDFields {
		return arg
	}
	panic("should not get here")
}

func (fn *customFunction) FlagInputObject() {
	fn.hasInputObject = true
}

func (fn *customFunction) HasIDFields() bool {
	return len(fn.IDFields) != 0
}

func (fn *customFunction) writeArgName(idx int, arg *schemaparser.Field, sb *strings.Builder) {
	// always use ctx name since that's what it's called in resolver.go
	// and may be different in generated code
	if idx == 0 && fn.SupportsContext {
		sb.WriteString("ctx")
		return
	}
	var field *idField
	field = fn.IDFields[arg.Name]
	if field != nil && !(field.Slice || len(fn.IDFields) > 1) {
		field = nil
	}

	if field != nil {
		if field.Slice {
			// slice result
			sb.WriteString("result.")
			sb.WriteString(field.pluraFieldInResult())
		} else {
			// in the case where we loaded an object first, use the loaded variable here...
			// blockerResult.User
			sb.WriteString(arg.Name)
			sb.WriteString("Result.")
			sb.WriteString(field.FieldType)
		}
	} else if fn.hasInputObject && !fn.HasIDFields() {
		// has an input object
		// e.g. input.Event
		sb.WriteString("input." + strcase.ToCamel(arg.Name))
	} else {
		sb.WriteString(arg.Name)
	}
}

func (fn *customFunction) writeResultName(idx int, result *schemaparser.Field, sb *strings.Builder) {
	if result.Name == "" {
		// TODO this should never be empty but come back to this
		sb.WriteString("err")
		return
	}

	// if there's only one result item (for a non-complex type to keep it simple)
	// or there's 2 and the second returns an error, be consistent and just use "ret"
	if idx == 0 && !fn.ReturnsComplexType {
		if len(fn.Function.Results) == 1 ||
			(len(fn.Function.Results) == 2 && fn.ReturnsError) {
			sb.WriteString("ret")
			return
		}
	}

	sb.WriteString(result.Name)
}

func (fn *customFunction) GetFnCallDefinition() string {
	var sb strings.Builder
	// only this the return if we're not returning directly
	if !fn.ReturnsDirectly {
		// write results in the form a, b, err

		if len(fn.Function.Results) > 0 {
			for idx, result := range fn.Function.Results {
				fn.writeResultName(idx, result, &sb)

				if idx+1 != len(fn.Function.Results) {
					sb.WriteString(", ")
				}
			}

			// write :=
			sb.WriteString(" := ")
		}
	}

	// use lookupImport that comes with gqlgen.
	// When we eventually convert everything to local reserveImport/lookupImport, we need to change this
	// this is fragile because it depends on the implementation detail that reserveImport/lookupImport is currently a singleton
	// write function call
	if path := templates.CurrentImports.Lookup(fn.Function.PackagePath); path != "" {
		sb.WriteString(path)
		sb.WriteString(".")
	}
	sb.WriteString(fn.Function.FunctionName)

	sb.WriteString("(")
	for idx, arg := range fn.Function.Args {
		fn.writeArgName(idx, arg, &sb)
		if idx+1 != len(fn.Function.Args) {
			sb.WriteString(", ")
		}
	}
	sb.WriteString(")")

	return sb.String()
}

type result struct {
	Key      string
	Variable string
}

func (fn *customFunction) GetResults() []result {
	var results []result
	for idx, res := range fn.Function.Results {
		if fn.ReturnsError && idx == len(fn.Function.Results)-1 {
			continue
		}
		results = append(results, result{
			Key:      strcase.ToCamel(res.Name),
			Variable: res.Name,
		})
	}

	// GraphQL doesn't support empty return values so if there's no result, we'll return success: true here
	if len(results) == 0 {
		results = append(results, result{
			Key:      "Success",
			Variable: "cast.ConvertToNullableBool(true)",
		})
	}
	return results
}
