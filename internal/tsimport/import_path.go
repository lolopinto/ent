package tsimport

import (
	"github.com/lolopinto/ent/internal/codepath"
)

type ImportPath struct {
	ImportPath    string
	Import        string
	DefaultImport bool

	// only used in graphql (at least for now)
	// defaults to no. if function, call it instead of just referencing the import when used?
	Function bool

	TransformedForGraphQLMutation bool
	TransformedForExternalEnt     bool
}

// NewGQLImportPath creates a new import from "graphql"
func NewGQLImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: "graphql",
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
