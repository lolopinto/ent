package action

import (
	"fmt"
	"go/ast"

	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/internal/codegen"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/util"
)

type Action interface {
	GetFields() []*field.Field
	GetActionName() string
	ExposedToGraphQL() bool
	GetGraphQLName() string
	MutatingExistingObject() bool // whether to add User, Note etc params
	GetNodeInfo() codegen.NodeInfo
	GetOperation() ent.ActionOperation
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

func newActionInfo(nodeName string) *ActionInfo {
	ret := &ActionInfo{}
	ret.graphQLActionMap = make(map[string]Action)
	ret.actionMap = make(map[string]Action)
	return ret
}

func (info *ActionInfo) addActions(actions []Action) {
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

func (action *commonActionInfo) GetNodeInfo() codegen.NodeInfo {
	return action.NodeInfo
}

func (action *commonActionInfo) GetOperation() ent.ActionOperation {
	return action.Operation
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

func (action *CreateAction) MutatingExistingObject() bool {
	return false
}

type EditAction struct {
	commonActionInfo
}

func (action *EditAction) MutatingExistingObject() bool {
	return true
}

type DeleteAction struct {
	commonActionInfo
}

func (action *DeleteAction) MutatingExistingObject() bool {
	return true
}

// func (action *DeleteAction) GetFields() []string {
// 	// TODO. we wanna return placeId, userId, etc
// 	return []string{}
// }

func ParseActions(nodeName string, fn *ast.FuncDecl, fieldInfo *field.FieldInfo) *ActionInfo {
	// get the actions in the function
	elts := astparser.GetEltsInFunc(fn)
	spew.Dump(nodeName)

	actionInfo := newActionInfo(nodeName)

	for _, expr := range elts {
		// hardcode to unary expressions for now but this may not be what we want

		uExpr := astparser.GetExprToUnaryExpr(expr)
		compositeLit := astparser.GetExprToCompositeLit(uExpr.X)
		typeName := astparser.GetTypeNameFromExpr(compositeLit.Type)

		if typeName != "ent.ActionConfig" {
			util.Die(
				fmt.Errorf("expected the type to be ent.ActionConfig, got %s instead", typeName),
			)
		}

		actionInfo.addActions(parseActions(nodeName, compositeLit, fieldInfo))

		//		spew.Dump(expr)
	}
	//	spew.Dump(actionInfo)

	return actionInfo
}
