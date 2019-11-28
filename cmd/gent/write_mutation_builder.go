package main

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
)

func writeMutationBuilderFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) {
	fileName := strcase.ToSnake(fmt.Sprintf("%s_mutation_builder.go", nodeData.PackageName))

	imps := imports.Imports{}
	file.Write(
		&file.TemplatedBasedFileWriter{
			Data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			PathToTemplate:    "templates/mutation_builder.tmpl",
			TemplateName:      "mutation_builder.tmpl",
			PathToFile:        fmt.Sprintf("models/%s/%s.go", nodeData.PackageName, fileName),
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
