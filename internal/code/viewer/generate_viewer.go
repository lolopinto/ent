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

func WriteViewerFiles(cfg *codegen.Config, node, app string, forceOverwrite bool) error {
	errChan := writeViewer(cfg, node, app, forceOverwrite)
	graphqlErrChan := writeGraphQLViewer(cfg, node, app, forceOverwrite)

	return util.CoalesceErr(<-errChan, <-graphqlErrChan)
}

type viewerData struct {
	CodePath     *codegen.Config
	VCName       string
	NodeName     string
	InstanceName string
}

func writeViewer(cfg *codegen.Config, node, app string, forceOverwrite bool) chan error {
	ret := make(chan error)
	go func() {
		vcName := fmt.Sprintf("%sViewerContext", strcase.ToCamel(app))
		imps := imports.Imports{}

		writer := &file.TemplatedBasedFileWriter{
			Config: cfg,
			Data: viewerData{
				CodePath:     cfg,
				VCName:       vcName,
				NodeName:     strcase.ToCamel(node),
				InstanceName: strcase.ToLowerCamel(node),
			},
			AbsPathToTemplate: util.GetAbsolutePath("viewer_context.gotmpl"),
			TemplateName:      "viewer_context.gotmpl",
			PathToFile:        getFilePath(app),
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

func writeGraphQLViewer(cfg *codegen.Config, node, app string, forceOverwrite bool) chan error {
	ret := make(chan error)
	go func() {
		vcName := fmt.Sprintf("%sViewerContext", strcase.ToCamel(app))
		imps := imports.Imports{}

		writer := &file.TemplatedBasedFileWriter{
			Config: cfg,
			Data: graphQLViewerData{
				viewerData: viewerData{
					CodePath:     cfg,
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
					cfg.GetImportPathToRoot(),
					packageName(app),
				),
			},
			AbsPathToTemplate: util.GetAbsolutePath("graphql_viewer.gotmpl"),
			TemplateName:      "graphql_viewer.gotmpl",
			PathToFile:        getGraphQLFilePath(),
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
