package graphql

import (
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/schemaparser"
)

type customFunction struct {
	SupportsContext    bool
	ReturnsError       bool
	ReturnsComplexType bool
	Function           *schemaparser.Function
	IDFields           map[string]*idField
}

type idField struct {
	Field     *schemaparser.Field
	FieldType string
}

func (fn *customFunction) FlagIDField(field *schemaparser.Field, fieldType string) {
	if fn.IDFields == nil {
		fn.IDFields = make(map[string]*idField)
	}
	fn.IDFields[field.Name] = &idField{
		Field:     field,
		FieldType: fieldType,
	}
}

func (fn *customFunction) HasIDFields() bool {
	return len(fn.IDFields) != 0
}

func (fn *customFunction) ReturnDirectly() bool {
	// TODO this may not always work because of the nullable here imposed by GQL
	// deal with this later
	return !fn.ReturnsComplexType && fn.ReturnsError
}

func (fn *customFunction) GetFnCallDefinition() string {
	var sb strings.Builder
	// only this the return if we're returning a complex type and need to build it
	if fn.ReturnsComplexType {
		// write results in the form a, b, err

		if len(fn.Function.Results) > 0 {
			for idx, result := range fn.Function.Results {
				if result.Name == "" {
					// TODO this should never be empty but come back to this
					sb.WriteString("err")
				} else {
					sb.WriteString(result.Name)
				}
				if idx+1 != len(fn.Function.Results) {
					sb.WriteString(", ")
				}
			}

			// write :=
			sb.WriteString(" := ")
		}
	}

	// write function call
	sb.WriteString(fn.Function.FunctionName)

	sb.WriteString("(")
	for idx, arg := range fn.Function.Args {
		// always use ctx name since that's what it's called in resolver.go
		// and may be different in generated code
		if idx == 0 && fn.SupportsContext {
			sb.WriteString("ctx")
		} else if len(fn.IDFields) > 1 {
			idField := fn.IDFields[arg.Name]
			// in the case where we loaded an object first, use the loaded variable here...
			if idField != nil {
				// blockerResult.User
				sb.WriteString(arg.Name)
				sb.WriteString("Result.")
				sb.WriteString(idField.FieldType)
			} else {
				sb.WriteString(arg.Name)
			}
		} else {
			// we loaded sequentially for simplicity sake so don't care about idField
			sb.WriteString(arg.Name)
		}
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

func (fn *customFunction) LoadedFields() string {
	var ret []string
	for name := range fn.IDFields {
		ret = append(ret, "&"+name+"Result")
	}
	return strings.Join(ret, ", ")
}
