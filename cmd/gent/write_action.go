package main

import (
	"fmt"
	"strings"
	"text/template"

	"github.com/lolopinto/ent/ent"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/imports"
)

func writeActionFile(nodeData *nodeTemplate, a action.Action, codePathInfo *codePath) {
	fileName := strcase.ToSnake(a.GetActionName())
	//	pathToFile := fmt.Sprintf("models/%s/action/%s.go", nodeData.PackageName, fileName)

	imps := imports.Imports{}
	writeFile(
		&templatedBasedFileWriter{
			data: actionTemplate{
				Action:   a,
				CodePath: codePathInfo,
			},
			pathToTemplate:    "templates/action.tmpl",
			templateName:      "action.tmpl",
			pathToFile:        fmt.Sprintf("models/%s/action/%s.go", nodeData.PackageName, fileName),
			createDirIfNeeded: true,
			formatSource:      true,
			packageName:       "action",
			imports:           &imps,
			funcMap: template.FuncMap{
				"actionMethodName":        action.GetActionMethodName,
				"actionMethodArgs":        getActionMethodArgs,
				"actionMethodContextArgs": getActionMethodContextArgs,
				"embeddedActionType":      getEmbeddedActionType,
				"paramsToEmbeddedType":    getActionParamsToEmbeddedType,
				"actionName":              getActionName,
				"fields":                  action.GetFields,
				"saveActionType":          getSaveActionType,
				"nodeInfo":                getNodeInfo,
				"returnsObjectInstance":   returnsObjectInstance,
				"argsToViewerMethod":      getActionArgsFromContextToViewerMethod,

				// our own version of reserveImport similar to what gqlgen provides. TOOD rename
				"reserveImport": imps.Reserve,
				"lookupImport":  imps.Lookup,
			},
		},
	)
}

func getActionName(action action.Action) string {
	return action.GetActionName()
}

func getActionMethodArgs(action action.Action) string {
	args := []string{"viewer viewer.ViewerContext"}

	if action.MutatingExistingObject() {
		// if we're editing an existing object, e.g. EditUser
		args = append(args, fmt.Sprintf("%s *models.%s", action.GetNodeInfo().NodeInstance, action.GetNodeInfo().Node))
		// append object...
	}

	return strings.Join(args, ", ")
}

func getActionMethodContextArgs(action action.Action) string {
	args := []string{"ctx context.Context"}

	if action.MutatingExistingObject() {
		// if we're editing an existing object, e.g. EditUser
		args = append(args, fmt.Sprintf("%s *models.%s", action.GetNodeInfo().NodeInstance, action.GetNodeInfo().Node))
		// append object...
	}

	return strings.Join(args, ", ")
}

func getActionArgsFromContextToViewerMethod(action action.Action) string {
	args := []string{"v"}

	if action.MutatingExistingObject() {
		// if we're editing an existing object, e.g. EditUser, append the object
		args = append(args, action.GetNodeInfo().NodeInstance)
	}

	return strings.Join(args, ", ")
}

func getActionParamsToEmbeddedType(action action.Action) []string {
	nodeInfo := action.GetNodeInfo()

	params := []string{
		"Viewer: viewer,",
		fmt.Sprintf("EntConfig: %s,", nodeInfo.EntConfig),
	}

	if action.MutatingExistingObject() {
		params = append(params, fmt.Sprintf("Ent: %s,", nodeInfo.NodeInstance))
	}
	return params
}

func getEmbeddedActionType(action action.Action) string {
	switch action.GetOperation() {
	case ent.CreateAction:
		return "actions.CreateEntActionMutator"
	case ent.EditAction:
		return "actions.EditEntActionMutator"
	case ent.DeleteAction:
		return "actions.DeleteEntActionMutator"
	}
	panic(fmt.Sprintf("invalid action %s not a supported type", action.GetActionName()))
}

func getSaveActionType(action action.Action) string {
	// need to return changed object e.g.
	if action.GetOperation() != ent.DeleteAction {
		return fmt.Sprintf("(*models.%s, error)", action.GetNodeInfo().Node)
	}
	return "error"
}

func getNodeInfo(action action.Action) codegen.NodeInfo {
	return action.GetNodeInfo()
}

func returnsObjectInstance(action action.Action) bool {
	return action.GetOperation() == ent.CreateAction || action.GetOperation() == ent.EditAction
}
