package action

import (
	"fmt"
	"go/ast"
	"regexp"
	"strconv"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/util"
)

type Action interface {
	GetFields() []*field.Field
	GetEdges() []*edge.AssociationEdge
	GetActionName() string
	ExposedToGraphQL() bool
	GetGraphQLName() string
	MutatingExistingObject() bool // whether to add User, Note etc params
	GetNodeInfo() codegen.NodeInfo
	GetOperation() ent.ActionOperation
	IsDeletingNode() bool
}

//type ActionWithFields interface{}

// type ActionWithGraphQLMutation interface {
// }

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
	GraphQLName     string
	Fields          []*field.Field
	Edges           []*edge.AssociationEdge // for edge actions for now but eventually other actions
	Operation       ent.ActionOperation
	codegen.NodeInfo
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

func (action *commonActionInfo) GetFields() []*field.Field {
	return action.Fields
}

func (action *commonActionInfo) GetEdges() []*edge.AssociationEdge {
	return action.Edges
}

func (action *commonActionInfo) GetNodeInfo() codegen.NodeInfo {
	return action.NodeInfo
}

func (action *commonActionInfo) GetOperation() ent.ActionOperation {
	return action.Operation
}

func (action *commonActionInfo) IsDeletingNode() bool {
	return action.Operation == ent.DeleteAction
}

// type mutateObjectActionInfo struct {
// 	Fields []*field.Field
// 	commonActionInfo
// }

// func (action *mutateObjectActionInfo) GetFields() []*field.Field {
// 	return action.Fields
// }

type CreateAction struct {
	commonActionInfo
}

type mutationExistingObjAction struct {
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

// func (action *DeleteAction) GetFields() []string {
// 	// TODO. we wanna return placeId, userId, etc
// 	return []string{}
// }

func ParseActions(nodeName string, fn *ast.FuncDecl, fieldInfo *field.FieldInfo, edgeInfo *edge.EdgeInfo) *ActionInfo {
	// get the actions in the function
	elts := astparser.GetEltsInFunc(fn)

	actionInfo := NewActionInfo()

	for _, expr := range elts {
		// hardcode to unary expressions for now but this may not be what we want

		compositeLit := astparser.GetComposeLitInUnaryExpr(expr)
		typeName := astparser.GetTypeNameFromExpr(compositeLit.Type)

		if typeName != "ent.ActionConfig" {
			util.Die(
				fmt.Errorf("expected the type to be ent.ActionConfig, got %s instead", typeName),
			)
		}

		actionInfo.addActions(parseActions(nodeName, compositeLit, fieldInfo)...)

		//		spew.Dump(expr)
	}

	for _, assocEdge := range edgeInfo.Associations {
		if assocEdge.EdgeAction == nil {
			continue
		}
		actionInfo.addActions(processEdgeAction(nodeName, assocEdge))

	}
	// spew.Dump(actionInfo)

	return actionInfo
}

// FieldActionTemplateInfo is passed to codegeneration template (both action and graphql) to generate
// the code needed for actions
type FieldActionTemplateInfo struct {
	MethodName      string
	InstanceName    string
	InstanceType    string
	FieldKey        string
	FieldName       string
	QuotedFieldName string
	QuotedDBName    string
	InverseEdge     *edge.AssociationEdge
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
	var fields []FieldActionTemplateInfo

	for _, f := range action.GetFields() {

		fields = append(fields, FieldActionTemplateInfo{
			MethodName:      "Set" + f.FieldName,
			InstanceName:    strcase.ToLowerCamel(f.FieldName),
			InstanceType:    field.GetTypeInStructDefinition(f),
			FieldName:       f.FieldName,
			QuotedFieldName: strconv.Quote(f.FieldName),
			QuotedDBName:    f.GetQuotedDBColName(),
			InverseEdge:     f.InverseEdge,
		})
	}
	return fields
}

type EdgeActionTemplateInfo struct {
	MethodName   string
	EdgeName     string
	InstanceName string
	InstanceType string
	//	AssocEdge    *edge.AssociationEdge
	EdgeConst string
	NodeType  string
	Node      string
	NodeID    string
}

func GetEdges(action Action) []EdgeActionTemplateInfo {
	var edges []EdgeActionTemplateInfo

	for _, edge := range action.GetEdges() {
		edgeName := edge.GetEdgeName()

		edges = append(edges, EdgeActionTemplateInfo{
			Node:         edge.NodeInfo.Node,
			MethodName:   "Add" + edge.NodeInfo.Node,
			EdgeName:     edgeName,
			InstanceName: edge.NodeInfo.NodeInstance,
			InstanceType: fmt.Sprintf("*models.%s", edge.NodeInfo.Node),
			EdgeConst:    edge.EdgeConst,
			//AssocEdge:    edge,
			NodeType: edge.NodeInfo.NodeType,
			NodeID:   edge.NodeInfo.Node + "ID",
		})
	}
	return edges
}
