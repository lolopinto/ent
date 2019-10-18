package ent

import (
	"fmt"

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
	// PrivacyPolicy
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

type MutatingFieldInfo struct {
	DB       string
	Required bool
}
type ActionFieldMap map[string]*MutatingFieldInfo

type ActionErrorInfo struct {
	ErrorMsg string
}

type ActionValidationError struct {
	Errors     []*ActionErrorInfo
	ActionName string
}

func (err *ActionValidationError) Error() string {
	return fmt.Sprintf(
		"error validating action %s, encountered %d errors validating, errors %v",
		err.ActionName,
		len(err.Errors),
		err.Errors,
	)
}

type Changeset interface {
	GetExecutor() Executor
	GetPlaceholderID() string
	// keeping these 2 just in case...
	ExistingEnt() Entity //existing ent // hmm we just need ID!
	EntConfig() Config   // just in case...
}

type Executor interface {
	// Provides an io.Read() style API where the underlying dependency details are hidden
	// away. works when it's one changeset with N operations or N changesets with operations across them.
	// When we're done with operations, it returns AllOperations to signal EOF
	Operation() (DataOperation, error)
}

var AllOperations = errors.New("All operation dependencies ")
