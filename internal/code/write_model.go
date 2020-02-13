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
	CodePath *codegen.CodePath
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("models/%s_gen.go", nodeData.PackageName)
}

func writeModelFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	imps := imports.Imports{}

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
		},
		AbsPathToTemplate: util.GetAbsolutePath("node.gotmpl"),
		TemplateName:      "node.gotmpl",
		PathToFile:        getFilePathForModelFile(nodeData),
		FormatSource:      true,
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

func writePrivacyFile(nodeData *schema.NodeData) error {
	pathToFile := fmt.Sprintf("models/%s_privacy_gen.go", nodeData.PackageName)

	return file.Write(&file.TemplatedBasedFileWriter{
		Data:              nodeData,
		AbsPathToTemplate: util.GetAbsolutePath("privacy.gotmpl"),
		TemplateName:      "privacy.gotmpl",
		PathToFile:        pathToFile,
		FormatSource:      true,
	})
}
