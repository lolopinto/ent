package code

import (
	"fmt"
	"strconv"
	"text/template"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/imports"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/util"
)

type nodeTemplateCodePath struct {
	NodeData *schema.NodeData
	Config   *codegen.Config
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("models/%s_gen.go", nodeData.PackageName)
}

func writeModelFile(nodeData *schema.NodeData, cfg *codegen.Config) error {
	imps := imports.Imports{}

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: cfg,
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			Config:   cfg,
		},
		AbsPathToTemplate: util.GetAbsolutePath("node.gotmpl"),
		TemplateName:      "node.gotmpl",
		PathToFile:        getFilePathForModelFile(nodeData),
		PackageName:       "models",
		Imports:           &imps,
		FuncMap: template.FuncMap{
			"fTypeString":           field.GetNilableGoType,
			"notNullableTypeString": field.GetNonNilableGoType,
			"quoteStr":              strconv.Quote,
			// our own version of reserveImport similar to what gqlgen provides. TOOD rename
			"reserveImport": imps.Reserve,
			"lookupImport":  imps.Lookup,
		},
	})
}

func writePrivacyFile(nodeData *schema.NodeData, cfg *codegen.Config) error {
	pathToFile := fmt.Sprintf("models/%s_privacy_gen.go", nodeData.PackageName)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            cfg,
		Data:              nodeData,
		AbsPathToTemplate: util.GetAbsolutePath("privacy.gotmpl"),
		TemplateName:      "privacy.gotmpl",
		PathToFile:        pathToFile,
	})
}
