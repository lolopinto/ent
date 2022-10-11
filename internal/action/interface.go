package action

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"

	"github.com/lolopinto/ent/internal/field"
)

// no imports for now... since all local fields
// eventually may need it for e.g. file or something
// TsBuilderImports

type Action interface {
	GetFields() []*field.Field
	GetGraphQLFields() []*field.Field
	GetNonEntFields() []*field.NonEntField
	GetEdges() []*edge.AssociationEdge
	GetEdgeGroup() *edge.AssociationEdgeGroup
	GetActionName() string
	ExposedToGraphQL() bool
	GetGraphQLName() string
	GetGraphQLTypeName() string
	GetActionInputName() string
	GetGraphQLInputName() string
	GetGraphQLInputTypeName() string
	GetGraphQLPayloadName() string
	GetGraphQLPayloadTypeName() string
	MutatingExistingObject() bool // whether to add User, Note etc params
	GetNodeInfo() nodeinfo.NodeInfo
	GetOperation() ent.ActionOperation
	IsDeletingNode() bool
	AddCustomField(enttype.TSTypeWithCustomType, *field.Field)
	AddCustomNonEntField(enttype.TSTypeWithCustomType, *field.NonEntField)
	AddCustomInterfaces(a Action)
	GetCustomInterfaces() []*customtype.CustomInterface
	GetTSEnums() []*enum.Enum
	GetGQLEnums() []*enum.GQLEnum
	getCommonInfo() commonActionInfo
	TransformsDelete() bool
}

type ActionField interface {
	GetFieldType() enttype.EntType
	TsFieldName(cfg codegenapi.Config) string
	TsBuilderType(cfg codegenapi.Config) string
	TSPublicAPIName() string
	TsBuilderFieldName() string
	GetGraphQLName() string
	ForceRequiredInAction() bool
	ForceOptionalInAction() bool
	DefaultValue() *string
	Nullable() bool
	HasDefaultValueOnCreate() bool
	GetTsType() string
	IsEditableIDField() bool
	GetTsTypeImports() []*tsimport.ImportPath
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

func (info *ActionInfo) addActions(actions ...Action) error {
	for _, action := range actions {
		info.Actions = append(info.Actions, action)
		actionName := action.GetActionName()
		_, ok := info.actionMap[actionName]
		if ok {
			return fmt.Errorf("action with name %s already exists. cannot have multiple actions with the same name", actionName)

		}
		info.actionMap[actionName] = action

		if !action.ExposedToGraphQL() {
			continue
		}
		graphQLActionName := action.GetGraphQLName()
		_, ok = info.graphQLActionMap[graphQLActionName]
		if ok {
			return fmt.Errorf("graphql action with name %s already exists. cannot have multiple actions with the same name", graphQLActionName)

		}
		info.graphQLActionMap[graphQLActionName] = action
	}
	return nil
}

type commonActionInfo struct {
	ActionName       string
	ExposeToGraphQL  bool
	ActionInputName  string
	GraphQLInputName string
	GraphQLName      string
	Fields           []*field.Field
	NonEntFields     []*field.NonEntField
	Edges            []*edge.AssociationEdge // for edge actions for now but eventually other actions
	EdgeGroup        *edge.AssociationEdgeGroup
	Operation        ent.ActionOperation
	customInterfaces map[string]*customtype.CustomInterface
	tsEnums          []*enum.Enum
	gqlEnums         []*enum.GQLEnum
	nodeinfo.NodeInfo
	tranformsDelete bool
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

func (action *commonActionInfo) GetGraphQLTypeName() string {
	return action.GraphQLName + "Type"
}

func (action *commonActionInfo) GetActionInputName() string {
	return action.ActionInputName
}

func (action *commonActionInfo) GetGraphQLInputName() string {
	return action.GraphQLInputName
}

func (action *commonActionInfo) GetGraphQLInputTypeName() string {
	return action.GraphQLInputName + "Type"
}

func (action *commonActionInfo) GetGraphQLPayloadName() string {
	input := action.GetGraphQLInputName()
	return strings.TrimSuffix(input, "Input") + "Payload"
}

func (action *commonActionInfo) GetGraphQLPayloadTypeName() string {
	return action.GetGraphQLPayloadName() + "Type"
}

func (action *commonActionInfo) GetFields() []*field.Field {
	return action.Fields
}

func (action *commonActionInfo) GetGraphQLFields() []*field.Field {
	var ret []*field.Field
	for _, f := range action.Fields {
		if f.EditableGraphQLField() {
			ret = append(ret, f)
		}
	}
	return ret
}

func (action *commonActionInfo) GetEdges() []*edge.AssociationEdge {
	return action.Edges
}

func (action *commonActionInfo) GetEdgeGroup() *edge.AssociationEdgeGroup {
	return action.EdgeGroup
}

func (action *commonActionInfo) GetNonEntFields() []*field.NonEntField {
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

func (action *commonActionInfo) TransformsDelete() bool {
	return action.tranformsDelete
}

func (action *commonActionInfo) getCommonInfo() commonActionInfo {
	return *action
}

func getTypes(typ enttype.TSTypeWithCustomType) (string, string) {
	cti := typ.GetCustomTypeInfo()
	return cti.TSInterface, cti.GraphQLInterface
}

func (action *commonActionInfo) getCustomInterface(typ enttype.TSTypeWithCustomType) *customtype.CustomInterface {
	if action.customInterfaces == nil {
		action.customInterfaces = make(map[string]*customtype.CustomInterface)
	}

	tsTyp, gqlType := getTypes(typ)

	ci, ok := action.customInterfaces[tsTyp]
	if !ok {
		ci = &customtype.CustomInterface{
			TSType:              tsTyp,
			GQLName:             gqlType,
			GenerateListConvert: enttype.IsListType(typ),
		}
	}

	action.customInterfaces[tsTyp] = ci
	return ci
}

func (action *commonActionInfo) AddCustomField(typ enttype.TSTypeWithCustomType, cf *field.Field) {
	ci := action.getCustomInterface(typ)
	ci.Fields = append(ci.Fields, cf)
	enumType, ok := enttype.GetEnumType(cf.GetFieldType())
	if !ok {
		return
	}
	ci.AddEnumImport(enumType.GetTSName())
}

func (action *commonActionInfo) AddCustomNonEntField(typ enttype.TSTypeWithCustomType, cf *field.NonEntField) {
	ci := action.getCustomInterface(typ)
	ci.NonEntFields = append(ci.NonEntFields, cf)
}

// Unclear what the best solution is here but the decision here is to
// create (duplicate) a private interface in the action that represents the input
// but in GraphQL we import the existing one since GraphQL names are unique
// across the types and we don't crazy naming conflicts in here
// we can (and should?) probably namespace the private generated interface name by adding a new prefix
// but no conflicts yet so leaving it for now
// This choice isn't consistent but is the easiest path so doing that
func (action *commonActionInfo) AddCustomInterfaces(a2 Action) {
	if action.customInterfaces == nil {
		action.customInterfaces = make(map[string]*customtype.CustomInterface)
	}
	for _, inter := range a2.GetCustomInterfaces() {
		// don't add to graphql
		action.customInterfaces[inter.TSType] = &customtype.CustomInterface{
			TSType:  inter.TSType,
			GQLName: inter.GQLName,
			// this flag indicates that we're going to import this input in graphql
			// from where this is generated
			Action:       a2,
			Fields:       inter.Fields,
			NonEntFields: inter.NonEntFields,
		}
	}
}

func (action *commonActionInfo) GetCustomInterfaces() []*customtype.CustomInterface {
	var ret []*customtype.CustomInterface

	for _, v := range action.customInterfaces {
		ret = append(ret, v)
	}

	sort.Slice(ret, func(i, j int) bool {
		return ret[i].TSType < ret[j].TSType
	})
	return ret
}

func (action *commonActionInfo) GetTSEnums() []*enum.Enum {
	return action.tsEnums
}

func (action *commonActionInfo) GetGQLEnums() []*enum.GQLEnum {
	return action.gqlEnums
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

type option struct {
	transformsDelete bool
}

type Option func(*option)

func TransformsDelete() Option {
	return func(opt *option) {
		opt.transformsDelete = true
	}
}

func ParseFromInput(cfg codegenapi.Config, nodeName string, actions []*input.Action, fieldInfo *field.FieldInfo, edgeInfo *edge.EdgeInfo, lang base.Language, opts ...Option) (*ActionInfo, error) {
	o := &option{}
	for _, opt := range opts {
		opt(o)
	}
	actionInfo := NewActionInfo()

	for _, action := range actions {
		actions, err := parseActionsFromInput(cfg, nodeName, action, fieldInfo, o)
		if err != nil {
			return nil, err
		}
		if err := actionInfo.addActions(actions...); err != nil {
			return nil, err
		}
	}

	if edgeInfo != nil {
		for _, assocEdge := range edgeInfo.Associations {
			actions, err := processEdgeActions(cfg, nodeName, assocEdge, lang)
			if err != nil {
				return nil, err
			}
			if err := actionInfo.addActions(actions...); err != nil {
				return nil, err
			}
		}

		for _, assocGroup := range edgeInfo.AssocGroups {
			actions, err := processEdgeGroupActions(cfg, nodeName, assocGroup, lang)
			if err != nil {
				return nil, err
			}
			if err := actionInfo.addActions(actions...); err != nil {
				return nil, err
			}
		}
	}

	return actionInfo, nil
}

func ParseFromInputNode(cfg codegenapi.Config, nodeName string, node *input.Node, lang base.Language) (*ActionInfo, error) {
	fi, err := field.NewFieldInfoFromInputs(cfg, nodeName, node.Fields, &field.Options{})
	if err != nil {
		return nil, err
	}
	ei, err := edge.EdgeInfoFromInput(cfg, nodeName, node)
	if err != nil {
		return nil, err
	}
	return ParseFromInput(cfg, nodeName, node.Actions, fi, ei, lang)
}

// FieldActionTemplateInfo is passed to codegeneration template (both action and graphql) to generate
// the code needed for actions
type FieldActionTemplateInfo struct {
	SetterMethodName         string
	NullableSetterMethodName string
	GetterMethodName         string
	InstanceName             string
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

func GetActionMethodName(action Action) (string, error) {
	r := regexp.MustCompile(`(\w+)Action`)

	// TODO need to verify that any name ends with Action or EntAction.
	match := r.FindStringSubmatch(action.GetActionName())
	if len(match) != 2 {
		return "", fmt.Errorf("invalid action name which should have been caught in validation. action names should end with Action or EntAction")
	}
	return match[1], nil
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

		fieldName := f.GetFieldName()
		fields = append(fields, FieldActionTemplateInfo{
			SetterMethodName: "Add" + fieldName,
			InstanceName:     strcase.ToLowerCamel(fieldName),
			FieldName:        fieldName,
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
	TSNodeID           string
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
			TSEdgeConst:              edge.TsEdgeConst,
			//AssocEdge:    edge,
			NodeType: edge.NodeInfo.NodeType,
			// matches what we do in graphQLSchema.processAction
			GraphQLNodeID:      fmt.Sprintf("%sID", edge.Singular()),
			TSNodeID:           fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
			TSAddIDMethodName:  fmt.Sprintf("add%sID", edge.Singular()),
			TSAddMethodName:    fmt.Sprintf("add%s", edge.Singular()),
			TSRemoveMethodName: fmt.Sprintf("remove%s", edge.Singular()),
		})
	}

	return result
}

func IsRequiredField(action Action, field ActionField) bool {
	if field.ForceRequiredInAction() {
		return true
	}
	if field.ForceOptionalInAction() {
		return false
	}

	// for non-create actions, not required
	if action.GetOperation() != ent.CreateAction {
		return false
	}
	// for a nullable field or something with a default value, don't make it required...
	if field.Nullable() || field.DefaultValue() != nil || field.HasDefaultValueOnCreate() {
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

func IsEdgeGroupAction(action Action) bool {
	return action.GetOperation() == ent.EdgeGroupAction
}
