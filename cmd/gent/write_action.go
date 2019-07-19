package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"text/template"

	"github.com/lolopinto/ent/ent"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
)

func writeActionFile(nodeData *nodeTemplate, action action.Action, codePathInfo *codePath) {
	fileName := strcase.ToSnake(action.GetActionName())
	writeFile(
		&templatedBasedFileWriter{
			data: actionTemplate{
				Action:   action,
				CodePath: codePathInfo,
			},
			pathToTemplate:    "templates/action.tmpl",
			templateName:      "action.tmpl",
			pathToFile:        fmt.Sprintf("models/%s/action/%s.go", nodeData.PackageName, fileName),
			createDirIfNeeded: true,
			formatSource:      true,
			funcMap: template.FuncMap{
				"actionMethodName":      getActionMethodName,
				"actionMethodArgs":      getActionMethodArgs,
				"embeddedActionType":    getEmbeddedActionType,
				"paramsToEmbeddedType":  getActionParamsToEmbeddedType,
				"actionName":            getActionName,
				"fields":                getFields,
				"saveActionType":        getSaveActionType,
				"nodeInfo":              getNodeInfo,
				"returnsObjectInstance": returnsObjectInstance,
			},
		},
	)
}

func getActionName(action action.Action) string {
	return action.GetActionName()
}

func getActionMethodName(action action.Action) string {
	r, err := regexp.Compile(`(\w+)Action`)

	if err != nil {
		panic("couldn't compile regex in actionMethodName")
	}

	// TODO need to verify that any name ends with Action or EntAction.
	match := r.FindStringSubmatch(action.GetActionName())
	if len(match) != 2 {
		panic("invalid action name which should have been caught in validation. action names should end with Action or EntAction")
	}
	return match[1]
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

type fieldActionTemplateInfo struct {
	MethodName      string
	InstanceName    string
	InstanceType    string
	FieldKey        string
	FieldName       string
	QuotedFieldName string
	QuotedDBName    string
}

func getFields(action action.Action) []fieldActionTemplateInfo {
	var fields []fieldActionTemplateInfo

	for _, f := range action.GetFields() {

		fields = append(fields, fieldActionTemplateInfo{
			MethodName:      "Set" + f.FieldName,
			InstanceName:    strcase.ToLowerCamel(f.FieldName),
			InstanceType:    field.GetTypeInStructDefinition(f),
			FieldName:       f.FieldName,
			QuotedFieldName: strconv.Quote(f.FieldName),
			QuotedDBName:    f.GetQuotedDBColName(),
		})
	}
	return fields
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
