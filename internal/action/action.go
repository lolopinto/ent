package action

import (
	"errors"
	"fmt"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"

	"github.com/lolopinto/ent/internal/field"

	"github.com/lolopinto/ent/internal/astparser"
)

// copied to internal/edge/edge.go
func getActionOperationFromTypeName(typeName string) (ent.ActionOperation, error) {
	switch typeName {
	case "ent.CreateAction":
		return ent.CreateAction, nil
	case "ent.EditAction":
		return ent.EditAction, nil
	case "ent.DeleteAction":
		return ent.DeleteAction, nil
	case "ent.MutationsAction":
		return ent.MutationsAction, nil
	case "ent.AddEdgeAction":
		return ent.AddEdgeAction, nil
	case "ent.RemoveEdgeAction":
		return ent.RemoveEdgeAction, nil
	case "ent.EdgeGroupAction":
		return ent.EdgeGroupAction, nil
	}
	return 0, fmt.Errorf("invalid action type passed %s", typeName)
}

func getInputAction(nodeName string, result *astparser.Result) (*input.Action, error) {
	var action input.Action
	for _, elem := range result.Elems {
		if elem.Value == nil {
			return nil, fmt.Errorf("elem with nil value")
		}

		switch elem.IdentName {
		case "Action":
			var err error
			action.Operation, err = getActionOperationFromTypeName(elem.Value.GetTypeName())
			if err != nil {
				return nil, err
			}

		case "Fields":
			for _, child := range elem.Value.Elems {
				action.Fields = append(action.Fields, child.Literal)
			}

		case "CustomActionName":
			action.CustomActionName = elem.Value.Literal

		case "HideFromGraphQL":
			action.HideFromGraphQL = astparser.IsTrueBooleanResult(elem.Value)

		case "CustomGraphQLName":
			action.CustomGraphQLName = elem.Value.Literal

		case "CustomInputName":
			action.CustomInputName = elem.Value.Literal
		}
	}

	return &action, nil
}

func parseActionsFromInput(nodeName string, action *input.Action, fieldInfo *field.FieldInfo) ([]Action, error) {
	// exposeToGraphQL is inverse of HideFromGraphQL
	exposeToGraphQL := !action.HideFromGraphQL
	typ, err := getActionTypeFromOperation(action.Operation)
	if err != nil {
		return nil, err
	}

	// create/edit/delete
	concreteAction, ok := typ.(concreteNodeActionType)
	if ok {
		fields, err := getFieldsForAction(action.Fields, fieldInfo, concreteAction)
		if err != nil {
			return nil, err
		}

		nonEntFields, err := getNonEntFieldsFromInput(nodeName, action, concreteAction)
		if err != nil {
			return nil, err
		}

		commonInfo := getCommonInfo(
			nodeName,
			concreteAction,
			action.CustomActionName,
			action.CustomGraphQLName,
			action.CustomInputName,
			exposeToGraphQL,
			fields,
			nonEntFields,
		)
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
		if len(action.ActionOnlyFields) != 0 {
			return nil, fmt.Errorf("cannot have action only fields when using default actions")
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
			"",
			exposeToGraphQL,
			fields,
			[]*NonEntField{},
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
			"",
			exposeToGraphQL,
			fields,
			[]*NonEntField{},
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
			"",
			exposeToGraphQL,
			fields,
			[]*NonEntField{},
		),
	))
	return actions, nil
}

const noFields = "__NO_FIELDS__"

func getFieldsForAction(fieldNames []string, fieldInfo *field.FieldInfo, typ concreteNodeActionType) ([]*field.Field, error) {
	var fields []*field.Field
	if !typ.supportsFieldsFromEnt() {
		return fields, nil
	}

	// TODO
	// add ability to automatically add id field
	// add ability to automatically remove id field

	// provides a way to say this action doesn't have any fields
	if len(fieldNames) == 1 && fieldNames[0] == noFields {
		return fields, nil
	}
	// no override of fields so we should get default fields
	if len(fieldNames) == 0 {
		for _, f := range fieldInfo.Fields {
			if f.ExposeToActionsByDefault() {
				fields = append(fields, f)
			}
		}
	} else if fieldInfo != nil {
		// if a field is explicitly referenced, we want to automatically add it
		for _, fieldName := range fieldNames {
			parts := strings.Split(fieldName, ".")
			var required bool
			var optional bool
			if len(parts) == 3 && parts[0] == parts[2] {
				fieldName = parts[1]
				switch parts[0] {
				case "__required__":
					required = true

				case "__optional__":
					optional = true

				}
			}
			f := fieldInfo.GetFieldByName(fieldName)
			if f == nil {
				return nil, fmt.Errorf("invalid field name %s passed", fieldName)
			}
			f2 := f
			// required and edit field. force it to be required
			// required. if optional or nullable, now field is required
			// or field is now required in an edit mutation, by default, all fields are required...
			if required {
				// required
				var err error
				f2, err = f.Clone(field.Required())
				if err != nil {
					return nil, err
				}
			}
			if optional {
				// optional
				var err error
				f2, err = f.Clone(field.Optional())
				if err != nil {
					return nil, err
				}
			}
			fields = append(fields, f2)
		}

	}
	return fields, nil
}

func getNonEntFieldsFromInput(nodeName string, action *input.Action, typ concreteNodeActionType) ([]*NonEntField, error) {
	var fields []*NonEntField

	inputName := getInputNameForNodeActionType(typ, nodeName, action.CustomInputName)

	for _, field := range action.ActionOnlyFields {
		typ, err := field.GetEntType(inputName)
		if err != nil {
			return nil, err
		}
		fields = append(fields, &NonEntField{
			FieldName: field.Name,
			FieldType: typ,
			Nullable:  field.Nullable,
		})
	}
	return fields, nil
}

func getNonEntFieldsFromAssocGroup(
	nodeName string,
	assocGroup *edge.AssociationEdgeGroup,
	action *edge.EdgeAction,
	typ concreteEdgeActionType,
) ([]*NonEntField, error) {
	var fields []*NonEntField

	inputName := getInputNameForEdgeActionType(typ, assocGroup, nodeName, "")

	for _, field := range action.ActionOnlyFields {
		typ, err := field.GetEntType(inputName)
		if err != nil {
			return nil, err
		}
		fields = append(fields, &NonEntField{
			FieldName: field.Name,
			FieldType: typ,
			Nullable:  field.Nullable,
		})
	}
	return fields, nil
}

func getEdgeActionType(actionStr string) (concreteEdgeActionType, error) {
	var typ concreteEdgeActionType
	switch actionStr {
	case "ent.AddEdgeAction":
		typ = &addEdgeActionType{}
	case "ent.RemoveEdgeAction":
		typ = &removeEdgeActionType{}
	case "ent.EdgeGroupAction":
		typ = &groupEdgeActionType{}
	default:
		return nil, fmt.Errorf("invalid action type %s for edge action", actionStr)
	}
	return typ, nil
}

func processEdgeActions(nodeName string, assocEdge *edge.AssociationEdge, lang base.Language) ([]Action, error) {
	edgeActions := assocEdge.EdgeActions
	if len(edgeActions) == 0 {
		return nil, nil
	}
	actions := make([]Action, len(edgeActions))

	for idx, edgeAction := range edgeActions {
		typ, err := getEdgeActionType(edgeAction.Action)
		if err != nil {
			return nil, err
		}

		actions[idx] = typ.getAction(
			getCommonInfoForEdgeAction(
				nodeName,
				assocEdge,
				typ,
				edgeAction,
				lang,
				[]*edge.AssociationEdge{
					assocEdge,
				},
			),
		)
	}
	return actions, nil
}

func processEdgeGroupActions(nodeName string, assocGroup *edge.AssociationEdgeGroup, lang base.Language) ([]Action, error) {
	edgeActions := assocGroup.EdgeActions
	if len(edgeActions) == 0 {
		return nil, nil
	}
	actions := make([]Action, len(edgeActions))

	for idx, edgeAction := range edgeActions {
		typ, err := getEdgeActionType(edgeAction.Action)
		if err != nil {
			return nil, err
		}

		var tsEnums []*enum.Enum
		var gqlEnums []*enum.GQLEnum
		var fields []*NonEntField
		if lang == base.GoLang {
			fields = []*NonEntField{
				{
					FieldName: assocGroup.GroupStatusName,
					FieldType: &enttype.StringType{},
					Flag:      "Enum",
				},
				{
					FieldName: strcase.ToCamel(assocGroup.DestNodeInfo.Node + "ID"),
					FieldType: &enttype.StringType{},
					Flag:      "ID",
					NodeType:  fmt.Sprintf("models.%sType", assocGroup.DestNodeInfo.Node), // TODO should take it from codegenInfo
				},
			}
		} else {
			values := assocGroup.GetStatusValues()
			typ := fmt.Sprintf("%sInput", assocGroup.ConstType)

			fields = []*NonEntField{
				{
					FieldName: assocGroup.TSGroupStatusName,
					FieldType: &enttype.EnumType{
						Values:      values,
						Type:        typ,
						GraphQLType: typ,
					},
				},
				{
					FieldName: assocGroup.GetIDArg(),
					FieldType: &enttype.IDType{},
				},
			}

			tsEnum, gqlEnum := enum.GetEnums(&enum.Input{
				TSName:  typ,
				GQLName: typ,
				GQLType: typ,
				Values:  values,
			})
			tsEnums = append(tsEnums, tsEnum)
			gqlEnums = append(gqlEnums, gqlEnum)
		}
		nonEntFields, err := getNonEntFieldsFromAssocGroup(nodeName, assocGroup, edgeAction, typ)
		if err != nil {
			return nil, err
		}
		fields = append(fields, nonEntFields...)

		commonInfo := getCommonInfoForGroupEdgeAction(nodeName,
			assocGroup,
			typ,
			edgeAction,
			lang,
			fields,
		)
		commonInfo.tsEnums = tsEnums
		commonInfo.gqlEnums = gqlEnums
		commonInfo.EdgeGroup = assocGroup

		actions[idx] = typ.getAction(commonInfo)
	}
	return actions, nil
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

func getCommonInfo(
	nodeName string,
	typ concreteNodeActionType,
	customActionName, customGraphQLName, customInputName string,
	exposeToGraphQL bool,
	fields []*field.Field,
	nonEntFields []*NonEntField) commonActionInfo {
	var graphqlName string
	if exposeToGraphQL {
		graphqlName = getGraphQLNameForNodeActionType(typ, nodeName, customGraphQLName)
	}
	return commonActionInfo{
		ActionName:  getActionNameForNodeActionType(typ, nodeName, customActionName),
		GraphQLName: graphqlName,
		// TODO need to break into graphql vs not?
		InputName:       getInputNameForNodeActionType(typ, nodeName, customInputName),
		ExposeToGraphQL: exposeToGraphQL,
		Fields:          fields,
		NonEntFields:    nonEntFields,
		NodeInfo:        nodeinfo.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}

func getCommonInfoForEdgeAction(
	nodeName string,
	assocEdge *edge.AssociationEdge,
	typ concreteEdgeActionType,
	edgeAction *edge.EdgeAction,
	lang base.Language,
	edges []*edge.AssociationEdge) commonActionInfo {
	var graphqlName string
	if edgeAction.ExposeToGraphQL {
		graphqlName = getGraphQLNameForEdgeActionType(typ, nodeName, assocEdge, edgeAction.CustomGraphQLName)
	}
	return commonActionInfo{
		ActionName:      getActionNameForEdgeActionType(typ, nodeName, assocEdge, edgeAction.CustomActionName, lang),
		GraphQLName:     graphqlName,
		InputName:       typ.getDefaultInputName(nodeName, assocEdge),
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
	lang base.Language,
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
		actionName = typ.getDefaultActionName(nodeName, assocEdgeGroup, lang)
	} else {
		actionName = edgeAction.CustomActionName
	}
	return commonActionInfo{
		ActionName:      actionName,
		GraphQLName:     graphqlName,
		InputName:       typ.getDefaultInputName(nodeName, assocEdgeGroup),
		ExposeToGraphQL: edgeAction.ExposeToGraphQL,
		NonEntFields:    fields,
		NodeInfo:        nodeinfo.GetNodeInfo(nodeName),
		Operation:       typ.getOperation(),
	}
}
