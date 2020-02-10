package viewer

import (
	"fmt"
	"path/filepath"
	"text/template"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/imports"
	"github.com/lolopinto/ent/internal/util"
)

func WriteViewerFiles(codePathInfo *codegen.CodePath, node, app string, forceOverwrite bool) error {
	errChan := writeViewer(codePathInfo, node, app, forceOverwrite)
	graphqlErrChan := writeGraphQLViewer(codePathInfo, node, app, forceOverwrite)

	return util.CoalesceErr(<-errChan, <-graphqlErrChan)
}

type viewerData struct {
	CodePath     *codegen.CodePath
	VCName       string
	NodeName     string
	InstanceName string
}

func writeViewer(codePathInfo *codegen.CodePath, node, app string, forceOverwrite bool) chan error {
	ret := make(chan error)
	go func() {
		vcName := fmt.Sprintf("%sViewerContext", strcase.ToCamel(app))
		imps := imports.Imports{}

		writer := &file.TemplatedBasedFileWriter{
			Data: viewerData{
				CodePath:     codePathInfo,
				VCName:       vcName,
				NodeName:     strcase.ToCamel(node),
				InstanceName: strcase.ToLowerCamel(node),
			},
			AbsPathToTemplate: util.GetAbsolutePath("viewer_context.gotmpl"),
			TemplateName:      "viewer_context.gotmpl",
			PathToFile:        getFilePath(app),
			FormatSource:      true,
			PackageName:       packageName(app),
			Imports:           &imps,
			CreateDirIfNeeded: true,
			EditableCode:      true,
			FuncMap: template.FuncMap{
				// our own version of reserveImport similar to what gqlgen provides. TOOD rename
				"reserveImport": imps.Reserve,
				"lookupImport":  imps.Lookup,
			},
		}
		ret <- file.Write(writer, file.WriteOnceMaybe(forceOverwrite))
	}()
	return ret
}

type graphQLViewerData struct {
	viewerData
	AppViewer            string
	AppViewerPackageName string
}

func writeGraphQLViewer(codePathInfo *codegen.CodePath, node, app string, forceOverwrite bool) chan error {
	ret := make(chan error)
	go func() {
		vcName := fmt.Sprintf("%sViewerContext", strcase.ToCamel(app))
		imps := imports.Imports{}

		writer := &file.TemplatedBasedFileWriter{
			Data: graphQLViewerData{
				viewerData: viewerData{
					CodePath:     codePathInfo,
					VCName:       vcName,
					NodeName:     strcase.ToCamel(node),
					InstanceName: strcase.ToLowerCamel(node),
				},
				AppViewer: fmt.Sprintf(
					"*%s.%s",
					packageName(app),
					vcName,
				),
				AppViewerPackageName: filepath.Join(
					codePathInfo.GetImportPathToRoot(),
					packageName(app),
				),
			},
			AbsPathToTemplate: util.GetAbsolutePath("graphql_viewer.gotmpl"),
			TemplateName:      "graphql_viewer.gotmpl",
			PathToFile:        getGraphQLFilePath(),
			FormatSource:      true,
			PackageName:       "viewer",
			Imports:           &imps,
			CreateDirIfNeeded: true,
			EditableCode:      true,
			FuncMap: template.FuncMap{
				// our own version of reserveImport similar to what gqlgen provides. TOOD rename
				"reserveImport": imps.Reserve,
				"lookupImport":  imps.Lookup,
			},
		}
		ret <- file.Write(writer, file.WriteOnceMaybe(forceOverwrite))

	}()
	return ret
}

func getFilePath(app string) string {
	return fmt.Sprintf("%sviewer/%s_viewer_context.go", app, app)
}

func getGraphQLFilePath() string {
	return "graphql/viewer/viewer.go"
}

func packageName(app string) string {
	return fmt.Sprintf("%sviewer", app)
}
