package tscode

import (
	"fmt"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"text/template"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type Step struct {
	m         sync.Mutex
	nodeTypes []enum.Data
	edgeTypes []enum.Data
}

func (s *Step) Name() string {
	return "codegen"
}

var nodeType = regexp.MustCompile(`(\w+)Type`)

type writeFileFn func() error
type writeFileFnList []writeFileFn

func (s *Step) processNode(processor *codegen.Processor, info *schema.NodeDataInfo, serr *syncerr.Error) writeFileFnList {
	var ret writeFileFnList
	nodeData := info.NodeData

	if err := s.accumulateConsts(nodeData); err != nil {
		serr.Append(err)
		return ret
	}

	if !info.ShouldCodegen {
		return ret
	}

	if nodeData.PackageName == "" {
		serr.Append(fmt.Errorf("invalid node with no package"))
		return ret
	}

	ret = append(ret, func() error {
		return writeBaseModelFile(nodeData, processor)
	})
	ret = append(ret, func() error {
		return writeEntFile(nodeData, processor)
	})

	ret = append(ret, s.processActions(processor, nodeData)...)
	ret = append(ret, s.processEdges(processor, nodeData)...)

	return ret
}

func (s *Step) processPattern(processor *codegen.Processor, pattern *schema.PatternInfo, serr *syncerr.Error) writeFileFnList {
	var ret writeFileFnList

	if err := s.accumulateConsts(pattern); err != nil {
		serr.Append(err)
		return ret
	}

	if len(pattern.AssocEdges) == 0 {
		return ret
	}

	ret = append(ret, func() error {
		return writeBasePatternQueryFile(processor, pattern)
	})
	for idx := range pattern.AssocEdges {
		edge := pattern.AssocEdges[idx]
		ret = append(ret, func() error {
			return writeAssocEdgeQueryFile(
				processor,
				edge,
				"Ent",
				getFilePathForPatternAssocEdgeQueryFile(processor.Config, pattern, edge),
			)
		})
	}

	return ret
}
func (s *Step) processActions(processor *codegen.Processor, nodeData *schema.NodeData) writeFileFnList {
	var ret writeFileFnList

	if len(nodeData.ActionInfo.Actions) == 0 {
		return ret
	}

	ret = append(ret, func() error {
		return writeBuilderFile(nodeData, processor)
	})

	for idx := range nodeData.ActionInfo.Actions {
		action := nodeData.ActionInfo.Actions[idx]
		ret = append(ret, func() error {
			return writeBaseActionFile(nodeData, processor, action)
		})

		ret = append(ret, func() error {
			return writeActionFile(nodeData, processor, action)
		})
	}
	return ret
}

func (s *Step) processEdges(processor *codegen.Processor, nodeData *schema.NodeData) writeFileFnList {
	var ret writeFileFnList

	if nodeData.EdgeInfo.CreateEdgeBaseFile() {
		ret = append(ret, func() error {
			return writeBaseQueryFile(processor, nodeData)
		})
	}

	for idx := range nodeData.EdgeInfo.Associations {
		edge := nodeData.EdgeInfo.Associations[idx]
		ret = append(ret, func() error {
			return writeAssocEdgeQueryFile(
				processor,
				edge,
				nodeData.Node,
				getFilePathForAssocEdgeQueryFile(processor.Config, nodeData, edge),
			)
		})
	}

	// edges with IndexLoaderFactory
	edges := nodeData.EdgeInfo.GetEdgesForIndexLoader()
	for idx := range edges {
		edge := edges[idx]
		ret = append(ret, func() error {
			return writeCustomEdgeQueryFile(processor, nodeData, edge)
		})
	}
	return ret
}

func (s *Step) ProcessData(processor *codegen.Processor) error {
	fmt.Println("generating ent code...")
	var serr syncerr.Error

	var funcs writeFileFnList
	for _, p := range processor.Schema.Patterns {
		funcs = append(funcs, s.processPattern(processor, p, &serr)...)
	}
	for _, info := range processor.Schema.Nodes {
		funcs = append(funcs, s.processNode(processor, info, &serr)...)
	}

	for _, info := range processor.Schema.Enums {
		// only lookup table enums get their own files
		if !info.LookupTableEnum() {
			continue
		}
		funcs = append(funcs, func() error {
			return writeEnumFile(info, processor)
		})
	}

	// sort data so that the enum is stable
	sort.Slice(s.nodeTypes, func(i, j int) bool {
		return s.nodeTypes[i].Name < s.nodeTypes[j].Name
	})
	sort.Slice(s.edgeTypes, func(i, j int) bool {
		return s.edgeTypes[i].Name < s.edgeTypes[j].Name
	})

	funcs = append(funcs,
		func() error {
			return writeConstFile(processor, s.nodeTypes, s.edgeTypes)
		},
		func() error {
			return writeInternalEntFile(processor.Schema, processor)
		},
		func() error {
			return writeEntIndexFile(processor)
		},
		func() error {
			return writeLoadAnyFile(s.nodeTypes, processor)
		},
	)

	// build up all the funcs and parallelize as much as possible

	var wg sync.WaitGroup
	wg.Add(len(funcs))
	for i := range funcs {
		go func(i int) {
			defer wg.Done()
			fn := funcs[i]
			serr.Append(fn())
		}(i)
	}
	wg.Wait()
	return serr.Err()
}

func (s *Step) addNodeType(name, value, comment string) {
	s.m.Lock()
	defer s.m.Unlock()
	s.nodeTypes = append(s.nodeTypes, enum.Data{
		Name:    name,
		Value:   value,
		Comment: comment,
	})
}

func (s *Step) addEdgeType(name, value, comment string) {
	s.m.Lock()
	defer s.m.Unlock()
	s.edgeTypes = append(s.edgeTypes, enum.Data{
		Name:    name,
		Value:   value,
		Comment: comment,
	})
}

// take what exists for go and convert it to typescript format
// should probably fix this at some point upstream
func (s *Step) accumulateConsts(wc schema.WithConst) error {
	for key, group := range wc.GetConstantGroups() {
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

			case "EdgeType":
				constName, err := edge.TsEdgeConst(constant.ConstName)
				if err != nil {
					return err
				}
				comment := strings.ReplaceAll(constant.Comment, constant.ConstName, constName)

				s.addEdgeType(constName, constant.ConstValue, comment)
			}
		}
	}
	return nil
}

var _ codegen.Step = &Step{}

// todo standardize this? same as in internal/code
type nodeTemplateCodePath struct {
	NodeData      *schema.NodeData
	CodePath      *codegen.Config
	Package       *codegen.ImportPackage
	Imports       []schema.ImportPath
	PrivacyConfig *codegen.PrivacyConfig
}

func getFilePathForBaseModelFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s_base.ts", nodeData.PackageName))
}

func getFilePathForModelFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/%s.ts", nodeData.PackageName))
}

func getFilePathForEnumFile(cfg *codegen.Config, info *schema.EnumInfo) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s.ts", strcase.ToSnake(info.Enum.Name)))
}

func getFilePathForBaseQueryFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s_query_base.ts", nodeData.PackageName))
}

func getFilePathForAssocEdgeQueryFile(cfg *codegen.Config, nodeData *schema.NodeData, e *edge.AssociationEdge) string {
	return path.Join(cfg.GetAbsPathToRoot(),
		fmt.Sprintf(
			"src/ent/%s/query/%s.ts",
			nodeData.PackageName,
			strcase.ToSnake(e.TsEdgeQueryName()),
		),
	)
}

func getFilePathForPatternBaseQueryFile(cfg *codegen.Config, pattern *schema.PatternInfo) string {
	// just so it doesn't conflict with nodes of same nams
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/patterns/%s_query_base.ts", strcase.ToSnake(pattern.Name)))
}

func getFilePathForPatternAssocEdgeQueryFile(cfg *codegen.Config, pattern *schema.PatternInfo, e *edge.AssociationEdge) string {
	return path.Join(cfg.GetAbsPathToRoot(),
		fmt.Sprintf(
			"src/ent/%s/query/%s.ts",
			// TODO there could be a conflict e.g. above...
			"patterns",
			//			pattern.Name,
			strcase.ToSnake(e.TsEdgeQueryName()),
		),
	)
}

func getFilePathForCustomEdgeQueryFile(cfg *codegen.Config, nodeData *schema.NodeData, e edge.ConnectionEdge) string {
	return path.Join(
		cfg.GetAbsPathToRoot(),
		fmt.Sprintf(
			"src/ent/%s/query/%s.ts",
			nodeData.PackageName,
			strcase.ToSnake(e.TsEdgeQueryName()),
		),
	)
}

func getImportPathForAssocEdgeQueryFile(nodeData *schema.NodeData, e *edge.AssociationEdge) string {
	return fmt.Sprintf(
		"src/ent/%s/query/%s",
		nodeData.PackageName,
		strcase.ToSnake(e.TsEdgeQueryName()),
	)
}

func getImportPathForPatternAssocEdgeQueryFile(e *edge.AssociationEdge) string {
	return fmt.Sprintf(
		"src/ent/%s/query/%s",
		// TODO...
		"patterns",
		strcase.ToSnake(e.TsEdgeQueryName()),
	)
}

func getImportPathForCustomEdgeQueryFile(nodeData *schema.NodeData, e edge.ConnectionEdge) string {
	return fmt.Sprintf(
		"src/ent/%s/query/%s",
		nodeData.PackageName,
		strcase.ToSnake(e.TsEdgeQueryName()),
	)
}

func getImportPathForEnumFile(info *schema.EnumInfo) string {
	return fmt.Sprintf("src/ent/generated/%s", strcase.ToSnake(info.Enum.Name))
}

// duplicated in generate_ts_code.go
func getImportPathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s", nodeData.PackageName)
}

func getImportPathForBaseModelFile(packageName string) string {
	return fmt.Sprintf("src/ent/generated/%s_base", packageName)
}

func getImportPathForBaseQueryFile(packageName string) string {
	return fmt.Sprintf("src/ent/generated/%s_query_base", packageName)
}

func getImportPathForPatternBaseQueryFile(name string) string {
	return fmt.Sprintf("src/ent/generated/patterns/%s_query_base", strcase.ToSnake(name))
}

func getFilePathForConstFile(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/ent/generated/const.ts")
}

func getFilePathForLoadAnyFile(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/ent/generated/loadAny.ts")
}

func getFilePathForBuilderFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/%s/actions/generated/%s_builder.ts", nodeData.PackageName, nodeData.PackageName))
}

func getImportPathForBuilderFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s/actions/generated/%s_builder", nodeData.PackageName, nodeData.PackageName)
}

func getFilePathForActionBaseFile(cfg *codegen.Config, nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/%s/actions/generated/%s_base.ts", nodeData.PackageName, fileName))
}

func getImportPathForActionBaseFile(nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return fmt.Sprintf("src/ent/%s/actions/generated/%s_base", nodeData.PackageName, fileName)
}

func getFilePathForActionFile(cfg *codegen.Config, nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/%s/actions/%s.ts", nodeData.PackageName, fileName))
}

func writeBaseModelFile(nodeData *schema.NodeData, processor *codegen.Processor) error {
	cfg := processor.Config
	filePath := getFilePathForBaseModelFile(cfg, nodeData)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: nodeTemplateCodePath{
			NodeData:      nodeData,
			CodePath:      cfg,
			Package:       cfg.GetImportPackage(),
			PrivacyConfig: cfg.GetDefaultEntPolicy(),
		},
		CreateDirIfNeeded:  true,
		AbsPathToTemplate:  util.GetAbsolutePath("base.tmpl"),
		TemplateName:       "base.tmpl",
		OtherTemplateFiles: []string{util.GetAbsolutePath("../schema/enum/enum.tmpl")},
		PathToFile:         filePath,
		TsImports:          imps,
		FuncMap:            getBaseFuncs(imps),
	})
}

func writeEntFile(nodeData *schema.NodeData, processor *codegen.Processor) error {
	cfg := processor.Config
	filePath := getFilePathForModelFile(cfg, nodeData)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: cfg,
			Package:  cfg.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ent.tmpl"),
		TemplateName:      "ent.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
		// only write this file once.
		// TODO need a flag to overwrite this later.
	}, file.WriteOnce())
}

func writeEnumFile(enumInfo *schema.EnumInfo, processor *codegen.Processor) error {
	filePath := getFilePathForEnumFile(processor.Config, enumInfo)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write(&file.TemplatedBasedFileWriter{
		// enum file can be rendered on its own so just render it
		Config:            processor.Config,
		Data:              enumInfo.Enum,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("../schema/enum/enum.tmpl"),
		TemplateName:      "enum.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeBaseQueryFile(processor *codegen.Processor, nodeData *schema.NodeData) error {
	imps, err := nodeData.GetImportsForQueryBaseFile(processor.Schema)
	if err != nil {
		return err
	}
	return writeBaseQueryFileImpl(processor, &BaseQueryEdgeInfo{
		Imports:      imps,
		AssocEdges:   nodeData.EdgeInfo.Associations,
		IndexedEdges: nodeData.EdgeInfo.GetEdgesForIndexLoader(),
		Node:         nodeData.Node,
		FilePath:     getFilePathForBaseQueryFile(processor.Config, nodeData),
	})
}

func writeAssocEdgeQueryFile(processor *codegen.Processor, e *edge.AssociationEdge, sourceNode, filePath string) error {
	cfg := processor.Config
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Edge       *edge.AssociationEdge
			Package    *codegen.ImportPackage
			SourceNode string
		}{
			Edge:       e,
			Package:    cfg.GetImportPackage(),
			SourceNode: sourceNode,
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("assoc_ent_query.tmpl"),
		TemplateName:      "assoc_ent_query.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
	}, file.WriteOnce())
}

func writeCustomEdgeQueryFile(processor *codegen.Processor, nodeData *schema.NodeData, e edge.ConnectionEdge) error {
	cfg := processor.Config
	filePath := getFilePathForCustomEdgeQueryFile(cfg, nodeData, e)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Package         *codegen.ImportPackage
			TsEdgeQueryName string
		}{
			Package:         cfg.GetImportPackage(),
			TsEdgeQueryName: e.TsEdgeQueryName(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("custom_ent_query.tmpl"),
		TemplateName:      "custom_ent_query.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
	}, file.WriteOnce())
}

type BaseQueryEdgeInfo struct {
	Imports      []schema.ImportPath
	AssocEdges   []*edge.AssociationEdge
	IndexedEdges []edge.IndexedConnectionEdge
	Node         string
	FilePath     string
}

func (b *BaseQueryEdgeInfo) SourcePolymorphic() bool {
	return b.Node == "Ent"
}

func writeBasePatternQueryFile(processor *codegen.Processor, pattern *schema.PatternInfo) error {
	imps, err := pattern.GetImportsForQueryBaseFile(processor.Schema)
	if err != nil {
		return err
	}

	return writeBaseQueryFileImpl(processor, &BaseQueryEdgeInfo{
		Imports:    imps,
		AssocEdges: pattern.GetSortedEdges(),
		Node:       "Ent",
		FilePath:   getFilePathForPatternBaseQueryFile(processor.Config, pattern),
	})
}

func writeBaseQueryFileImpl(processor *codegen.Processor, info *BaseQueryEdgeInfo) error {
	s := processor.Schema
	cfg := processor.Config
	imps := tsimport.NewImports(processor.Config, info.FilePath)

	var edges []*edge.AssociationEdge
	for _, edge := range info.AssocEdges {
		if edge.GenerateBase() {
			edges = append(edges, edge)
		}
	}
	info.AssocEdges = edges

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Info    *BaseQueryEdgeInfo
			Schema  *schema.Schema
			Package *codegen.ImportPackage
		}{
			Schema:  s,
			Info:    info,
			Package: cfg.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ent_query_base.tmpl"),
		TemplateName:      "ent_query_base.tmpl",
		PathToFile:        info.FilePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeConstFile(processor *codegen.Processor, nodeData []enum.Data, edgeData []enum.Data) error {
	cfg := processor.Config
	// sort data so that the enum is stable
	sort.Slice(nodeData, func(i, j int) bool {
		return nodeData[i].Name < nodeData[j].Name
	})
	sort.Slice(edgeData, func(i, j int) bool {
		return edgeData[i].Name < edgeData[j].Name
	})

	filePath := getFilePathForConstFile(cfg)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
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
		PathToFile:        filePath,
		TsImports:         imps,
		CreateDirIfNeeded: true,
		FuncMap:           imps.FuncMap(),
	})
}

func writeLoadAnyFile(nodeData []enum.Data, processor *codegen.Processor) error {
	cfg := processor.Config
	filePath := getFilePathForLoadAnyFile(cfg)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			NodeData []enum.Data
			Package  *codegen.ImportPackage
		}{
			nodeData,
			cfg.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("loadAny.tmpl"),
		TemplateName:      "loadAny.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func getSortedInternalEntFileLines(s *schema.Schema) []string {
	lines := []string{
		"src/ent/generated/const",
	}

	append2 := func(list *[]string, str string) {
		*list = append(*list, str)
	}

	var baseFiles []string
	for _, info := range s.Nodes {
		append2(&baseFiles, getImportPathForBaseModelFile(info.NodeData.PackageName))
	}

	var entFiles []string
	for _, info := range s.Nodes {
		append2(&entFiles, getImportPathForModelFile(info.NodeData))
	}

	var enums []string
	for _, enum := range s.Enums {
		if enum.LookupTableEnum() {
			append2(&enums, getImportPathForEnumFile(enum))
		}
	}

	var baseQueryFiles []string
	var queryFiles []string
	// add patterns first  after const
	// this whole import stack getting sad
	for _, pattern := range s.Patterns {
		if len(pattern.AssocEdges) == 0 {
			continue
		}
		append2(&baseFiles, getImportPathForPatternBaseQueryFile(pattern.Name))
		for _, edge := range pattern.GetSortedEdges() {
			append2(&baseFiles, getImportPathForPatternAssocEdgeQueryFile(edge))
		}
	}
	for _, info := range s.Nodes {
		if len(info.NodeData.EdgeInfo.Associations) != 0 {
			for _, edge := range info.NodeData.EdgeInfo.Associations {
				append2(&queryFiles, getImportPathForAssocEdgeQueryFile(info.NodeData, edge))
			}
		}

		for _, edge := range info.NodeData.EdgeInfo.GetEdgesForIndexLoader() {
			append2(&queryFiles, getImportPathForCustomEdgeQueryFile(info.NodeData, edge))
		}

		if info.NodeData.EdgeInfo.CreateEdgeBaseFile() {
			append2(&baseQueryFiles, getImportPathForBaseQueryFile(info.NodeData.PackageName))
		}
	}

	// bucket each group, make sure it's sorted within each bucket so that it doesn't randomly change
	// and make sure we get the order we want
	list := [][]string{
		baseFiles,
		entFiles,
		enums,
		baseQueryFiles,
		queryFiles,
	}
	for _, l := range list {
		sort.Strings(l)
		lines = append(lines, l...)
	}
	return lines
}

func writeInternalEntFile(s *schema.Schema, processor *codegen.Processor) error {
	cfg := processor.Config
	path := filepath.Join(cfg.GetAbsPathToRoot(), codepath.GetFilePathForInternalFile())
	imps := tsimport.NewImports(processor.Config, path)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		Data:              getSortedInternalEntFileLines(s),
		AbsPathToTemplate: util.GetAbsolutePath("internal.tmpl"),
		CreateDirIfNeeded: true,
		TemplateName:      "internal.tmpl",
		PathToFile:        path,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeEntIndexFile(processor *codegen.Processor) error {
	cfg := processor.Config
	path := filepath.Join(cfg.GetAbsPathToRoot(), codepath.GetFilePathForEntIndexFile())

	imps := tsimport.NewImports(processor.Config, path)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		AbsPathToTemplate: util.GetAbsolutePath("index.tmpl"),
		CreateDirIfNeeded: true,
		TemplateName:      "index.tmpl",
		PathToFile:        path,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeBuilderFile(nodeData *schema.NodeData, processor *codegen.Processor) error {
	cfg := processor.Config
	filePath := getFilePathForBuilderFile(cfg, nodeData)
	imps := tsimport.NewImports(processor.Config, filePath)

	imports, err := nodeData.GetImportsForBaseFile()
	if err != nil {
		return err
	}
	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: nodeTemplateCodePath{
			NodeData: nodeData,
			CodePath: cfg,
			Package:  cfg.GetImportPackage(),
			Imports:  imports,
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("builder.tmpl"),
		TemplateName:      "builder.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           getBuilderFuncs(imps),
	})
}

func getBuilderFuncs(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["edgeInfos"] = action.GetEdgesFromEdges

	return m
}

func getBaseFuncs(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["convertFunc"] = enttype.ConvertFunc

	return m
}
