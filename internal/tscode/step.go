package tscode

import (
	"fmt"
	"strconv"
	"sync"
	"text/template"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/util"
)

type Step struct{}

func (s *Step) Name() string {
	return "codegen"
}

// TODO enum file
func (s *Step) ProcessData(data *codegen.Data) error {
	var wg sync.WaitGroup
	wg.Add(len(data.Schema.Nodes))
	var serr syncerr.Error
	for key := range data.Schema.Nodes {
		go func(key string) {
			defer wg.Done()

			info := data.Schema.Nodes[key]
			if !info.ShouldCodegen {
				return
			}

			nodeData := info.NodeData

			if nodeData.PackageName == "" {
				serr.Append(fmt.Errorf("invalid node with no package"))
				return
			}

			if err := writeModelFile(nodeData, data.CodePath); err != nil {
				serr.Append(err)
				return
			}

		}(key)
	}

	wg.Wait()
	return serr.Err()
}

var _ codegen.Step = &Step{}

// todo standardize this? same as in internal/code
type nodeTemplateCodePath struct {
	NodeData *schema.NodeData
	CodePath *codegen.CodePath
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s.ts", nodeData.PackageName)
}

func writeModelFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
		},
		AbsPathToTemplate: util.GetAbsolutePath("node.tmpl"),
		TemplateName:      "node.tmpl",
		PathToFile:        getFilePathForModelFile(nodeData),
		FuncMap: template.FuncMap{
			// TODO figure out which methods we actually need
			"fTypeString":           field.GetNilableGoType,
			"notNullableTypeString": field.GetNonNilableGoType,
			"quoteStr":              strconv.Quote,
		},
	})
}
