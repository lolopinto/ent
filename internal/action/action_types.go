package action

import (
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema/base"
)

type actionType interface {
	getActionVerb() string
}

type concreteActionType interface {
	actionType
	getAction(commonInfo commonActionInfo) Action
	getOperation() ent.ActionOperation
}

type concreteNodeActionType interface {
	concreteActionType
	getDefaultActionName(cfg codegenapi.Config, nodeName string) string
	getDefaultGraphQLName(cfg codegenapi.Config, nodeName string) string
	getDefaultActionInputName(cfg codegenapi.Config, nodeName string) string
	getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string) string
	getEditableFieldContext() field.EditableContext
	supportsFieldsFromEnt() bool
	mutatingExistingObject() bool
}

type concreteEdgeActionType interface {
	concreteActionType
	getDefaultActionName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge, lang base.Language) string
	getDefaultGraphQLName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string
	getDefaultActionInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string
	getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string
}

func nounVerb(cfg codegenapi.Config) bool {
	return cfg.DefaultGraphQLMutationName() == codegenapi.NounVerb
}

type createActionType struct {
}

func (action *createActionType) getDefaultActionName(cfg codegenapi.Config, nodeName string) string {
	return names.ToClassType("Create", nodeName, "Action")
}

func (action *createActionType) getDefaultGraphQLName(cfg codegenapi.Config, nodeName string) string {
	if nounVerb(cfg) {
		return names.ToGraphQLNameIgnoreSettings(nodeName, "Create")
	}
	return names.ToGraphQLNameIgnoreSettings("create", nodeName)
}

// CreateUserAction vs UserCreateInput is not consistent :(
// need to figure out gql mutation vs action naming convention
// but somehow choosing the same input type for both?
// TODO https://github.com/lolopinto/ent/issues/594
func (action *createActionType) getDefaultActionInputName(cfg codegenapi.Config, nodeName string) string {
	return names.ToClassType(nodeName, "CreateInput")
}

func (action *createActionType) getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string) string {
	// match the format of the input.
	// if verb_noun, change the graphql input to match the format
	// userCreate -> UserCreateInput
	// createUser -> CreateUserInput
	return names.ToClassType(action.getDefaultGraphQLName(cfg, nodeName), "Input")
}

func (action *createActionType) getAction(commonInfo commonActionInfo) Action {
	return getCreateAction(commonInfo)
}

func (action *createActionType) supportsFieldsFromEnt() bool {
	return true
}

func (action *createActionType) mutatingExistingObject() bool {
	return false
}

func (action *createActionType) getActionVerb() string {
	return "create"
}

func (action *createActionType) getOperation() ent.ActionOperation {
	return ent.CreateAction
}

func (action *createActionType) getEditableFieldContext() field.EditableContext {
	return field.CreateEditableContext
}

var _ concreteNodeActionType = &createActionType{}

type editActionType struct {
}

func (action *editActionType) getDefaultActionName(cfg codegenapi.Config, nodeName string) string {
	return names.ToClassType("Edit", nodeName, "Action")
}

func (action *editActionType) getDefaultGraphQLName(cfg codegenapi.Config, nodeName string) string {
	if nounVerb(cfg) {
		return names.ToGraphQLNameIgnoreSettings(nodeName, "Edit")
	}
	return names.ToGraphQLNameIgnoreSettings("edit", nodeName)
}

func (action *editActionType) getDefaultActionInputName(cfg codegenapi.Config, nodeName string) string {
	return names.ToClassType(nodeName, "EditInput")
}

func (action *editActionType) getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string) string {
	// match the format of the input.
	// if verb_noun, change the graphql input to match the format
	// userEdit -> UserEditInput
	// editUser -> EditUserInput
	return names.ToClassType(action.getDefaultGraphQLName(cfg, nodeName), "Input")
}

func (action *editActionType) getAction(commonInfo commonActionInfo) Action {
	return getEditAction(commonInfo)
}

func (action *editActionType) supportsFieldsFromEnt() bool {
	return true
}

func (action *editActionType) getActionVerb() string {
	return "edit"
}

func (action *editActionType) getOperation() ent.ActionOperation {
	return ent.EditAction
}

func (action *editActionType) getEditableFieldContext() field.EditableContext {
	return field.EditEditableContext
}

func (action *editActionType) mutatingExistingObject() bool {
	return true
}

var _ concreteNodeActionType = &editActionType{}

type deleteActionType struct {
}

func (action *deleteActionType) getDefaultActionName(cfg codegenapi.Config, nodeName string) string {
	return names.ToClassType("Delete", nodeName, "Action")
}

func (action *deleteActionType) getDefaultGraphQLName(cfg codegenapi.Config, nodeName string) string {
	if nounVerb(cfg) {
		return names.ToGraphQLNameIgnoreSettings(nodeName, "Delete")
	}
	return names.ToGraphQLNameIgnoreSettings("delete", nodeName)
}

func (action *deleteActionType) getDefaultActionInputName(cfg codegenapi.Config, nodeName string) string {
	// TODO why is this being called?
	return names.ToClassType(nodeName, "DeleteInput")
}

func (action *deleteActionType) getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string) string {
	return names.ToClassType(action.getDefaultGraphQLName(cfg, nodeName), "Input")
}

func (action *deleteActionType) getAction(commonInfo commonActionInfo) Action {
	return getDeleteAction(commonInfo)
}

func (action *deleteActionType) supportsFieldsFromEnt() bool {
	return false
}

func (action *deleteActionType) getActionVerb() string {
	return "delete"
}

func (action *deleteActionType) getOperation() ent.ActionOperation {
	return ent.DeleteAction
}

func (action *deleteActionType) getEditableFieldContext() field.EditableContext {
	return field.DeleteEditableContext
}

func (action *deleteActionType) mutatingExistingObject() bool {
	return true
}

var _ concreteNodeActionType = &deleteActionType{}

type mutationsActionType struct {
}

func (action *mutationsActionType) getActionVerb() string {
	return "mutations"
}

var _ actionType = &mutationsActionType{}

type addEdgeActionType struct {
}

func (action *addEdgeActionType) getDefaultActionName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge, lang base.Language) string {
	// in golang, it'll be referred to as user.AddFriend so we don't want the name in there
	// but that's not the norm in TypeScript so we want the name in here for TypeScript
	if lang == base.TypeScript {
		return names.ToClassType(nodeName, "Add", edge.EdgeIdentifier(), "Action")
	}
	return "Add" + edge.EdgeIdentifier() + "Action"
}

func (action *addEdgeActionType) getDefaultGraphQLName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	if nounVerb(cfg) {
		// eventAddInvitee
		return names.ToGraphQLNameIgnoreSettings(nodeName, "Add", edge.EdgeIdentifier())
	}
	// addEventInvite
	return names.ToGraphQLNameIgnoreSettings("add", nodeName, edge.EdgeIdentifier())
}

func (action *addEdgeActionType) getDefaultActionInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	// TODO only used in TS right now
	return names.ToClassType(nodeName, "Add", edge.EdgeIdentifier(), "Input")
}

func (action *addEdgeActionType) getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	return names.ToClassType(action.getDefaultGraphQLName(cfg, nodeName, edge), "Input")
}

func (action *addEdgeActionType) getAction(commonInfo commonActionInfo) Action {
	return getAddEdgeAction(commonInfo)
}

func (action *addEdgeActionType) getActionVerb() string {
	return "add edge"
}

func (action *addEdgeActionType) getOperation() ent.ActionOperation {
	return ent.AddEdgeAction
}

var _ concreteEdgeActionType = &addEdgeActionType{}

type removeEdgeActionType struct {
}

func (action *removeEdgeActionType) getDefaultActionName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge, lang base.Language) string {
	// see addEdgeActionType up
	if lang == base.TypeScript {
		return names.ToClassType(nodeName, "Remove", edge.EdgeIdentifier(), "Action")
	}
	return names.ToClassType(nodeName, "Remove", edge.EdgeIdentifier(), "Action")
}

func (action *removeEdgeActionType) getDefaultGraphQLName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	// do we need the node?
	if nounVerb(cfg) {
		return names.ToGraphQLNameIgnoreSettings(nodeName, "Remove", edge.EdgeIdentifier())
	}
	return names.ToGraphQLNameIgnoreSettings("remove", nodeName, edge.EdgeIdentifier())
}

func (action *removeEdgeActionType) getDefaultActionInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	// TODO only used in TS for now
	return names.ToClassType(nodeName, "Remove", edge.EdgeIdentifier(), "Input")
}

func (action *removeEdgeActionType) getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	return names.ToClassType(action.getDefaultGraphQLName(cfg, nodeName, edge), "Input")
}

func (action *removeEdgeActionType) getAction(commonInfo commonActionInfo) Action {
	return getRemoveEdgeAction(commonInfo)
}

func (action *removeEdgeActionType) getActionVerb() string {
	return "remove edge"
}

func (action *removeEdgeActionType) getOperation() ent.ActionOperation {
	return ent.RemoveEdgeAction
}

var _ concreteEdgeActionType = &removeEdgeActionType{}

type groupEdgeActionType struct {
}

func (action *groupEdgeActionType) getDefaultActionName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge, lang base.Language) string {
	return names.ToClassType("Edit", nodeName, edge.EdgeIdentifier(), "Action")
}

func (action *groupEdgeActionType) getDefaultActionInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	return names.ToClassType("Edit", nodeName, edge.EdgeIdentifier(), "Input")
}

func (action *groupEdgeActionType) getDefaultGraphQLInputName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	return names.ToClassType(action.getDefaultGraphQLName(cfg, nodeName, edge), "Input")
}

func (action *groupEdgeActionType) getDefaultGraphQLName(cfg codegenapi.Config, nodeName string, edge edge.ActionableEdge) string {
	if nounVerb(cfg) {
		return names.ToGraphQLNameIgnoreSettings(nodeName, edge.EdgeIdentifier(), "Edit")
	}
	return names.ToGraphQLNameIgnoreSettings(edge.EdgeIdentifier(), nodeName, "Edit")
}

func (action *groupEdgeActionType) getAction(commonInfo commonActionInfo) Action {
	return getRemoveEdgeAction(commonInfo)
}

func (action *groupEdgeActionType) getActionVerb() string {
	return "edge group"
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

func getActionNameForNodeActionType(cfg codegenapi.Config, typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionName(cfg, nodeName)
}

func getGraphQLNameForNodeActionType(cfg codegenapi.Config, typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLName(cfg, nodeName)
}

func getActionInputNameForNodeActionType(cfg codegenapi.Config, typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionInputName(cfg, nodeName)
}

func getGraphQLInputNameForNodeActionType(cfg codegenapi.Config, typ concreteNodeActionType, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLInputName(cfg, nodeName)
}

func getActionNameForEdgeActionType(
	cfg codegenapi.Config,
	typ concreteEdgeActionType,
	nodeName string,
	assocEdge *edge.AssociationEdge,
	customName string,
	lang base.Language,
) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionName(cfg, nodeName, assocEdge, lang)
}

func getGraphQLNameForEdgeActionType(
	cfg codegenapi.Config,
	typ concreteEdgeActionType,
	nodeName string,
	assocEdge *edge.AssociationEdge,
	customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLName(cfg, nodeName, assocEdge)
}

func getActionInputNameForEdgeActionType(cfg codegenapi.Config, typ concreteEdgeActionType, edge edge.ActionableEdge, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionInputName(cfg, nodeName, edge)
}

func getGraphQLInputNameForEdgeActionType(cfg codegenapi.Config, typ concreteEdgeActionType, edge edge.ActionableEdge, nodeName, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLInputName(cfg, nodeName, edge)
}
