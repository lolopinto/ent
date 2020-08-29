package tscode

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"text/template"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type Step struct {
	m        sync.Mutex
	nodeType []enum.Data
	edgeType []enum.Data
}

func (s *Step) Name() string {
	return "codegen"
}

var nodeType = regexp.MustCompile(`(\w+)Type`)

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

			if len(nodeData.ActionInfo.Actions) == 0 {
				return
			}

			if err := writeBuilderFile(nodeData, data.CodePath); err != nil {
				serr.Append(err)
			}

			// write all the actions concurrently
			var actionsWg sync.WaitGroup
			actionsWg.Add(len(nodeData.ActionInfo.Actions))
			for idx := range nodeData.ActionInfo.Actions {
				go func(idx int) {
					defer actionsWg.Done()

					action := nodeData.ActionInfo.Actions[idx]
					if err := writeBaseActionFile(nodeData, data.CodePath, action); err != nil {
						serr.Append(err)
					}

					if err := writeActionFile(nodeData, data.CodePath, action); err != nil {
						serr.Append(err)
					}

				}(idx)
			}
			actionsWg.Wait()
		}(key)
	}

	wg.Add(len(data.Schema.Enums))
	for idx := range data.Schema.Enums {
		go func(idx int) {
			defer wg.Done()

			info := data.Schema.Enums[idx]

			// enum is rendered in same file as a Node so no need to render it on its own
			if info.NodeData != nil {
				return
			}

			serr.Append(writeEnumFile(info, data.CodePath))
		}(idx)
	}
	wg.Wait()
	if err := serr.Err(); err != nil {
		return err
	}
	// sort data so that the enum is stable
	sort.Slice(s.nodeType, func(i, j int) bool {
		return s.nodeType[i].Name < s.nodeType[j].Name
	})
	sort.Slice(s.edgeType, func(i, j int) bool {
		return s.edgeType[i].Name < s.edgeType[j].Name
	})
	if err := writeConstFile(s.nodeType, s.edgeType); err != nil {
		return err
	}
	return writeLoadAnyFile(s.nodeType, data.CodePath)
}

func (s *Step) addNodeType(name, value, comment string, nodeData *schema.NodeData) {
	s.m.Lock()
	defer s.m.Unlock()
	s.nodeType = append(s.nodeType, enum.Data{
		Name:    name,
		Value:   value,
		Comment: comment,
		// needed for loadAny.ts
		PackagePath: getImportPathForModelFile(nodeData),
	})
}

func (s *Step) addEdgeType(name, value, comment string) {
	s.m.Lock()
	defer s.m.Unlock()
	s.edgeType = append(s.edgeType, enum.Data{
		Name:    name,
		Value:   value,
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

				s.addNodeType(match[1], constant.ConstValue, comment, nodeData)
				break

			case "EdgeType":
				constName, err := edge.TsEdgeConst(constant.ConstName)
				if err != nil {
					return err
				}
				comment := strings.ReplaceAll(constant.Comment, constant.ConstName, constName)

				s.addEdgeType(constName, constant.ConstValue, comment)
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
	Package  *codegen.ImportPackage
}

// copied to internal/schema/node_data.go
func getFilePathForBaseModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/generated/%s_base.ts", nodeData.PackageName)
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s.ts", nodeData.PackageName)
}

func getFilePathForEnumFile(info *schema.EnumInfo) string {
	return fmt.Sprintf("src/ent/generated/%s.ts", strcase.ToSnake(info.Enum.Name))
}

func getImportPathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s", nodeData.PackageName)
}

func getFilePathForConstFile() string {
	return fmt.Sprintf("src/ent/const.ts")
}

func getFilePathForLoadAnyFile() string {
	return fmt.Sprintf("src/ent/loadAny.ts")
}

func getFilePathForBuilderFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s/actions/%s_builder.ts", nodeData.PackageName, nodeData.PackageName)
}

func getImportPathForBuilderFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s/actions/%s_builder", nodeData.PackageName, nodeData.PackageName)
}

func getFilePathForActionBaseFile(nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return fmt.Sprintf("src/ent/%s/actions/generated/%s_base.ts", nodeData.PackageName, fileName)
}

func getImportPathForActionBaseFile(nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return fmt.Sprintf("src/ent/%s/actions/generated/%s_base", nodeData.PackageName, fileName)
}

func getFilePathForActionFile(nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return fmt.Sprintf("src/ent/%s/actions/%s.ts", nodeData.PackageName, fileName)
}

func writeBaseModelFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	imps := tsimport.NewImports()

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
			Package:  codePathInfo.GetImportPackage(),
		},
		CreateDirIfNeeded:  true,
		AbsPathToTemplate:  util.GetAbsolutePath("base.tmpl"),
		TemplateName:       "base.tmpl",
		OtherTemplateFiles: []string{util.GetAbsolutePath("../schema/enum/enum.tmpl")},
		PathToFile:         getFilePathForBaseModelFile(nodeData),
		FormatSource:       true,
		TsImports:          imps,
		FuncMap:            imps.FuncMap(),
	})
}

func writeEntFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	imps := tsimport.NewImports()
	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
			Package:  codePathInfo.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ent.tmpl"),
		TemplateName:      "ent.tmpl",
		PathToFile:        getFilePathForModelFile(nodeData),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
		// only write this file once.
		// TODO need a flag to overwrite this later.
	}, file.WriteOnce())
}

func writeEnumFile(enumInfo *schema.EnumInfo, codePathInfo *codegen.CodePath) error {
	imps := tsimport.NewImports()
	return file.Write(&file.TemplatedBasedFileWriter{
		// enum file can be rendered on its own so just render it
		Data:              enumInfo.Enum,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("../schema/enum/enum.tmpl"),
		TemplateName:      "enum.tmpl",
		PathToFile:        getFilePathForEnumFile(enumInfo),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeConstFile(nodeData []enum.Data, edgeData []enum.Data) error {
	// sort data so that the enum is stable
	sort.Slice(nodeData, func(i, j int) bool {
		return nodeData[i].Name < nodeData[j].Name
	})
	sort.Slice(edgeData, func(i, j int) bool {
		return edgeData[i].Name < edgeData[j].Name
	})

	imps := tsimport.NewImports()

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: struct {
			NodeType enum.Enum
			EdgeType enum.Enum
		}{
			enum.Enum{
				Name:   "NodeType",
				Values: nodeData,
			},
			enum.Enum{
				Name:   "EdgeType",
				Values: edgeData,
			},
		},
		AbsPathToTemplate: util.GetAbsolutePath("const.tmpl"),
		TemplateName:      "const.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("../schema/enum/enum.tmpl"),
		},
		PathToFile:   getFilePathForConstFile(),
		FormatSource: true,
		TsImports:    imps,
		FuncMap:      imps.FuncMap(),
	})
}

func writeLoadAnyFile(nodeData []enum.Data, codePathInfo *codegen.CodePath) error {
	imps := tsimport.NewImports()

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: struct {
			NodeData []enum.Data
			Package  *codegen.ImportPackage
		}{
			nodeData,
			codePathInfo.GetImportPackage(),
		},
		AbsPathToTemplate: util.GetAbsolutePath("loadAny.tmpl"),
		TemplateName:      "loadAny.tmpl",
		PathToFile:        getFilePathForLoadAnyFile(),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeBuilderFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) error {
	imps := tsimport.NewImports()

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: codePathInfo,
			Package:  codePathInfo.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("builder.tmpl"),
		TemplateName:      "builder.tmpl",
		PathToFile:        getFilePathForBuilderFile(nodeData),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           getBuilderFuncs(imps),
	})
}

func getBuilderFuncs(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["edgeInfos"] = action.GetEdgesFromEdges

	return m
}
