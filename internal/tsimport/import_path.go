package tsimport

type ImportPath struct {
	ImportPath    string
	Import        string
	DefaultImport bool

	// only used in graphql (at least for now)
	// defaults to no. if function, call it instead of just referencing the import when used?
	Function bool
}
