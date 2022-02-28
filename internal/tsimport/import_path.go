package tsimport

import "github.com/lolopinto/ent/internal/codepath"

type ImportPath struct {
	ImportPath    string
	Import        string
	DefaultImport bool

	// only used in graphql (at least for now)
	// defaults to no. if function, call it instead of just referencing the import when used?
	Function bool

	TransformedForMutation bool
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

func NewEntGraphQLImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import:     typ,
		ImportPath: codepath.GraphQLPackage,
	}
}

func NewLocalEntImportPath(typ string) *ImportPath {
	return &ImportPath{
		Import: typ,
		// transformed to codepath.GetImportPathForExternalGQLFile for mutations
		ImportPath:             codepath.GetImportPathForInternalGQLFile(),
		TransformedForMutation: true,
	}
}
