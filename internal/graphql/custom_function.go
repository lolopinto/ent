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
	Item               *schemaparser.ParsedItem
}

func (fn *customFunction) GetFnCallDefinition() string {
	var sb strings.Builder
	// write results in the form a, b, err
	for idx, result := range fn.Item.Results {
		sb.WriteString(result.Name)
		if idx+1 != len(fn.Item.Results) {
			sb.WriteString(", ")
		}
	}

	// write :=
	sb.WriteString(" := ")

	// write function call
	sb.WriteString(fn.Item.FunctionName)

	sb.WriteString("(")
	for idx, arg := range fn.Item.Args {
		// always use ctx name since that's what it's called in resolver.go
		if idx == 0 && fn.SupportsContext {
			sb.WriteString("ctx")
		} else {
			sb.WriteString(arg.Name)
		}
		if idx+1 != len(fn.Item.Args) {
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
	for idx, res := range fn.Item.Results {
		if fn.ReturnsError && idx == len(fn.Item.Results)-1 {
			continue
		}
		results = append(results, result{
			Key:      strcase.ToCamel(res.Name),
			Variable: res.Name,
		})
	}
	return results
}
