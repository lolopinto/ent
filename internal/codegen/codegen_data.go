package codegen

import "github.com/lolopinto/ent/internal/schema"

// Data stores the parsed data needed for codegen
type Data struct {
	Schema   *schema.Schema
	CodePath *CodePath
}

// Step refers to a step in the codegen process
// e.g. db/ graphql/code etc
type Step interface {
	Name() string
	ProcessData(data *Data) error
}
