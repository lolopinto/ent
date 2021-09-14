package tscode

import (
	"fmt"
	"text/template"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type actionTemplate struct {
	Action        action.Action
	NodeData      *schema.NodeData
	BuilderPath   string
	BasePath      string
	Package       *codegen.ImportPackage
	PrivacyConfig *codegen.PrivacyConfig
}

func writeBaseActionFile(nodeData *schema.NodeData, processor *codegen.Processor, action action.Action) error {
	cfg := processor.Config
	filePath := getFilePathForActionBaseFile(cfg, nodeData, action)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: actionTemplate{
			NodeData:      nodeData,
			Action:        action,
			BuilderPath:   getImportPathForBuilderFile(nodeData),
			Package:       cfg.GetImportPackage(),
			PrivacyConfig: cfg.GetDefaultActionPolicy(),
		},
		CreateDirIfNeeded:  true,
		AbsPathToTemplate:  util.GetAbsolutePath("action_base.tmpl"),
		OtherTemplateFiles: []string{util.GetAbsolutePath("../schema/enum/enum.tmpl")},
		TemplateName:       "action_base.tmpl",
		PathToFile:         filePath,
		TsImports:          imps,
		FuncMap:            getFuncMapForActionBase(imps),
	})
}

func writeActionFile(nodeData *schema.NodeData, processor *codegen.Processor, action action.Action) error {
	cfg := processor.Config
	filePath := getFilePathForActionFile(cfg, nodeData, action)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: actionTemplate{
			NodeData: nodeData,
			Action:   action,
			BasePath: getImportPathForActionBaseFile(nodeData, action),
			Package:  cfg.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("action.tmpl"),
		TemplateName:      "action.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           getCustomFuncMap(imps),
		EditableCode:      true,
	}, file.WriteOnce())
}

func getCustomFuncMap(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["hasInput"] = action.HasInput
	m["hasOnlyActionOnlyFields"] = action.HasOnlyActionOnlyFields
	m["isRequiredField"] = action.IsRequiredField
	m["getWriteOperation"] = getWriteOperation

	return m
}

func getFuncMapForActionBase(imps *tsimport.Imports) template.FuncMap {
	m := getCustomFuncMap(imps)

	m["edges"] = action.GetEdges
	m["removeEdgeAction"] = action.IsRemoveEdgeAction
	m["edgeAction"] = action.IsEdgeAction
	m["edgeGroupAction"] = action.IsEdgeGroupAction

	return m
}

func getWriteOperation(action action.Action) (string, error) {
	switch action.GetOperation() {
	case ent.CreateAction:
		return "Insert", nil
	case ent.EditAction, ent.AddEdgeAction, ent.RemoveEdgeAction, ent.EdgeGroupAction:
		return "Edit", nil
	case ent.DeleteAction:
		return "Delete", nil
	}
	return "", fmt.Errorf("invalid action %s not a supported type", action.GetActionName())
}
