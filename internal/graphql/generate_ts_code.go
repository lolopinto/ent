package graphql

import (
	"fmt"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type TSStep struct {
}

func (p *TSStep) Name() string {
	return "graphql"
}

func (p *TSStep) ProcessData(data *codegen.Data) error {
	var wg sync.WaitGroup
	wg.Add(len(data.Schema.Nodes))
	var serr syncerr.Error

	for key := range data.Schema.Nodes {
		go func(key string) {
			defer wg.Done()

			info := data.Schema.Nodes[key]
			nodeData := info.NodeData

			// nothing to do here
			if nodeData.HideFromGraphQL {
				return
			}

			if err := writeTypeFile(nodeData); err != nil {
				serr.Append(err)
				return
			}
		}(key)
	}
	wg.Wait()

	if err := serr.Err(); err != nil {
		return err
	}
	return writeQueryFile(data)
}

var _ codegen.Step = &TSStep{}

func getFilePathForObjectFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", nodeData.PackageName)
}

func getQueryFilePath() string {
	return fmt.Sprintf("src/graphql/resolvers/generated/query_type.ts")
}

type gqlobjectData struct {
	NodeData  *schema.NodeData
	EdgeNodes []queryGQLDatum
}

// write graphql file
func writeTypeFile(nodeData *schema.NodeData) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlobjectData{
			NodeData:  nodeData,
			EdgeNodes: getEdgeNodes(nodeData),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/object.tmpl"),
		TemplateName:      "object.tmpl",
		PathToFile:        getFilePathForObjectFile(nodeData),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func getEdgeNodes(nodeData *schema.NodeData) []queryGQLDatum {
	var results []queryGQLDatum

	for _, node := range nodeData.GetUniqueNodes() {
		results = append(results, queryGQLDatum{
			ImportPath:  fmt.Sprintf("./%s_type", node.PackageName),
			GraphQLType: fmt.Sprintf("%sType", node.Node),
		})
	}
	return results
}

// TODO rename this...
type queryGQLDatum struct {
	ImportPath  string
	GraphQLName string
	GraphQLType string
}

type gqlQueryData struct {
	Queries []queryGQLDatum
}

func getQueryData(data *codegen.Data) []queryGQLDatum {
	var results []queryGQLDatum
	for key := range data.Schema.Nodes {

		nodeData := data.Schema.Nodes[key].NodeData
		if nodeData.HideFromGraphQL {
			continue
		}
		results = append(results, queryGQLDatum{
			ImportPath:  fmt.Sprintf("./%s_type", nodeData.PackageName),
			GraphQLType: fmt.Sprintf("%sQuery", nodeData.Node),
			GraphQLName: strcase.ToLowerCamel(nodeData.Node),
		})

	}
	return results
}

func writeQueryFile(data *codegen.Data) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlQueryData{
			Queries: getQueryData(data),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/query.tmpl"),
		TemplateName:      "query.tmpl",
		PathToFile:        getQueryFilePath(),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}
