package action

import (
	"fmt"
	"go/ast"
	"regexp"
	"strconv"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/field"
)

type NonEntField struct {
	FieldName string
	FieldType enttype.TSGraphQLType
	Nullable  bool // required default = true
	// TODO these are both go things. ignore
	// Flag enum or ID
	Flag string
	// this is a go-thing. ignore for TypeScript
	NodeType string
}

func (f *NonEntField) Required() bool {
	return !f.Nullable
}

func (f *NonEntField) GetGraphQLName() string {
	return strcase.ToLowerCamel(f.FieldName)
}

// don't have to deal with all the id field stuff field.Field has to deal with
func (f *NonEntField) GetTsType() string {
	return f.FieldType.GetTSType()
}

func (f *NonEntField) TsFieldName() string {
	return strcase.ToLowerCamel(f.FieldName)
}

// no imports for now... since all local fields
// eventually may need it for e.g. file or something
// TsBuilderImports

type Action interface {
	GetFields() []*field.Field
	GetNonEntFields() []*NonEntField
	GetEdges() []*edge.AssociationEdge
	GetActionName() string
	ExposedToGraphQL() bool
	GetGraphQLName() string
	GetInputName() string         // only applies in TypeScript?
	MutatingExistingObject() bool // whether to add User, Note etc params
	GetNodeInfo() nodeinfo.NodeInfo
	GetOperation() ent.ActionOperation
	IsDeletingNode() bool
}

type ActionInfo struct {
	Actions          []Action
	graphQLActionMap map[string]Action
	actionMap        map[string]Action
	// CreateAction     *Action
	// EditAction       *Action
	// DeleteAction     *Action
}

func NewActionInfo() *ActionInfo {
	ret := &ActionInfo{}
	ret.graphQLActionMap = make(map[string]Action)
	ret.actionMap = make(map[string]Action)
	return ret
}

func (info *ActionInfo) GetByGraphQLName(name string) Action {
	return info.graphQLActionMap[name]
}

func (info *ActionInfo) GetByName(name string) Action {
	return info.actionMap[name]
}

func (info *ActionInfo) addActions(actions ...Action) {
	for _, action := range actions {
		info.Actions = append(info.Actions, action)
		actionName := action.GetActionName()
		_, ok := info.actionMap[actionName]
		if ok {
			panic(
				fmt.Errorf("action with name %s already exists. cannot have multiple actions with the same name", actionName),
			)
		}
		info.actionMap[actionName] = action

		if !action.ExposedToGraphQL() {
			continue
		}
		graphQLActionName := action.GetGraphQLName()
		_, ok = info.graphQLActionMap[graphQLActionName]
		if ok {
			panic(
				fmt.Errorf("graphql action with name %s already exists. cannot have multiple actions with the same name", graphQLActionName),
			)
		}
		info.graphQLActionMap[graphQLActionName] = action
	}
}

type commonActionInfo struct {
	ActionName      string
	ExposeToGraphQL bool
	InputName       string
	GraphQLName     string
	Fields          []*field.Field
	NonEntFields    []*NonEntField
	Edges           []*edge.AssociationEdge // for edge actions for now but eventually other actions
	Operation       ent.ActionOperation
	nodeinfo.NodeInfo
}

func (action *commonActionInfo) GetActionName() string {
	return action.ActionName
}

func (action *commonActionInfo) ExposedToGraphQL() bool {
	return action.ExposeToGraphQL
}

func (action *commonActionInfo) GetGraphQLName() string {
	return action.GraphQLName
}

func (action *commonActionInfo) GetInputName() string {
	return action.InputName
}

func (action *commonActionInfo) GetFields() []*field.Field {
	return action.Fields
}

func (action *commonActionInfo) GetEdges() []*edge.AssociationEdge {
	return action.Edges
}

func (action *commonActionInfo) GetNonEntFields() []*NonEntField {
	return action.NonEntFields
}

func (action *commonActionInfo) GetNodeInfo() nodeinfo.NodeInfo {
	return action.NodeInfo
}

func (action *commonActionInfo) GetOperation() ent.ActionOperation {
	return action.Operation
}

func (action *commonActionInfo) IsDeletingNode() bool {
	return action.Operation == ent.DeleteAction
}

type CreateAction struct {
	commonActionInfo
}

type mutationExistingObjAction struct {
	commonActionInfo
}

func (action *mutationExistingObjAction) MutatingExistingObject() bool {
	return true
}

func (action *CreateAction) MutatingExistingObject() bool {
	return false
}

type EditAction struct {
	commonActionInfo
	mutationExistingObjAction
}

type DeleteAction struct {
	commonActionInfo
	mutationExistingObjAction
}

type AddEdgeAction struct {
	commonActionInfo
	mutationExistingObjAction
}

type RemoveEdgeAction struct {
	commonActionInfo
	mutationExistingObjAction
}

type EdgeGroupAction struct {
	commonActionInfo
	mutationExistingObjAction
}

func ParseActions(nodeName string, fn *ast.FuncDecl, fieldInfo *field.FieldInfo, edgeInfo *edge.EdgeInfo, lang base.Language) (*ActionInfo, error) {
	// get the actions in the function
	elts := astparser.GetEltsInFunc(fn)

	var inputActions []*input.Action
	for _, expr := range elts {
		result, err := astparser.Parse(expr)
		if err != nil {
			return nil, err
		}

		typeName := result.GetTypeName()
		if typeName != "ent.ActionConfig" {
			return nil, fmt.Errorf("expected type name to ent.ActionConfig, got %s instead", typeName)
		}

		inputAction, err := getInputAction(nodeName, result)
		if err != nil {
			return nil, err
		}
		inputActions = append(inputActions, inputAction)
	}

	return ParseFromInput(nodeName, inputActions, fieldInfo, edgeInfo, lang)
}

func ParseFromInput(nodeName string, actions []*input.Action, fieldInfo *field.FieldInfo, edgeInfo *edge.EdgeInfo, lang base.Language) (*ActionInfo, error) {
	actionInfo := NewActionInfo()

	for _, action := range actions {
		actions, err := parseActionsFromInput(nodeName, action, fieldInfo)
		if err != nil {
			return nil, err
		}
		actionInfo.addActions(actions...)
	}

	if edgeInfo != nil {
		for _, assocEdge := range edgeInfo.Associations {
			actionInfo.addActions(processEdgeActions(nodeName, assocEdge, lang)...)
		}

		for _, assocGroup := range edgeInfo.AssocGroups {
			actionInfo.addActions(processEdgeGroupActions(nodeName, assocGroup, lang)...)
		}
	}

	return actionInfo, nil
}

// FieldActionTemplateInfo is passed to codegeneration template (both action and graphql) to generate
// the code needed for actions
type FieldActionTemplateInfo struct {
	SetterMethodName         string
	NullableSetterMethodName string
	GetterMethodName         string
	InstanceName             string
	InstanceType             string
	FieldKey                 string
	FieldName                string
	QuotedFieldName          string
	QuotedDBName             string
	InverseEdge              *edge.AssociationEdge
	IsStatusEnum             bool
	IsGroupID                bool
	NodeType                 string
	Field                    *field.Field
}

func GetActionMethodName(action Action) string {
	r := regexp.MustCompile(`(\w+)Action`)

	// TODO need to verify that any name ends with Action or EntAction.
	match := r.FindStringSubmatch(action.GetActionName())
	if len(match) != 2 {
		panic("invalid action name which should have been caught in validation. action names should end with Action or EntAction")
	}
	return match[1]
}

func GetFields(action Action) []FieldActionTemplateInfo {
	return GetFieldsFromFields(action.GetFields())
}

func HasInput(action Action) bool {
	return len(action.GetFields()) != 0 || len(action.GetNonEntFields()) != 0
}

func HasOnlyActionOnlyFields(action Action) bool {
	return len(action.GetNonEntFields()) != 0 && len(action.GetFields()) == 0
}

// TODO abstract this out somewhere else...
func GetFieldsFromFields(fields []*field.Field) []FieldActionTemplateInfo {
	var result []FieldActionTemplateInfo

	for _, f := range fields {

		result = append(result, FieldActionTemplateInfo{
			SetterMethodName:         "Set" + f.FieldName,
			NullableSetterMethodName: "SetNilable" + f.FieldName,
			GetterMethodName:         "Get" + f.FieldName,
			InstanceName:             strcase.ToLowerCamel(f.FieldName),
			InstanceType:             field.GetNonNilableGoType(f),
			FieldName:                f.FieldName,
			QuotedFieldName:          strconv.Quote(f.FieldName),
			QuotedDBName:             f.GetQuotedDBColName(),
			InverseEdge:              f.GetInverseEdge(),
			Field:                    f,
		})
	}
	return result
}

func GetNonEntFields(action Action) []FieldActionTemplateInfo {
	var fields []FieldActionTemplateInfo

	// TODO this is only used by go so didn't update this
	for _, f := range action.GetNonEntFields() {

		fields = append(fields, FieldActionTemplateInfo{
			SetterMethodName: "Add" + f.FieldName,
			InstanceName:     strcase.ToLowerCamel(f.FieldName),
			InstanceType:     "string", // TODO this needs to work for other
			FieldName:        f.FieldName,
			IsStatusEnum:     f.Flag == "Enum", // TODO best way?
			IsGroupID:        f.Flag == "ID",
			NodeType:         f.NodeType,
		})
	}
	return fields
}

type EdgeActionTemplateInfo struct {
	AddEntMethodName         string
	AddSingleIDMethodName    string
	AddMultiIDMethodName     string
	RemoveEntMethodName      string
	RemoveSingleIDMethodName string
	RemoveMultiIDMethodName  string
	EdgeName                 string
	InstanceName             string
	InstanceType             string
	//	AssocEdge    *edge.AssociationEdge
	EdgeConst          string
	NodeType           string
	Node               string
	GraphQLNodeID      string
	TSEdgeConst        string
	TSGraphQLNodeID    string
	TSAddMethodName    string
	TSAddIDMethodName  string
	TSRemoveMethodName string
	Edge               edge.Edge
}

func GetEdges(action Action) []EdgeActionTemplateInfo {
	return GetEdgesFromEdges(action.GetEdges())
}

// ALso TODO...
func GetEdgesFromEdges(edges []*edge.AssociationEdge) []EdgeActionTemplateInfo {
	var result []EdgeActionTemplateInfo

	for _, edge := range edges {
		edgeName := edge.GetEdgeName()

		result = append(result, EdgeActionTemplateInfo{
			Edge:                     edge,
			Node:                     edge.NodeInfo.Node,
			AddEntMethodName:         "Add" + edge.EdgeName,
			AddSingleIDMethodName:    "Add" + edge.Singular() + "ID",
			AddMultiIDMethodName:     "Add" + edge.Singular() + "IDs",
			RemoveEntMethodName:      "Remove" + edge.EdgeName,
			RemoveSingleIDMethodName: "Remove" + edge.Singular() + "ID",
			RemoveMultiIDMethodName:  "Remove" + edge.Singular() + "IDs",
			EdgeName:                 edgeName,
			InstanceName:             edge.NodeInfo.NodeInstance,
			InstanceType:             fmt.Sprintf("*models.%s", edge.NodeInfo.Node),
			EdgeConst:                edge.EdgeConst,
			TSEdgeConst:              edge.TsEdgeConst(),
			//AssocEdge:    edge,
			NodeType: edge.NodeInfo.NodeType,
			// matches what we do in graphQLSchema.processAction
			GraphQLNodeID:      fmt.Sprintf("%sID", edge.Singular()),
			TSGraphQLNodeID:    fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
			TSAddIDMethodName:  fmt.Sprintf("add%sID", edge.Singular()),
			TSAddMethodName:    fmt.Sprintf("add%s", edge.Singular()),
			TSRemoveMethodName: fmt.Sprintf("remove%s", edge.Singular()),
		})
	}

	return result
}

func IsRequiredField(action Action, field *field.Field) bool {
	// for non-create actions, not required
	if action.GetOperation() != ent.CreateAction {
		return false
	}
	// for a nullable field or something with a default value, don't make it required...
	if field.Nullable() || field.DefaultValue() != nil {
		return false
	}
	return true
}

func IsRemoveEdgeAction(action Action) bool {
	return action.GetOperation() == ent.RemoveEdgeAction
}

func IsEdgeAction(action Action) bool {
	return action.GetOperation() == ent.RemoveEdgeAction || action.GetOperation() == ent.AddEdgeAction
}
