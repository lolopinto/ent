package action

import (
	"fmt"
	"go/ast"

	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/codegen"

	"github.com/lolopinto/ent/internal/field"

	"github.com/iancoleman/strcase"

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
			ident := astparser.GetExprToIdent(keyValueExpr.Value)
			exposeToGraphQL = ident.Name != "true" // only values should be "true" or "false"

		case "CustomGraphQLName":
			customGraphQLName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Value)
		}
	}

	typ := getActionTypeFromString(actionTypeStr)

	// create/edit/delete
	concreteAction, ok := typ.(concreteActionType)
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

func getFieldsForAction(fieldNames []string, fieldInfo *field.FieldInfo, actionTypeStr string, typ concreteActionType) []*field.Field {
	var fields []*field.Field
	if !typ.supportsFieldsFromEnt() {
		return fields
	}

	// TODO
	// add ability to automatically add id field
	// add ability to automatically remove id field

	// no override of fields so we should get default fields
	if len(fields) == 0 {
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

func getCommonInfo(nodeName string, typ concreteActionType, customActionName, customGraphQLName string, exposeToGraphQL bool, fields []*field.Field) commonActionInfo {
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

type concreteActionType interface {
	actionType
	getDefaultActionName(nodeName string) string
	getDefaultGraphQLName(nodeName string) string
	supportsFieldsFromEnt() bool
	getAction(commonInfo commonActionInfo) Action
	getOperation() ent.ActionOperation
}

type actionType interface {
	getActionName() string
}

// type actionTypeWithFields interface {
// 	getAction(commonInfo commonActionInfo, fields []*field.Field) Action
// }

// type actionTypeWithoutFields interface {
// 	getAction(commonInfo commonActionInfo) Action
// }

type createActionType struct {
}

func (action *createActionType) getDefaultActionName(nodeName string) string {
	return "Create" + strcase.ToCamel(nodeName) + "Action"
}

func (action *createActionType) getDefaultGraphQLName(nodeName string) string {
	return nodeName + "Create"
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

var _ concreteActionType = &createActionType{}

type editActionType struct {
}

func (action *editActionType) getDefaultActionName(nodeName string) string {
	return "Edit" + strcase.ToCamel(nodeName) + "Action"
}

func (action *editActionType) getDefaultGraphQLName(nodeName string) string {
	return nodeName + "Edit"
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

var _ concreteActionType = &editActionType{}

type deleteActionType struct {
}

func (action *deleteActionType) getDefaultActionName(nodeName string) string {
	return "Delete" + strcase.ToCamel(nodeName) + "Action"
}

func (action *deleteActionType) getDefaultGraphQLName(nodeName string) string {
	return nodeName + "Delete"
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

var _ concreteActionType = &deleteActionType{}

type mutationsActionType struct {
}

func (action *mutationsActionType) getActionName() string {
	return "ent.MutationsAction"
}

var _ actionType = &mutationsActionType{}

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
	}
	panic(fmt.Errorf("invalid action type passed %s", typ))
}

func getActionNameForActionType(nodeName string, typ concreteActionType, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultActionName(nodeName)
}

func getGraphQLNameForActionType(nodeName string, typ concreteActionType, customName string) string {
	if customName != "" {
		return customName
	}
	return typ.getDefaultGraphQLName(nodeName)
}
