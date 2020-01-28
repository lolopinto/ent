package ent

import (
	"github.com/lolopinto/ent/ent/field"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/pkg/errors"
)

type ActionOperation uint

const (
	CreateAction    ActionOperation = 1 << iota // configuration for a create action
	EditAction                                  // configuration for an edit action
	DeleteAction                                // configuration for a delete action
	MutationsAction                             // this should probably be the default for most ents. creates create/edit/delete and provides default behavior.
	AddEdgeAction
	RemoveEdgeAction
	EdgeGroupAction
)

// type ActionFieldTypeMap map[string]string

// inlining these below because want to make it easy for clients.
// type commonActionFields struct {
// 	CustomActionName  string // different name for some reason
// 	HideFromGraphQL   bool
// 	CustomGraphQLName string // invalid for MutationsAction
// }

type ActionConfig struct {
	Action ActionOperation
	Fields []string // restrict the fields that can be mutated in this action to the following fields
	//	MutationOnlyFields ActionFieldTypeMap // TODO v2
	CustomActionName  string // different name for some reason
	HideFromGraphQL   bool
	CustomGraphQLName string // invalid for MutationsAction
}

type EdgeActionConfig struct {
	Action            ActionOperation // only AddEdgeAction and RemoveEdgeAction are supported
	CustomActionName  string          // different name for some reason
	HideFromGraphQL   bool
	CustomGraphQLName string // invalid for MutationsAction
}

type EdgeActions []*EdgeActionConfig

type ActionFieldMap map[string]*FieldInfo
type FieldInfo struct {
	Field *field.Field
	Value interface{}
}

// TODO
// this simplifies the changeset and MutationBuilder interfaces since there's a lot of overlap
// instead of each of them having these things separately, they can have the same object that they return
// type MutationInfo/ActionInfo interface {
// 	ExistingEnt() Entity
// 	EntConfig() Config // just in case...
// 	GetViewer() viewer.ViewerContext
// 	Entity() Entity
// }
// makes it easier to change Viewer because I can change it once and it gets changed everywhere...

type MutationBuilder interface {
	// TODO this needs to be aware of validators
	// triggers and observers
	// observers need to be added to the changeset
	// critical observers need to be added to the changeset
	// regular observers done later

	// placeholder id to be used by fields/values in the mutation and replaced after we have a created ent
	//	GetPlaceholderID() string
	//GetOperation() ent.WriteOperation // TODO Create|Edit|Delete as top level mutations not actions
	ExistingEnt() Entity
	Entity() Entity
	GetPlaceholderID() string // TODO GetMutationID()?
	GetViewer() viewer.ViewerContext
	GetChangeset() (Changeset, error)
	GetOperation() WriteOperation
}

type Changeset interface {
	// This should be expected to be called multiple times easily.
	GetExecutor() Executor
	GetViewer() viewer.ViewerContext
	Entity() Entity
	// This should match the PlaceholderID of the MutationBuilder that produced this changeset
	GetPlaceholderID() string
	// keeping these 2 just in case...
	ExistingEnt() Entity //existing ent // hmm we just need ID!
	EntConfig() Config   // just in case...
	//	Dependencies() []Changeset
	//	CreateOperation() Changeset // the list
}

type MutationBuilderMap map[string]MutationBuilder

type ChangesetWithDependencies interface {
	Changeset
	Dependencies() MutationBuilderMap
	Changesets() []Changeset
}

type Executor interface {
	// Provides an io.Read() style API where the underlying dependency details are hidden
	// away. works when it's one changeset with N operations or N changesets with operations across them.
	// When we're done with operations, it returns AllOperations to signal EOF
	Operation() (DataOperation, error)
	// resolve placeholders from this mutation
	ResolveValue(interface{}) Entity
}

// type ExecutorWithDependencies interface {
// 	Changesets() []Changeset
// 	Depend
// }

var AllOperations = errors.New("All operation dependencies ")
