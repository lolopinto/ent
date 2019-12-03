package action

import (
	"fmt"
	"go/ast"
	"math"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
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
						FieldType: &field.StringType{},
						Flag:      "Enum",
					},
					&NonEntField{
						FieldName: strcase.ToCamel(node + "ID"),
						FieldType: &field.StringType{},
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
