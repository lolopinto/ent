package tscode

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"text/template"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/util"
)

type Step struct{
	m sync.Mutex
	nodeType []enumData
	edgeType []enumData
}

func (s *Step) Name() string {
	return "codegen"
}

var nodeType = regexp.MustCompile(`(\w+)Type`)
var edgeType = regexp.MustCompile(`(\w+)Edge`)


func (s *Step) ProcessData(data *codegen.Data) error {
	var wg sync.WaitGroup
	wg.Add(len(data.Schema.Nodes))
	var serr syncerr.Error

	for key := range data.Schema.Nodes {
		go func(key string) {
			defer wg.Done()

			info := data.Schema.Nodes[key]
			nodeData := info.NodeData

			if err := s.accumulateConsts(nodeData); err != nil {
				serr.Append(err)
				return
			}

			if !info.ShouldCodegen {
				return
			}

			if nodeData.PackageName == "" {
				serr.Append(fmt.Errorf("invalid node with no package"))
				return
			}

			if err := writeBaseModelFile(nodeData, data.CodePath); err != nil {
				serr.Append(err)
				return
			}
			if err := writeEntFile(nodeData, data.CodePath); err != nil {
				serr.Append(err)
				return
			}
		}(key)
	}

	wg.Wait()
	if err := serr.Err(); err != nil {
		return err
	}
	return writeConstFile(s.nodeType, s.edgeType)
}

func (s *Step) addNodeType(name, value, comment string) {
	s.m.Lock()
	defer s.m.Unlock()
	s.nodeType = append(s.nodeType, enumData{
		Name: name,
		Value: value,
		Comment: comment,
	})
}

func (s *Step) addEdgeType(name, value, comment string) {
	s.m.Lock()
	defer s.m.Unlock()
	s.edgeType = append(s.edgeType, enumData{
		Name: name,
		Value: value,
		Comment: comment,
	})
}

// take what exists for go and convert it to typescript format
// should probably fix this at some point upstream
func (s *Step) accumulateConsts(nodeData *schema.NodeData) error {
	for key, group := range nodeData.ConstantGroups {
		if key != "ent.NodeType" && key != "ent.EdgeType" {
			continue
		}
		constType := strings.Split(key, ".")[1]

		for _, constant := range group.Constants {
			switch constType {
			case "NodeType":
				match := nodeType.FindStringSubmatch(constant.ConstName)
				if len(match) != 2 {
					return fmt.Errorf("%s is not a valid node type", constant.ConstName)
				}
				comment := strings.ReplaceAll(constant.Comment, constant.ConstName, match[1])

				s.addNodeType(match[1], constant.ConstValue, comment)
			break
			
			case "EdgeType":
				match := edgeType.FindStringSubmatch(constant.ConstName)
				if len(match) != 2 {
					return fmt.Errorf("%s is not a valid edge type", constant.ConstName)
				}
				comment := strings.ReplaceAll(constant.Comment, constant.ConstName, match[1])

				s.addEdgeType(match[1], constant.ConstValue, comment)
				break
			}
		}
	}
	return nil
}


var _ codegen.Step = &Step{}

// todo standardize this? same as in internal/code
type nodeTemplateCodePath struct {
	NodeData *schema.NodeData
	CodePath *codegen.CodePath
}

type enumData struct {
	Name string
	Value string
	Comment string
}

func getFilePathForBaseModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/generated/%s_base.ts", nodeData.PackageName)
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s.ts", nodeData.PackageName)
}

func getFilePathForConstFile() string {
	return fmt.Sprintf("src/ent/const.ts")
}

func writeBaseModelFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("base.tmpl"),
		TemplateName:      "base.tmpl",
		PathToFile:        getFilePathForBaseModelFile(nodeData),
		FormatSource:      true,
		FuncMap:           template.FuncMap{},
	})
}

func writeEntFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ent.tmpl"),
		TemplateName:      "ent.tmpl",
		PathToFile:        getFilePathForModelFile(nodeData),
		FormatSource:      true,
		FuncMap:           template.FuncMap{},
		// only write this file once.
		// TODO need a flag to overwrite this later.
	}, file.WriteOnce())
}

func writeConstFile(nodeData []enumData, edgeData []enumData) error {
	// sort data so that the enum is stable
	sort.Slice(nodeData, func(i, j int) bool {
		return nodeData[i].Name < nodeData[j].Name
	})
	sort.Slice(edgeData, func(i, j int) bool {
		return edgeData[i].Name < edgeData[j].Name
	})

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: struct {
			NodeData []enumData
			EdgeData []enumData
		} {
			nodeData,
			edgeData,
		},
		AbsPathToTemplate: util.GetAbsolutePath("const.tmpl"),
		TemplateName:      "const.tmpl",
		PathToFile:        getFilePathForConstFile(),
		FormatSource:      true,
		FuncMap:           template.FuncMap{},
	})
}