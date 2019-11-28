package main

import (
	"fmt"
	"strconv"

	"text/template"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
)

func parseAllSchemaFiles(rootPath string, specificConfigs ...string) *schema.Schema {
	p := &schemaparser.ConfigSchemaParser{
		RootPath: rootPath,
	}

	return schema.Parse(p, specificConfigs...)
}

// parseSchemasFromSource is mostly used by tests to test quick one-off scenarios
func parseSchemasFromSource(sources map[string]string, specificConfigs ...string) *schema.Schema {
	p := &schemaparser.SourceSchemaParser{
		Sources: sources,
	}
	return schema.Parse(p, specificConfigs...)
}

func parseSchemasAndGenerate(rootPath string, specificConfig string, codePathInfo *codegen.CodePath) {
	schema := parseAllSchemaFiles(rootPath, specificConfig)

	if len(schema.Nodes) == 0 {
		return
	}

	// TOOD validate things here first.

	data := &codegen.Data{schema, codePathInfo}

	// TODO refactor these from being called sequentially to something that can be called in parallel
	// Right now, they're being called sequentially
	// I don't see any reason why some can't be done in parrallel
	// 0/ generate consts. has to block everything (not a plugin could be?) however blocking
	// 1/ db
	// 2/ create new nodes (blocked by db) since assoc_edge_config table may not exist yet
	// 3/ model files. should be able to run on its own
	// 4/ graphql should be able to run on its own

	steps := []codegen.Step{
		new(db.Step),
		new(entCodegenPlugin),
		new(graphql.Step),
	}

	for _, s := range steps {
		s.ProcessData(data)
	}
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("models/%s.go", nodeData.PackageName)
}

type nodeTemplateCodePath struct {
	NodeData *schema.NodeData
	CodePath *codegen.CodePath
}

func writeModelFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) {
	file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
		},
		PathToTemplate: "templates/node.tmpl",
		TemplateName:   "node.tmpl",
		PathToFile:     getFilePathForModelFile(nodeData),
		FormatSource:   true,
		FuncMap: template.FuncMap{
			"fTypeString": field.GetNilableTypeInStructDefinition,
			"quoteStr":    strconv.Quote,
		},
	})
}

type actionTemplate struct {
	Action   action.Action
	CodePath *codegen.CodePath
}

func writePrivacyFile(nodeData *schema.NodeData) {
	pathToFile := fmt.Sprintf("models/%s_privacy.go", nodeData.PackageName)

	file.Write(&file.TemplatedBasedFileWriter{
		Data:               nodeData,
		PathToTemplate:     "templates/privacy.tmpl",
		TemplateName:       "privacy.tmpl",
		PathToFile:         pathToFile,
		CheckForManualCode: true,
		FormatSource:       true,
	})
}
