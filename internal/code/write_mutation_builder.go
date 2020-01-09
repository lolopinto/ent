package code

import (
	"fmt"
	"text/template"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/imports"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/util"
)

func writeMutationBuilderFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	fileName := strcase.ToSnake(fmt.Sprintf("%s_mutation_builder_gen.go", nodeData.PackageName))

	imps := imports.Imports{}
	return file.Write(
		&file.TemplatedBasedFileWriter{
			Data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			AbsPathToTemplate: util.GetAbsolutePath("mutation_builder.gotmpl"),
			TemplateName:      "mutation_builder.gotmpl",
			PathToFile:        fmt.Sprintf("models/%s/%s", nodeData.PackageName, fileName),
			CreateDirIfNeeded: true,
			FormatSource:      true,
			PackageName:       nodeData.PackageName, // TODO
			Imports:           &imps,
			FuncMap: template.FuncMap{
				// our own version of reserveImport similar to what gqlgen provides. TOOD rename
				"reserveImport": imps.Reserve,
				"lookupImport":  imps.Lookup,
				"fTypeString":   field.GetNonNilableType,
				"fieldInfos":    action.GetFieldsFromFields,
				"edgeInfos":     action.GetEdgesFromEdges,
			},
		},
	)
}
