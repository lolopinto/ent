package action

import (
	"errors"
	"fmt"
	"path"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"

	"github.com/lolopinto/ent/internal/field"
)

func parseActionsFromInput(cfg codegenapi.Config, nodeName string, action *input.Action, fieldInfo *field.FieldInfo, opt *option) ([]Action, error) {
	// exposeToGraphQL is inverse of HideFromGraphQL
	exposeToGraphQL := !action.HideFromGraphQL
	typ, err := getActionTypeFromOperation(action.Operation)
	if err != nil {
		return nil, err
	}

	// create/edit/delete
	concreteAction, ok := typ.(concreteNodeActionType)
	if ok {
		fields, primaryKeyField, err := getFieldsForAction(nodeName, action, fieldInfo, concreteAction)
		if err != nil {
			return nil, err
		}

		nonEntFields, err := getNonEntFieldsFromInput(cfg, nodeName, action, concreteAction)
		if err != nil {
			return nil, err
		}

		opt.primaryKeyField = primaryKeyField

		commonInfo := getCommonInfo(
			cfg,
			nodeName,
			concreteAction,
			action.CustomActionName,
			action.CustomGraphQLName,
			action.CustomInputName,
			exposeToGraphQL,
			fields,
			nonEntFields,
			opt,
		)
		commonInfo.canViewerDo = action.CanViewerDo
		commonInfo.canFail = action.CanFail
		_, ok = typ.(*createActionType)
		if ok && commonInfo.canFail {
			return nil, fmt.Errorf("can fail is currently not supported with create actions")
		}
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
		return getActionsForMutationsType(cfg, nodeName, fieldInfo, exposeToGraphQL, action, opt)
	}

	return nil, errors.New("unsupported action type")
}

func getActionsForMutationsType(cfg codegenapi.Config, nodeName string, fieldInfo *field.FieldInfo, exposeToGraphQL bool, action *input.Action, opt *option) ([]Action, error) {
	var actions []Action

	createTyp := &createActionType{}
	fields, primaryKeyField, err := getFieldsForAction(nodeName, action, fieldInfo, createTyp)
	if err != nil {
		return nil, err
	}
	opt.primaryKeyField = primaryKeyField
	actions = append(actions, getCreateAction(
		getCommonInfo(
			cfg,
			nodeName,
			createTyp,
			"",
			"",
			"",
			exposeToGraphQL,
			fields,
			[]*field.NonEntField{},
			opt,
		),
	))

	editTyp := &editActionType{}
	fields, primaryKeyField, err = getFieldsForAction(nodeName, action, fieldInfo, editTyp)
	if err != nil {
		return nil, err
	}
	opt.primaryKeyField = primaryKeyField
	actions = append(actions, getEditAction(
		getCommonInfo(
			cfg,
			nodeName,
			editTyp,
			"",
			"",
			"",
			exposeToGraphQL,
			fields,
			[]*field.NonEntField{},
			opt,
		),
	))

	deleteTyp := &deleteActionType{}
	fields, primaryKeyField, err = getFieldsForAction(nodeName, action, fieldInfo, deleteTyp)
	opt.primaryKeyField = primaryKeyField
	if err != nil {
		return nil, err
	}
	actions = append(actions, getDeleteAction(
		getCommonInfo(
			cfg,
			nodeName,
			deleteTyp,
			"",
			"",
			"",
			exposeToGraphQL,
			fields,
			[]*field.NonEntField{},
			opt,
		),
	))
	return actions, nil
}

// provides a way to say this action doesn't have any fields
const NO_FIELDS = "__NO_FIELDS__"

func getFieldsForAction(nodeName string, action *input.Action, fieldInfo *field.FieldInfo, typ concreteNodeActionType) ([]*field.Field, *field.Field, error) {
	var primaryKeyField *field.Field

	if fieldInfo != nil && typ.mutatingExistingObject() {
		for _, f := range fieldInfo.EntFields() {
			if f.SingleFieldPrimaryKey() {
				primaryKeyField = f
				break
			}
		}
	}

	var fields []*field.Field
	if !typ.supportsFieldsFromEnt() {
		return fields, primaryKeyField, nil
	}

	fieldNames := action.Fields

	excludedFields := make(map[string]bool)
	requiredFields := make(map[string]bool)
	optionalFields := make(map[string]bool)
	noFields := action.NoFields || len(fieldNames) == 1 && fieldNames[0] == NO_FIELDS

	for _, f := range action.ExcludedFields {
		excludedFields[f] = true
	}
	for _, f := range action.RequiredFields {
		requiredFields[f] = true
	}
	for _, f := range action.OptionalFields {
		optionalFields[f] = true
	}

	if len(fieldNames) != 0 && len(excludedFields) != 0 {
		return nil, nil, fmt.Errorf("cannot provide both fields and excluded fields")
	}

	if noFields {
		return fields, primaryKeyField, nil
	}

	getField := func(f *field.Field, fieldName string) (*field.Field, error) {
		var required bool
		var optional bool

		if fieldName != "" {
			parts := strings.Split(fieldName, ".")

			if len(parts) == 3 && parts[0] == parts[2] {
				fieldName = parts[1]
				switch parts[0] {
				case "__required__":
					required = true

				case "__optional__":
					optional = true
				}
			}
		}
		if f == nil {
			f = fieldInfo.GetFieldByName(fieldName)
			if f == nil {
				name := action.CustomActionName
				if name != "" {
					return nil, fmt.Errorf("invalid field name `%s` passed to action `%s`", fieldName, action.CustomActionName)
				}

				return nil, fmt.Errorf("invalid field name `%s` passed to `%s` action for node `%s`", fieldName, typ.getActionVerb(), strcase.ToCamel(nodeName))
			}
		}

		f2 := f
		// required and edit field. force it to be required
		// required. if optional or nullable, now field is required
		// or field is now required in an edit mutation, by default, all fields are required...
		if required || requiredFields[fieldName] {
			// required
			var err error
			f2, err = f.Clone(field.Required())
			if err != nil {
				return nil, err
			}
		}
		// hack to force id fields when disableUserGraphQLEditable is true
		// to be optional in actions
		if f2.HasDefaultValueOnCreate() && f2.DisableUserGraphQLEditable() {
			optional = true
		}
		if optional || optionalFields[fieldName] {
			// optional
			var err error
			f2, err = f.Clone(field.Optional())
			if err != nil {
				return nil, err
			}
		}
		return f2, nil
	}

	// no override of fields so we should get default fields
	if len(fieldNames) == 0 {
		for _, f := range fieldInfo.EntFields() {
			if f.ExposeToActionsByDefault() && f.EditableField(typ.getEditableFieldContext()) && !excludedFields[f.FieldName] {
				f2, err := getField(f, f.FieldName)
				if err != nil {
					return nil, nil, err
				}
				fields = append(fields, f2)
			}
		}
	} else if fieldInfo != nil {
		// if a field is explicitly referenced, we want to automatically add it
		for _, fieldName := range fieldNames {
			f, err := getField(nil, fieldName)
			if err != nil {
				return nil, nil, err
			}
			if !f.EditableField(typ.getEditableFieldContext()) {
				return nil, nil, fmt.Errorf("field %s is not editable and cannot be added to action", fieldName)
			}
			fields = append(fields, f)
		}
	}

	return fields, primaryKeyField, nil
}

func getNonEntFieldsFromInput(cfg codegenapi.Config, nodeName string, action *input.Action, typ concreteNodeActionType) ([]*field.NonEntField, error) {
	var fields []*field.NonEntField

	inputName := getActionInputNameForNodeActionType(cfg, typ, nodeName, action.CustomInputName)

	for _, f := range action.ActionOnlyFields {
		// TODO we may want different names for graphql vs actions
		typ, err := f.GetEntType(inputName)
		if err != nil {
			return nil, err
		}

		fields = append(fields, field.NewNonEntField(cfg, f.Name, typ, f.Nullable, f.HideFromGraphQL).SetOptional(f.Optional))
	}
	return fields, nil
}

func getNonEntFieldsFromAssocGroup(
	cfg codegenapi.Config,
	nodeName string,
	assocGroup *edge.AssociationEdgeGroup,
	action *edge.EdgeAction,
	typ concreteEdgeActionType,
) ([]*field.NonEntField, error) {
	var fields []*field.NonEntField

	inputName := getActionInputNameForEdgeActionType(cfg, typ, assocGroup, nodeName, "")

	for _, f := range action.ActionOnlyFields {
		// TODO we may want different names for graphql vs actions
		typ, err := f.GetEntType(inputName)
		if err != nil {
			return nil, err
		}
		fields = append(fields, field.NewNonEntField(cfg, f.Name, typ, f.Nullable, f.HideFromGraphQL).SetOptional(f.Optional))
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

func processEdgeActions(cfg codegenapi.Config, nodeName string, assocEdge *edge.AssociationEdge, lang base.Language) ([]Action, error) {
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

		commonInfo := getCommonInfoForEdgeAction(
			cfg,
			nodeName,
			assocEdge,
			typ,
			edgeAction,
			lang,
		)
		commonInfo.canViewerDo = edgeAction.CanViewerDo
		commonInfo.canFail = edgeAction.CanFail

		actions[idx] = typ.getAction(commonInfo)

	}
	return actions, nil
}

func getImportPathForActionBaseFile(nodeName, actionName string) string {
	return path.Join(fmt.Sprintf("src/ent/generated/%s/actions/%s_base", strcase.ToSnake(nodeName), strcase.ToSnake(actionName)))
}

func getFilePathForEnumInputFile() string {
	return "src/graphql/generated/mutations/input_enums_type"
}

func processEdgeGroupActions(cfg codegenapi.Config, nodeName string, assocGroup *edge.AssociationEdgeGroup, lang base.Language) ([]Action, error) {
	edgeActions := assocGroup.EdgeActions
	if len(edgeActions) == 0 {
		return nil, nil
	}
	actions := make([]Action, len(edgeActions))

	for idx, edgeAction := range edgeActions {
		actionType, err := getEdgeActionType(edgeAction.Action)
		if err != nil {
			return nil, err
		}
		actionName := edgeAction.CustomActionName
		if actionName == "" {
			actionName = actionType.getDefaultActionName(cfg, nodeName, assocGroup, lang)
		}

		var tsEnums []*enum.Enum
		var gqlEnums []*enum.GQLEnum
		var fields []*field.NonEntField
		if lang == base.GoLang {
			fields = []*field.NonEntField{
				field.NewNonEntField(cfg, assocGroup.GroupStatusName, &enttype.StringType{}, false, false).SetFlag("Enum"),
				field.NewNonEntField(cfg, strcase.ToCamel(assocGroup.DestNodeInfo.Node+"ID"), &enttype.StringType{}, false, false).
					SetFlag("ID").
					SetNodeType(fmt.Sprintf("models.%sType", assocGroup.DestNodeInfo.Node)),
			}
		} else {
			values := assocGroup.GetStatusValues()
			typ := fmt.Sprintf("%sInput", assocGroup.ConstType)

			fields = []*field.NonEntField{
				field.NewNonEntField(
					cfg,
					assocGroup.TSGroupStatusName,
					(&enttype.StringEnumType{
						Values:      values,
						Type:        typ,
						GraphQLType: typ,
					}).SetImportPath(
						&tsimport.ImportPath{
							ImportPath: getImportPathForActionBaseFile(nodeName, actionName),
							Import:     typ,
						}).SetGraphQLImportPath(&tsimport.ImportPath{
						ImportPath: getFilePathForEnumInputFile(),
						// have to add type manually
						Import: typ + "Type",
					}),
					false,
					false,
				),
				field.NewNonEntField(
					cfg,
					assocGroup.GetIDArg(),
					&enttype.IDType{},
					false,
					false,
				),
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
		nonEntFields, err := getNonEntFieldsFromAssocGroup(cfg, nodeName, assocGroup, edgeAction, actionType)
		if err != nil {
			return nil, err
		}
		fields = append(fields, nonEntFields...)

		commonInfo := getCommonInfoForGroupEdgeAction(cfg, nodeName,
			assocGroup,
			actionType,
			edgeAction,
			lang,
			fields,
		)
		commonInfo.canViewerDo = edgeAction.CanViewerDo
		commonInfo.canFail = edgeAction.CanFail
		commonInfo.tsEnums = tsEnums
		commonInfo.gqlEnums = gqlEnums
		commonInfo.EdgeGroup = assocGroup

		actions[idx] = actionType.getAction(commonInfo)
	}
	return actions, nil
}

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

func getCommonInfo(
	cfg codegenapi.Config,
	nodeName string,
	typ concreteNodeActionType,
	customActionName, customGraphQLName, customInputName string,
	exposeToGraphQL bool,
	fields []*field.Field,
	nonEntFields []*field.NonEntField,
	opt *option) commonActionInfo {
	var graphqlName string
	if exposeToGraphQL {
		graphqlName = getGraphQLNameForNodeActionType(cfg, typ, nodeName, customGraphQLName)
	}
	return commonActionInfo{
		ActionName:       getActionNameForNodeActionType(cfg, typ, nodeName, customActionName),
		GraphQLName:      graphqlName,
		ActionInputName:  getActionInputNameForNodeActionType(cfg, typ, nodeName, customInputName),
		GraphQLInputName: getGraphQLInputNameForNodeActionType(cfg, typ, nodeName, customInputName),
		ExposeToGraphQL:  exposeToGraphQL,
		Fields:           fields,
		NonEntFields:     nonEntFields,
		NodeInfo:         nodeinfo.GetNodeInfo(nodeName),
		Operation:        typ.getOperation(),
		tranformsDelete:  opt.transformsDelete,
		primaryKeyField:  opt.primaryKeyField,
	}
}

func getCommonInfoForEdgeAction(
	cfg codegenapi.Config,
	nodeName string,
	assocEdge *edge.AssociationEdge,
	typ concreteEdgeActionType,
	edgeAction *edge.EdgeAction,
	lang base.Language) commonActionInfo {
	var graphqlName string
	if edgeAction.ExposeToGraphQL {
		graphqlName = getGraphQLNameForEdgeActionType(cfg, typ, nodeName, assocEdge, edgeAction.CustomGraphQLName)
	}
	return commonActionInfo{
		ActionName:       getActionNameForEdgeActionType(cfg, typ, nodeName, assocEdge, edgeAction.CustomActionName, lang),
		GraphQLName:      graphqlName,
		ActionInputName:  typ.getDefaultActionInputName(cfg, nodeName, assocEdge),
		GraphQLInputName: typ.getDefaultGraphQLInputName(cfg, nodeName, assocEdge),
		ExposeToGraphQL:  edgeAction.ExposeToGraphQL,
		Edges: []*edge.AssociationEdge{
			assocEdge,
		},
		NodeInfo:  nodeinfo.GetNodeInfo(nodeName),
		Operation: typ.getOperation(),
	}
}

func getCommonInfoForGroupEdgeAction(
	cfg codegenapi.Config,
	nodeName string,
	assocEdgeGroup *edge.AssociationEdgeGroup,
	typ concreteEdgeActionType,
	edgeAction *edge.EdgeAction,
	lang base.Language,
	fields []*field.NonEntField) commonActionInfo {
	var graphqlName, actionName string
	if edgeAction.ExposeToGraphQL {
		if edgeAction.CustomGraphQLName == "" {
			graphqlName = typ.getDefaultGraphQLName(cfg, nodeName, assocEdgeGroup)
		} else {
			graphqlName = edgeAction.CustomGraphQLName
		}
	}
	if edgeAction.CustomActionName == "" {
		actionName = typ.getDefaultActionName(cfg, nodeName, assocEdgeGroup, lang)
	} else {
		actionName = edgeAction.CustomActionName
	}
	return commonActionInfo{
		ActionName:       actionName,
		GraphQLName:      graphqlName,
		ActionInputName:  typ.getDefaultActionInputName(cfg, nodeName, assocEdgeGroup),
		GraphQLInputName: typ.getDefaultGraphQLInputName(cfg, nodeName, assocEdgeGroup),
		ExposeToGraphQL:  edgeAction.ExposeToGraphQL,
		NonEntFields:     fields,
		NodeInfo:         nodeinfo.GetNodeInfo(nodeName),
		Operation:        typ.getOperation(),
	}
}
