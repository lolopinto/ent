package ent

import (
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/pkg/errors"
)

// ActionOperation is a named type that represents the different actions
// to be generated.
type ActionOperation uint

const (
	// CreateAction generates a create action for the ent. If no fields are provided, uses all fields
	// on the ent. Doesn't include private fields if no fields are provided.
	CreateAction ActionOperation = 1 << iota
	// EditAction generates an edit action for the ent. If no fields are provided, uses all fields
	// on the ent. Can have multiple EditActions with different fields provided. Doesn't include
	// private fields if no fields are provided.
	EditAction
	// DeleteAction generates a delete action for the ent.
	DeleteAction
	// MutationsAction is a shortcut to generate create, edit, and delete actions for an ent
	// Can be used to boostrap ents or for simple ents where the granularity of actions is overkill
	// Provides CUD	of CRUD. Can be the default for most ents. Should rarely be used for the `User` or `Account` ent
	MutationsAction
	// AddEdgeAction is used to provide the ability to add an edge in an AssociationEdge.
	AddEdgeAction
	// RemoveEdgeAction is used to provide the ability to remove an edge in an AssociationEdge.
	RemoveEdgeAction
	// EdgeGroupAction is used to provide the abilith to edit an edge group in an AssociationEdgeGroup.
	EdgeGroupAction
)

// ActionConfig provides a way to configure the actions generated for the ent
type ActionConfig struct {
	// Action type
	Action ActionOperation
	Fields []string // restrict the fields that can be mutated in this action to the following fields
	//	MutationOnlyFields  // TODO v2  map[string]{Type of some sort} e.g. ConfirmPassword string
	CustomActionName string // override default generated Go name
	// Flag to hide action(s) from GraphQL
	HideFromGraphQL bool
	// override default graphql name generated
	CustomGraphQLName string
}

// EdgeActionConfig provides a way to configure the actions generated for an AssociationEdge
type EdgeActionConfig struct {
	Action            ActionOperation // only AddEdgeAction and RemoveEdgeAction are supported
	CustomActionName  string          // override default generated Go name
	HideFromGraphQL   bool            // Flag to hide action(s) from GraphQL
	CustomGraphQLName string          // override default graphql name generated
}

// EdgeActions is a named type for a list of EdgeActionConfig for simpler typing
type EdgeActions []*EdgeActionConfig

// Everything below here should only be known by contributors to the library or
// advanced users

// TODO
// this simplifies the changeset and MutationBuilder interfaces since there's a lot of overlap
// instead of each of them having these things separately, they can have the same object that they return
// type MutationInfo/ActionInfo interface {
// 	ExistingEnt() Entity
// 	EntConfig() Config // just in case...
// 	GetViewer() viewer.ViewerContext
// 	Entity() Entity
// }

// MutationBuilder is the building block for a mutation or action.
// Pieces together the different parts needed for a write
type MutationBuilder interface {
	ExistingEnt() Entity
	Entity() Entity           // TODO Ola: maybe this should get loader instance?
	GetPlaceholderID() string // TODO GetMutationID()?
	GetViewer() viewer.ViewerContext
	GetChangeset() (Changeset, error) // TODO rename to Build()
	GetOperation() WriteOperation
}

// MutationBuilderMap is a named type for a map of placeholder ids to the corresponding MutationBuilder
type MutationBuilderMap map[string]MutationBuilder

// Changeset is what's responsible for actually performing the write
// Once we get here, we assume that things like privacy and all other things
// that may prevent a mutation from executing have been dealt with
// A changeset can be bundled with other changesets to create a mutation dependency tree
type Changeset interface {
	// Returns the Executor which is used to do the write.
	// This should be expected to be called multiple times easily.
	GetExecutor() Executor
	GetViewer() viewer.ViewerContext
	Entity() Entity
	// This should match the PlaceholderID of the MutationBuilder that produced this changeset
	GetPlaceholderID() string
	// keeping these 2 just in case...
	ExistingEnt() Entity //existing ent // hmm we just need ID!
	EntConfig() Config   // just in case...
}

// ChangesetWithDependencies represents a changeset that has other changesets
// as dependencies.
type ChangesetWithDependencies interface {
	Changeset
	// Map of placeholder id -> Builder
	// Useful for the executor to know the correct order of operations when performing writes
	Dependencies() MutationBuilderMap
	// List of dependent changesets
	Changesets() []Changeset
}

// Executor is responsible for sequencing complicated writes that have dependencies on each other
// For simple writes e.g. insert one row in the database, there's just one operation and nothing to do
// For complicated writes where there's dependencies between objects and the input of one is dependent
// on the output of the other, the Executor is expected to figure that and ensure that
// the operations are sequenced correctly so that the action goes off without a hitch
// The ent framework provides default Executor so only need to know this if default executor isn't suitable.
type Executor interface {
	// Provides an io.Read() style API where the underlying dependency details are hidden
	// away. works when it's one changeset with N operations or N changesets with operations across them.
	// When we're done with operations, it returns ErrAllOperations to signal EOF
	Operation() (DataOperation, error)
	// resolve placeholders from this mutation
	// Called by an Operation which has a placeholder id and returns the ent created by a previous operation so that
	// the right value can be written to the database
	ResolveValue(interface{}) Entity
}

// ErrAllOperations is like io.EOF. It signals a known error state and that callers
// of Executor.Operation() can stop calling
var ErrAllOperations = errors.New("All operation dependencies")
