package action

import (
	"fmt"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/schema/base"
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
	getDefaultActionName(nodeName string, edge edge.ActionableEdge, lang base.Language) string
	getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string
	getDefaultInputName(nodeName string, edge edge.ActionableEdge) string
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
	// TODO why is this being called?
	return strcase.ToCamel(nodeName) + "DeleteInput"
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

func (action *addEdgeActionType) getDefaultActionName(nodeName string, edge edge.ActionableEdge, lang base.Language) string {
	// in golang, it'll be referred to as user.AddFriend so we don't want the name in there
	// but that's not the norm in TypeScript so we want the name in here for TypeScript
	if lang == base.TypeScript {
		return strcase.ToCamel(nodeName) + "Add" + edge.EdgeIdentifier() + "Action"
	}
	return "Add" + edge.EdgeIdentifier() + "Action"
}

func (action *addEdgeActionType) getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string {
	// eventAddInvitee
	return strcase.ToLowerCamel(nodeName) + "Add" + strcase.ToCamel(edge.EdgeIdentifier())
}

func (action *addEdgeActionType) getDefaultInputName(nodeName string, edge edge.ActionableEdge) string {
	// TODO only used in TS right now
	return strcase.ToCamel(nodeName) + "Add" + strcase.ToCamel(edge.EdgeIdentifier()) + "Input"
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

func (action *removeEdgeActionType) getDefaultActionName(nodeName string, edge edge.ActionableEdge, lang base.Language) string {
	// see addEdgeActionType up
	if lang == base.TypeScript {
		return strcase.ToCamel(nodeName) + "Remove" + edge.EdgeIdentifier() + "Action"
	}
	return "Remove" + strcase.ToCamel(edge.EdgeIdentifier()) + "Action"
}

func (action *removeEdgeActionType) getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string {
	// do we need the node?
	return strcase.ToLowerCamel(nodeName) + "Remove" + strcase.ToCamel(edge.EdgeIdentifier())
}

func (action *removeEdgeActionType) getDefaultInputName(nodeName string, edge edge.ActionableEdge) string {
	// TODO only used in TS for now
	return strcase.ToCamel(nodeName) + "Remove" + strcase.ToCamel(edge.EdgeIdentifier()) + "Input"
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

func (action *groupEdgeActionType) getDefaultActionName(nodeName string, edge edge.ActionableEdge, lang base.Language) string {
	return fmt.Sprintf("Edit%s%sAction", strcase.ToCamel(nodeName), strcase.ToCamel(edge.EdgeIdentifier()))
}

func (action *groupEdgeActionType) getDefaultInputName(nodeName string, edge edge.ActionableEdge) string {
	return fmt.Sprintf("Edit%s%sInput", strcase.ToCamel(nodeName), strcase.ToCamel(edge.EdgeIdentifier()))
}

func (action *groupEdgeActionType) getDefaultGraphQLName(nodeName string, edge edge.ActionableEdge) string {
	return fmt.Sprintf("%s%sEdit", strcase.ToLowerCamel(nodeName), strcase.ToCamel(edge.EdgeIdentifier()))
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

func getActionTypeFromOperation(op ent.ActionOperation) (actionType, error) {
	switch op {
	case ent.CreateAction:
		return &createActionType{}, nil
	case ent.EditAction:
		return &editActionType{}, nil
	case ent.DeleteAction:
		return &deleteActionType{}, nil
	case ent.MutationsAction:
		return &mutationsActionType{}, nil
	case ent.AddEdgeAction:
		return &addEdgeActionType{}, nil
	case ent.RemoveEdgeAction:
		return &removeEdgeActionType{}, nil
	case ent.EdgeGroupAction:
		return &groupEdgeActionType{}, nil
	}
	return nil, fmt.Errorf("invalid action type passed %v", op)
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
	customName string,
	lang base.Language,
) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionName(nodeName, assocEdge, lang)
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

func getInputNameForEdgeActionType(typ concreteEdgeActionType, edge edge.ActionableEdge, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultInputName(nodeName, edge)
}
