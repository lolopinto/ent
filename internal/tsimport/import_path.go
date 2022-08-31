package tsimport

import (
	"fmt"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/schema/change"
)

type ImportPath struct {
	ImportPath    string `json:"importPath"`
	Import        string `json:"import"`
	DefaultImport bool   `json:"defaultImport,omitempty"`
	// we name this originalImport so that clients everywhere can just keep calling useImport .Import
	OriginalImport string `json:"originalImport,omitempty"`

	// only used in graphql (at least for now)
	// defaults to no. if function, call it instead of just referencing the import when used?
	Function bool `json:"function,omitempty"`

	Class bool `json:"class,omitempty"`

	TransformedForGraphQLMutation bool `json:"transformedForGraphQLMutation,omitempty"`
	TransformedForExternalEnt     bool `json:"transformedForExternalEnt,omitempty"`
}

// NewGQLImportPath creates a new import from "graphql"
func NewGQLImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: "graphql",
	}
}

func NewGQLClassImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: "graphql",
		Class:      true,
	}
}

func NewGraphQLJSONImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: "graphql-type-json",
	}
}

func NewEntImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: codepath.Package,
	}
}

func NewEntActionImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: codepath.ActionPackage,
	}
}

func NewEntGraphQLImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: codepath.GraphQLPackage,
	}
}

func NewLocalGraphQLEntImportPath(typ string) *ImportPath {
	return &ImportPath{
		// TODO always adding type for now. may need to different paths
		Import: typ + "Type",
		// transformed to codepath.GetImportPathForExternalGQLFile for mutations
		ImportPath:                    codepath.GetImportPathForInternalGQLFile(),
		TransformedForGraphQLMutation: true,
	}
}

func getImportPathForCustomInterfaceInputFile(gqlType string) string {
	return fmt.Sprintf("src/graphql/generated/mutations/input/%s_type", strcase.ToSnake(gqlType))
}

func NewLocalGraphQLInputEntImportPath(typ string) *ImportPath {
	return &ImportPath{
		// TODO always adding type for now. may need to different paths
		Import:     typ + "InputType",
		ImportPath: getImportPathForCustomInterfaceInputFile(typ + "Input"),
	}
}

func NewLocalEntImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import: typ,
		// transformed to codepath.GetExternalImportPath for action/builder/other non-ent locales
		ImportPath:                codepath.GetInternalImportPath(),
		TransformedForExternalEnt: true,
	}
}

func NewLocalEntConnectionImportPath(typ string) *ImportPath {
	return &ImportPath{
		// TODO always adding type for now. may need to different paths
		Import:   typ + "Type",
		Function: true,
		// transformed to codepath.GetImportPathForExternalGQLFile for mutations
		ImportPath:                    codepath.GetImportPathForInternalGQLFile(),
		TransformedForGraphQLMutation: true,
	}
}

func ImportPathEqual(ip1, ip2 *ImportPath) bool {
	ret := change.CompareNilVals(ip1 == nil, ip2 == nil)
	if ret != nil {
		return *ret
	}

	return ip1.ImportPath == ip2.ImportPath &&
		ip1.Import == ip2.Import &&
		ip1.DefaultImport == ip2.DefaultImport &&
		ip1.Function == ip2.Function &&
		ip1.Class == ip2.Class &&
		ip1.TransformedForGraphQLMutation == ip2.TransformedForGraphQLMutation &&
		ip1.TransformedForExternalEnt == ip2.TransformedForExternalEnt
}

func ImportPathsEqual(l1, l2 []*ImportPath) bool {
	if len(l1) != len(l2) {
		return false
	}

	for i := range l1 {
		if !ImportPathEqual(l1[i], l2[i]) {
			return false
		}
	}
	return true
}
