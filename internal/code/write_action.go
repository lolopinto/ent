package code

import (
	"fmt"
	"strings"
	"text/template"

	"github.com/lolopinto/ent/ent"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/imports"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/util"
)

type actionTemplate struct {
	Action action.Action
	Config *codegen.Config
}

func writeActionFile(nodeData *schema.NodeData, a action.Action, cfg *codegen.Config) error {
	fileName := strcase.ToSnake(a.GetActionName())

	imps := imports.Imports{}
	return file.Write(
		&file.TemplatedBasedFileWriter{
			Config: cfg,
			Data: actionTemplate{
				Action: a,
				Config: cfg,
			},
			AbsPathToTemplate: util.GetAbsolutePath("action.gotmpl"),
			TemplateName:      "action.gotmpl",
			PathToFile:        fmt.Sprintf("models/%s/action/%s_gen.go", nodeData.PackageName, fileName),
			CreateDirIfNeeded: true,
			PackageName:       "action",
			Imports:           &imps,
			FuncMap: template.FuncMap{
				"actionMethodName":        action.GetActionMethodName,
				"actionMethodArgs":        getActionMethodArgs,
				"actionMethodContextArgs": getActionMethodContextArgs,
				"fields":                  action.GetFields,
				"nonEntFields":            action.GetNonEntFields,
				"edges":                   action.GetEdges,
				"saveActionType":          getSaveActionType,
				"nodeInfo":                getNodeInfo,
				"returnsObjectInstance":   returnsObjectInstance,
				"requiredField":           action.IsRequiredField,
				"removeEdgeAction":        action.IsRemoveEdgeAction,
				"argsToViewerMethod":      getActionArgsFromContextToViewerMethod,
				"writeOperation":          getWriteOperation,

				// our own version of reserveImport similar to what gqlgen provides. TOOD rename
				"reserveImport": imps.Reserve,
				"lookupImport":  imps.Lookup,
			},
		},
	)
}

func getActionMethodArgs(action action.Action) string {
	args := []string{"v viewer.ViewerContext"}

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

func getWriteOperation(action action.Action) (string, error) {
	switch action.GetOperation() {
	case ent.CreateAction:
		return "ent.InsertOperation", nil
	case ent.EditAction, ent.AddEdgeAction, ent.RemoveEdgeAction, ent.EdgeGroupAction:
		return "ent.EditOperation", nil
	case ent.DeleteAction:
		return "ent.DeleteOperation", nil
	}
	return "", fmt.Errorf("invalid action %s not a supported type", action.GetActionName())
}

func getSaveActionType(action action.Action) string {
	// need to return changed object e.g.
	if action.GetOperation() != ent.DeleteAction {
		return fmt.Sprintf("(*models.%s, error)", action.GetNodeInfo().Node)
	}
	return "error"
}

func getNodeInfo(action action.Action) nodeinfo.NodeInfo {
	return action.GetNodeInfo()
}

func returnsObjectInstance(action action.Action) bool {
	return action.GetOperation() != ent.DeleteAction
}
