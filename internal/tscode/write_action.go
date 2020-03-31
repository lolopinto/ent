package tscode

import (
	"fmt"
	"text/template"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type actionTemplate struct {
	Action      action.Action
	NodeData    *schema.NodeData
	BuilderPath string
}

func writeBaseActionFile(nodeData *schema.NodeData, action action.Action) error {
	imps := tsimport.NewImports()

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: actionTemplate{
			NodeData:    nodeData,
			Action:      action,
			BuilderPath: getImportPathForBuilderFile(nodeData),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("action_base.tmpl"),
		TemplateName:      "action_base.tmpl",
		PathToFile:        getFilePathForAtionBaseFile(nodeData, action),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           getCustomFuncMap(imps),
	})
}

func getCustomFuncMap(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["hasInput"] = hasInput
	m["getInputName"] = getInputName
	m["isRequiredField"] = action.IsRequiredField
	m["getWriteOperation"] = getWriteOperation

	return m
}

func getInputName(action action.Action) string {
	// TODO
	node := action.GetNodeInfo().Node
	switch action.GetOperation() {
	case ent.CreateAction:
		return fmt.Sprintf("%sCreateInput", node)
	case ent.EditAction:
		// todo multiple edits
		return fmt.Sprintf("%sEditInput", node)
	}
	panic("invalid. todo")
}

func hasInput(action action.Action) bool {
	return len(action.GetFields()) != 0
}

func getWriteOperation(action action.Action) string {
	switch action.GetOperation() {
	case ent.CreateAction:
		return "Insert"
	case ent.EditAction, ent.AddEdgeAction, ent.RemoveEdgeAction, ent.EdgeGroupAction:
		return "Edit"
	case ent.DeleteAction:
		return "Delete"
	}
	panic(fmt.Sprintf("invalid action %s not a supported type", action.GetActionName()))
}
