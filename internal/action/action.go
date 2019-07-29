package action

import (
	"fmt"
	"go/ast"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"

	"github.com/lolopinto/ent/internal/field"

	"github.com/lolopinto/ent/internal/astparser"
)

// func getActionFromExpr(keyValueExpr *ast.KeyValueExpr) {
// 	name := astparser.GetTypeNameFromExpr(keyValueExpr.Value)
// 	// TODO come back
// 	switch name {
// 	case "ent.MutationsAction":
// 	case "ent.CreateAction":
// 	case "ent.EditAction":
// 	case "ent.DeleteAction":
// 	}
// }

func getFieldsFromExpr(keyValueExpr *ast.KeyValueExpr) []string {
	compositLit := astparser.GetExprToCompositeLit(keyValueExpr.Value)

	var fields []string
	for _, expr := range compositLit.Elts {
		field := astparser.GetUnderylingStringFromLiteralExpr(expr)

		fields = append(fields, field)
	}
	return fields
}

func parseActions(nodeName string, compositeLit *ast.CompositeLit, fieldInfo *field.FieldInfo) []Action {
	//	keyValueExpr *ast.KeyValueExpr) []Action {

	var customActionName string
	exposeToGraphQL := true
	var customGraphQLName string
	var fieldNames []string
	var actionTypeStr string

	for _, expr := range compositeLit.Elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)

		fieldName := astparser.GetExprToIdent(keyValueExpr.Key).Name

		switch fieldName {
		case "Action":
			actionTypeStr = astparser.GetTypeNameFromExpr(keyValueExpr.Value)

		case "Fields":
			fieldNames = getFieldsFromExpr(keyValueExpr)

		case "CustomActionName":
			customActionName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Value)

		case "HideFromGraphQL":
			// exposeToGraphQL is inverse of HideFromGraphQL
			exposeToGraphQL = !astparser.GetBooleanValueFromExpr(keyValueExpr.Value)

		case "CustomGraphQLName":
			customGraphQLName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Value)
		}
	}

	typ := getActionTypeFromString(actionTypeStr)

	// create/edit/delete
	concreteAction, ok := typ.(concreteNodeActionType)
	if ok {
		fields := getFieldsForAction(fieldNames, fieldInfo, actionTypeStr, concreteAction)

		commonInfo := getCommonInfo(nodeName, concreteAction, customActionName, customGraphQLName, exposeToGraphQL, fields)
		return []Action{concreteAction.getAction(commonInfo)}
	}

	_, ok = typ.(*mutationsActionType)
	if ok {
		if customActionName != "" {
			panic("cannot have a custom action name when using default actions")
		}
		if customGraphQLName != "" {
			panic("cannot have a custom graphql name when using default actions")
		}
		return getActionsForMutationsType(nodeName, fieldInfo, exposeToGraphQL, fieldNames)
	}

	panic("unsupported action type")
}

func getActionsForMutationsType(nodeName string, fieldInfo *field.FieldInfo, exposeToGraphQL bool, fieldNames []string) []Action {
	var actions []Action

	createTyp := &createActionType{}
	actions = append(actions, getCreateAction(
		getCommonInfo(
			nodeName,
			createTyp,
			"",
			"",
			exposeToGraphQL,
			getFieldsForAction(fieldNames, fieldInfo, "ent.CreateAction", createTyp),
		),
	))
	editTyp := &editActionType{}
	actions = append(actions, getEditAction(
		getCommonInfo(
			nodeName,
			editTyp,
			"",
			"",
			exposeToGraphQL,
			getFieldsForAction(fieldNames, fieldInfo, "ent.EditAction", createTyp),
		),
	))
	deleteTyp := &deleteActionType{}
	actions = append(actions, getDeleteAction(
		getCommonInfo(
			nodeName,
			deleteTyp,
			"",
			"",
			exposeToGraphQL,
			getFieldsForAction(fieldNames, fieldInfo, "ent.DeleteAction", deleteTyp),
		),
	))
	return actions
}

func getFieldsForAction(fieldNames []string, fieldInfo *field.FieldInfo, actionTypeStr string, typ concreteNodeActionType) []*field.Field {
	var fields []*field.Field
	if !typ.supportsFieldsFromEnt() {
		return fields
	}

	// TODO
	// add ability to automatically add id field
	// add ability to automatically remove id field

	// no override of fields so we should get default fields
	if len(fieldNames) == 0 {
		for _, f := range fieldInfo.Fields {
			if f.ExposeToActions() {
				fields = append(fields, f)
			}
		}
	} else {
		for _, fieldName := range fieldNames {
			f := fieldInfo.GetFieldByName(fieldName)
			if f == nil {
				panic(fmt.Errorf("invalid field name passed to %s", actionTypeStr))
			}
			if f.ExposeToActions() {
				fields = append(fields, f)
			}
		}

	}
	return fields
}

func processEdgeAction(nodeName string, assocEdge *edge.AssociationEdge) Action {
	edgeAction := assocEdge.EdgeAction

	var typ concreteEdgeActionType
	switch edgeAction.Action {
	case "ent.AddEdgeAction":
		typ = &addEdgeActionType{}
	case "ent.RemoveEdgeAction":
		typ = &removeEdgeActionType{}
	default:
		panic(fmt.Errorf("invalid action type %s for edge action", edgeAction.Action))
	}

	return typ.getAction(
		getCommonInfoForEdgeAction(
			nodeName,
			assocEdge.EdgeName,
			typ,
			edgeAction,
			[]*edge.AssociationEdge{
				assocEdge,
			},
		),
	)
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

func getCommonInfo(nodeName string, typ concreteNodeActionType, customActionName, customGraphQLName string, exposeToGraphQL bool, fields []*field.Field) commonActionInfo {
	var graphqlName string
	if exposeToGraphQL {
		graphqlName = getGraphQLNameForActionType(nodeName, typ, customGraphQLName)
	}
	return commonActionInfo{
		ActionName:      getActionNameForActionType(nodeName, typ, customActionName),
		GraphQLName:     graphqlName,
		ExposeToGraphQL: exposeToGraphQL,
		Fields:          fields,
		NodeInfo:        codegen.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}

func getCommonInfoForEdgeAction(
	nodeName,
	edgeName string,
	typ concreteEdgeActionType,
	edgeAction *edge.EdgeAction,
	// customActionName, customGraphQLName string,
	// exposeToGraphQL bool,
	edges []*edge.AssociationEdge) commonActionInfo {
	var graphqlName, actionName string
	if edgeAction.ExposeToGraphQL {
		if edgeAction.CustomGraphQLName == "" {
			graphqlName = typ.getDefaultGraphQLName(nodeName, edgeName)
		} else {
			graphqlName = edgeAction.CustomGraphQLName
		}
	}
	if edgeAction.CustomActionName == "" {
		actionName = typ.getDefaultActionName(nodeName, edgeName)
	} else {
		actionName = edgeAction.CustomActionName
	}
	return commonActionInfo{
		ActionName:      actionName,
		GraphQLName:     graphqlName,
		ExposeToGraphQL: edgeAction.ExposeToGraphQL,
		Edges:           edges, // TODO
		NodeInfo:        codegen.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}
