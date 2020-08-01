package action

import (
	"fmt"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/edge"
)

type actionType interface {
	getActionName() string
}

type concreteActionType interface {
	actionType
	getAction(commonInfo commonActionInfo) Action
	getOperation() ent.ActionOperation
}

type concreteNodeActionType interface {
	concreteActionType
	getDefaultActionName(nodeName string) string
	getDefaultGraphQLName(nodeName string) string
	getDefaultInputName(nodeName string) string
	supportsFieldsFromEnt() bool
}

type concreteEdgeActionType interface {
	concreteActionType
	getDefaultActionName(nodeName string, edge edge.ActionableEdge) string
	getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string
}

type createActionType struct {
}

func (action *createActionType) getDefaultActionName(nodeName string) string {
	return "Create" + strcase.ToCamel(nodeName) + "Action"
}

func (action *createActionType) getDefaultGraphQLName(nodeName string) string {
	return strcase.ToLowerCamel(nodeName) + "Create"
}

// CreateUserAction vs UserCreateInput is not consistent :(
// need to figure out gql mutation vs action naming convention
// but somehow choosing the same input type for both?
func (action *createActionType) getDefaultInputName(nodeName string) string {
	return strcase.ToCamel(nodeName) + "CreateInput"
}

func (action *createActionType) getAction(commonInfo commonActionInfo) Action {
	return getCreateAction(commonInfo)
}

func (action *createActionType) supportsFieldsFromEnt() bool {
	return true
}

func (action *createActionType) getActionName() string {
	return "ent.CreateAction"
}

func (action *createActionType) getOperation() ent.ActionOperation {
	return ent.CreateAction
}

var _ concreteNodeActionType = &createActionType{}

type editActionType struct {
}

func (action *editActionType) getDefaultActionName(nodeName string) string {
	return "Edit" + strcase.ToCamel(nodeName) + "Action"
}

func (action *editActionType) getDefaultGraphQLName(nodeName string) string {
	return strcase.ToLowerCamel(nodeName) + "Edit"
}

func (action *editActionType) getDefaultInputName(nodeName string) string {
	return strcase.ToCamel(nodeName) + "EditInput"
}

func (action *editActionType) getAction(commonInfo commonActionInfo) Action {
	return getEditAction(commonInfo)
}

func (action *editActionType) supportsFieldsFromEnt() bool {
	return true
}

func (action *editActionType) getActionName() string {
	return "ent.EditAction"
}

func (action *editActionType) getOperation() ent.ActionOperation {
	return ent.EditAction
}

var _ concreteNodeActionType = &editActionType{}

type deleteActionType struct {
}

func (action *deleteActionType) getDefaultActionName(nodeName string) string {
	return "Delete" + strcase.ToCamel(nodeName) + "Action"
}

func (action *deleteActionType) getDefaultGraphQLName(nodeName string) string {
	return strcase.ToLowerCamel(nodeName) + "Delete"
}

func (action *deleteActionType) getDefaultInputName(nodeName string) string {
	panic("Unsupported option")
}

func (action *deleteActionType) getAction(commonInfo commonActionInfo) Action {
	return getDeleteAction(commonInfo)
}

func (action *deleteActionType) supportsFieldsFromEnt() bool {
	return false
}

func (action *deleteActionType) getActionName() string {
	return "ent.DeleteAction"
}

func (action *deleteActionType) getOperation() ent.ActionOperation {
	return ent.DeleteAction
}

var _ concreteNodeActionType = &deleteActionType{}

type mutationsActionType struct {
}

func (action *mutationsActionType) getActionName() string {
	return "ent.MutationsAction"
}

var _ actionType = &mutationsActionType{}

type addEdgeActionType struct {
}

func (action *addEdgeActionType) getDefaultActionName(nodeName string, edge edge.ActionableEdge) string {
	// it's going to be in the node_name package..
	// AddFriendAction
	return "Add" + edge.EdgeIdentifier() + "Action"
}

func (action *addEdgeActionType) getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string {
	// eventAddInvitee
	return strcase.ToLowerCamel(nodeName) + "Add" + edge.EdgeIdentifier()
}

func (action *addEdgeActionType) getAction(commonInfo commonActionInfo) Action {
	return getAddEdgeAction(commonInfo)
}

func (action *addEdgeActionType) supportsFieldsFromEnt() bool {
	// hmm! technically not?? todo come back
	return true
}

func (action *addEdgeActionType) getActionName() string {
	return "ent.AddEdgeAction"
}

func (action *addEdgeActionType) getOperation() ent.ActionOperation {
	return ent.AddEdgeAction
}

var _ concreteEdgeActionType = &addEdgeActionType{}

type removeEdgeActionType struct {
}

func (action *removeEdgeActionType) getDefaultActionName(nodeName string, edge edge.ActionableEdge) string {
	return "Remove" + edge.EdgeIdentifier() + "Action"
}

func (action *removeEdgeActionType) getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string {
	// do we need the node?
	return strcase.ToLowerCamel(nodeName) + "Remove" + edge.EdgeIdentifier()
}

func (action *removeEdgeActionType) getAction(commonInfo commonActionInfo) Action {
	return getRemoveEdgeAction(commonInfo)
}

func (action *removeEdgeActionType) supportsFieldsFromEnt() bool {
	// hmm! technically not?? todo come back
	return true
}

func (action *removeEdgeActionType) getActionName() string {
	return "ent.RemoveEdgeAction"
}

func (action *removeEdgeActionType) getOperation() ent.ActionOperation {
	return ent.RemoveEdgeAction
}

var _ concreteEdgeActionType = &removeEdgeActionType{}

type groupEdgeActionType struct {
}

func (action *groupEdgeActionType) getDefaultActionName(nodeName string, edge edge.ActionableEdge) string {
	return fmt.Sprintf("Edit%s%sAction", strcase.ToCamel(nodeName), edge.EdgeIdentifier())
}

func (action *groupEdgeActionType) getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string {
	return fmt.Sprintf("%s%sEdit", nodeName, edge.EdgeIdentifier())
}

func (action *groupEdgeActionType) getAction(commonInfo commonActionInfo) Action {
	return getRemoveEdgeAction(commonInfo)
}

func (action *groupEdgeActionType) supportsFieldsFromEnt() bool {
	// hmm! technically not?? todo come back
	return true
}

func (action *groupEdgeActionType) getActionName() string {
	return "ent.EdgeGroupAction"
}

func (action *groupEdgeActionType) getOperation() ent.ActionOperation {
	return ent.EdgeGroupAction
}

var _ concreteEdgeActionType = &groupEdgeActionType{}

func getActionTypeFromString(typ string) actionType {
	switch typ {
	case "ent.CreateAction":
		return &createActionType{}
	case "ent.EditAction":
		return &editActionType{}
	case "ent.DeleteAction":
		return &deleteActionType{}
	case "ent.MutationsAction":
		return &mutationsActionType{}
	case "ent.AddEdgeAction":
		return &addEdgeActionType{}
	case "ent.RemoveEdgeAction":
		return &removeEdgeActionType{}
	case "ent.EdgeGroupAction":
		return &groupEdgeActionType{}
	}
	panic(fmt.Errorf("invalid action type passed %s", typ))
}

func getActionTypeFromOperation(op ent.ActionOperation) actionType {
	switch op {
	case ent.CreateAction:
		return &createActionType{}
	case ent.EditAction:
		return &editActionType{}
	case ent.DeleteAction:
		return &deleteActionType{}
	case ent.MutationsAction:
		return &mutationsActionType{}
	case ent.AddEdgeAction:
		return &addEdgeActionType{}
	case ent.RemoveEdgeAction:
		return &removeEdgeActionType{}
	case ent.EdgeGroupAction:
		return &groupEdgeActionType{}
	}
	panic(fmt.Errorf("invalid action type passed %v", op))
}

func getActionNameForNodeActionType(typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionName(nodeName)
}

func getGraphQLNameForNodeActionType(typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLName(nodeName)
}

func getInputNameForNodeActionType(typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultInputName(nodeName)
}

func getActionNameForEdgeActionType(
	typ concreteEdgeActionType,
	nodeName string,
	assocEdge *edge.AssociationEdge,
	customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionName(nodeName, assocEdge)
}

func getGraphQLNameForEdgeActionType(
	typ concreteEdgeActionType,
	nodeName string,
	assocEdge *edge.AssociationEdge,
	customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLName(nodeName, assocEdge)
}
