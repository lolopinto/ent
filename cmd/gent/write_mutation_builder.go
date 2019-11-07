package main

import (
	"fmt"
	"text/template"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/imports"
	"github.com/lolopinto/ent/internal/schema"
)

func writeMutationBuilderFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) {
	fileName := strcase.ToSnake(fmt.Sprintf("%s_mutation_builder.go", nodeData.PackageName))

	imps := imports.Imports{}
	writeFile(
		&templatedBasedFileWriter{
			data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			pathToTemplate:    "templates/mutation_builder.tmpl",
			templateName:      "mutation_builder.tmpl",
			pathToFile:        fmt.Sprintf("models/%s/%s.go", nodeData.PackageName, fileName),
			createDirIfNeeded: true,
			formatSource:      true,
			packageName:       nodeData.PackageName, // TODO
			imports:           &imps,
			funcMap: template.FuncMap{
				// our own version of reserveImport similar to what gqlgen provides. TOOD rename
				"reserveImport": imps.Reserve,
				"lookupImport":  imps.Lookup,
				"fTypeString":   field.GetTypeInStructDefinition,
				"fieldInfos":    action.GetFieldsFromFields,
				"edgeInfos":     action.GetEdgesFromEdges,
			},
		},
	)
}
