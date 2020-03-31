package action

import (
	"errors"
	"fmt"
	"math"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"

	"github.com/lolopinto/ent/internal/field"

	"github.com/lolopinto/ent/internal/astparser"
)

func getActionOperationFromTypeName(typeName string) ent.ActionOperation {
	switch typeName {
	case "ent.CreateAction":
		return ent.CreateAction
	case "ent.EditAction":
		return ent.EditAction
	case "ent.DeleteAction":
		return ent.DeleteAction
	case "ent.MutationsAction":
		return ent.MutationsAction
	case "ent.AddEdgeAction":
		return ent.AddEdgeAction
	case "ent.RemoveEdgeAction":
		return ent.RemoveEdgeAction
	case "ent.EdgeGroupAction":
		return ent.EdgeGroupAction
	}
	panic(fmt.Errorf("invalid action type passed %s", typeName))
}

func getInputAction(nodeName string, result *astparser.Result) (*input.Action, error) {
	var action input.Action
	for _, elem := range result.Elems {
		if elem.Value == nil {
			return nil, fmt.Errorf("elem with nil value")
		}

		switch elem.IdentName {
		case "Action":
			action.Operation = getActionOperationFromTypeName(elem.Value.GetTypeName())

		case "Fields":
			for _, child := range elem.Value.Elems {
				action.Fields = append(action.Fields, child.Literal)
			}

		case "CustomActionName":
			action.CustomActionName = elem.Value.Literal

		case "HideFromGraphQL":
			// exposeToGraphQL is inverse of HideFromGraphQL
			action.HideFromGraphQL = astparser.IsTrueBooleanResult(elem.Value)

		case "CustomGraphQLName":
			action.CustomGraphQLName = elem.Value.Literal
		}
	}

	return &action, nil
}

func parseActionsFromInput(nodeName string, action *input.Action, fieldInfo *field.FieldInfo) ([]Action, error) {
	exposeToGraphQL := !action.HideFromGraphQL
	typ := getActionTypeFromOperation(action.Operation)

	// create/edit/delete
	concreteAction, ok := typ.(concreteNodeActionType)
	if ok {
		fields, err := getFieldsForAction(action.Fields, fieldInfo, concreteAction)
		if err != nil {
			return nil, err
		}

		commonInfo := getCommonInfo(nodeName, concreteAction, action.CustomActionName, action.CustomGraphQLName, exposeToGraphQL, fields)
		return []Action{concreteAction.getAction(commonInfo)}, nil
	}

	_, ok = typ.(*mutationsActionType)
	if ok {
		if action.CustomActionName != "" {
			return nil, fmt.Errorf("cannot have a custom action name when using default actions")
		}
		if action.CustomGraphQLName != "" {
			return nil, fmt.Errorf("cannot have a custom graphql name when using default actions")
		}
		return getActionsForMutationsType(nodeName, fieldInfo, exposeToGraphQL, action.Fields)
	}

	return nil, errors.New("unsupported action type")
}

func getActionsForMutationsType(nodeName string, fieldInfo *field.FieldInfo, exposeToGraphQL bool, fieldNames []string) ([]Action, error) {
	var actions []Action

	createTyp := &createActionType{}
	fields, err := getFieldsForAction(fieldNames, fieldInfo, createTyp)
	if err != nil {
		return nil, err
	}
	actions = append(actions, getCreateAction(
		getCommonInfo(
			nodeName,
			createTyp,
			"",
			"",
			exposeToGraphQL,
			fields,
		),
	))

	editTyp := &editActionType{}
	fields, err = getFieldsForAction(fieldNames, fieldInfo, editTyp)
	if err != nil {
		return nil, err
	}
	actions = append(actions, getEditAction(
		getCommonInfo(
			nodeName,
			editTyp,
			"",
			"",
			exposeToGraphQL,
			fields,
		),
	))

	deleteTyp := &deleteActionType{}
	fields, err = getFieldsForAction(fieldNames, fieldInfo, deleteTyp)
	if err != nil {
		return nil, err
	}
	actions = append(actions, getDeleteAction(
		getCommonInfo(
			nodeName,
			deleteTyp,
			"",
			"",
			exposeToGraphQL,
			fields,
		),
	))
	return actions, nil
}

func getFieldsForAction(fieldNames []string, fieldInfo *field.FieldInfo, typ concreteNodeActionType) ([]*field.Field, error) {
	var fields []*field.Field
	if !typ.supportsFieldsFromEnt() {
		return fields, nil
	}

	// TODO
	// add ability to automatically add id field
	// add ability to automatically remove id field

	// no override of fields so we should get default fields
	if len(fieldNames) == 0 {
		for _, f := range fieldInfo.Fields {
			if f.ExposeToActionsByDefault() {
				fields = append(fields, f)
			}
		}
	} else {
		// if a field is explicitly referenced, we want to automatically add it
		for _, fieldName := range fieldNames {
			f := fieldInfo.GetFieldByName(fieldName)
			if f == nil {
				return nil, fmt.Errorf("invalid field name %s passed", fieldName)
			}
			fields = append(fields, f)
		}

	}
	return fields, nil
}

func getEdgeActionType(actionStr string) concreteEdgeActionType {
	var typ concreteEdgeActionType
	switch actionStr {
	case "ent.AddEdgeAction":
		typ = &addEdgeActionType{}
	case "ent.RemoveEdgeAction":
		typ = &removeEdgeActionType{}
	case "ent.EdgeGroupAction":
		typ = &groupEdgeActionType{}
	default:
		panic(fmt.Errorf("invalid action type %s for edge action", actionStr))
	}
	return typ
}

func processEdgeActions(nodeName string, assocEdge *edge.AssociationEdge) []Action {
	edgeActions := assocEdge.EdgeActions
	if len(edgeActions) == 0 {
		return nil
	}
	actions := make([]Action, len(edgeActions))

	for idx, edgeAction := range edgeActions {
		typ := getEdgeActionType(edgeAction.Action)

		actions[idx] = typ.getAction(
			getCommonInfoForEdgeAction(
				nodeName,
				assocEdge,
				typ,
				edgeAction,
				[]*edge.AssociationEdge{
					assocEdge,
				},
			),
		)
	}
	return actions
}

func processEdgeGroupActions(nodeName string, assocGroup *edge.AssociationEdgeGroup) []Action {
	edgeActions := assocGroup.EdgeActions
	if len(edgeActions) == 0 {
		return nil
	}
	actions := make([]Action, len(edgeActions))

	for idx, edgeAction := range edgeActions {
		typ := getEdgeActionType(edgeAction.Action)

		countGroupInfo := make(map[string]int)
		for _, edge := range assocGroup.Edges {
			nodeName := edge.NodeInfo.Node
			currentVal, ok := countGroupInfo[nodeName]
			if !ok {
				countGroupInfo[nodeName] = 1
			} else {
				countGroupInfo[nodeName] = currentVal + 1
			}
		}
		maxInt := math.MinInt64
		var node string

		for nodeName, count := range countGroupInfo {
			if count > maxInt {
				maxInt = count
				node = nodeName
			}
		}

		if node == "" {
			panic("invalid edge") // TODO
		}

		// how do I pass rsvp status??
		actions[idx] = typ.getAction(
			getCommonInfoForGroupEdgeAction(
				nodeName,
				assocGroup,
				typ,
				edgeAction,
				[]*NonEntField{
					&NonEntField{
						FieldName: assocGroup.GroupStatusName,
						FieldType: &enttype.StringType{},
						Flag:      "Enum",
					},
					&NonEntField{
						FieldName: strcase.ToCamel(node + "ID"),
						FieldType: &enttype.StringType{},
						Flag:      "ID",
						NodeType:  fmt.Sprintf("models.%sType", node), // TODO should take it from codegenInfo
					},
				},
			),
		)
	}
	return actions
}

// todo
func getCreateAction(commonInfo commonActionInfo) *CreateAction {
	return &CreateAction{
		commonActionInfo: commonInfo,
	}
}

func getEditAction(commonInfo commonActionInfo) *EditAction {
	return &EditAction{
		commonActionInfo: commonInfo,
	}
}

func getDeleteAction(commonInfo commonActionInfo) *DeleteAction {
	return &DeleteAction{
		commonActionInfo: commonInfo,
	}
}

func getAddEdgeAction(commonInfo commonActionInfo) *AddEdgeAction {
	return &AddEdgeAction{
		commonActionInfo: commonInfo,
	}
}

func getRemoveEdgeAction(commonInfo commonActionInfo) *RemoveEdgeAction {
	return &RemoveEdgeAction{
		commonActionInfo: commonInfo,
	}
}

func getGroupEdgeAction(commonInfo commonActionInfo) *EdgeGroupAction {
	return &EdgeGroupAction{
		commonActionInfo: commonInfo,
	}
}

func getCommonInfo(nodeName string, typ concreteNodeActionType, customActionName, customGraphQLName string, exposeToGraphQL bool, fields []*field.Field) commonActionInfo {
	var graphqlName string
	if exposeToGraphQL {
		graphqlName = getGraphQLNameForNodeActionType(typ, nodeName, customGraphQLName)
	}
	return commonActionInfo{
		ActionName:      getActionNameForNodeActionType(typ, nodeName, customActionName),
		GraphQLName:     graphqlName,
		ExposeToGraphQL: exposeToGraphQL,
		Fields:          fields,
		NodeInfo:        nodeinfo.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}

func getCommonInfoForEdgeAction(
	nodeName string,
	assocEdge *edge.AssociationEdge,
	typ concreteEdgeActionType,
	edgeAction *edge.EdgeAction,
	edges []*edge.AssociationEdge) commonActionInfo {
	var graphqlName string
	if edgeAction.ExposeToGraphQL {
		graphqlName = getGraphQLNameForEdgeActionType(typ, nodeName, assocEdge, edgeAction.CustomGraphQLName)
	}
	return commonActionInfo{
		ActionName:      getActionNameForEdgeActionType(typ, nodeName, assocEdge, edgeAction.CustomActionName),
		GraphQLName:     graphqlName,
		ExposeToGraphQL: edgeAction.ExposeToGraphQL,
		Edges:           edges,
		NodeInfo:        nodeinfo.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}

func getCommonInfoForGroupEdgeAction(
	nodeName string,
	assocEdgeGroup *edge.AssociationEdgeGroup,
	typ concreteEdgeActionType,
	edgeAction *edge.EdgeAction,
	fields []*NonEntField) commonActionInfo {
	var graphqlName, actionName string
	if edgeAction.ExposeToGraphQL {
		if edgeAction.CustomGraphQLName == "" {
			graphqlName = typ.getDefaultGraphQLName(nodeName, assocEdgeGroup)
		} else {
			graphqlName = edgeAction.CustomGraphQLName
		}
	}
	if edgeAction.CustomActionName == "" {
		actionName = typ.getDefaultActionName(nodeName, assocEdgeGroup)
	} else {
		actionName = edgeAction.CustomActionName
	}
	return commonActionInfo{
		ActionName:      actionName,
		GraphQLName:     graphqlName,
		ExposeToGraphQL: edgeAction.ExposeToGraphQL,
		NonEntFields:    fields,
		NodeInfo:        nodeinfo.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}
