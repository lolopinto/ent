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
		for idx, result := range fn.Function.Results {
			sb.WriteString(result.Name)
			if idx+1 != len(fn.Function.Results) {
				sb.WriteString(", ")
			}
		}

		if len(fn.Function.Results) > 0 {
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
		} else {
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
