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

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/fns"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/customtype"
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

type writeOptions struct {
	// anytime any boolean is added here, need to update the
	// else case in processNode
	writeMixin         bool
	writeEnt           bool
	writeBase          bool
	writeAllActions    bool
	writeAllEdges      bool
	writeBuilder       bool
	actionBaseFiles    map[string]bool
	actionFiles        map[string]bool
	deletedActionFiles map[string]bool
	edgeBaseFile       bool
	edgeFiles          map[string]bool
	deletedEdgeFiles   map[string]bool
	entAdded           bool
	entRemoved         bool
	edgeAdded          bool
	edgeRemoved        bool
}

func (s *Step) processCustomInterface(processor *codegen.Processor, ci *customtype.CustomInterface, serr *syncerr.Error) fns.FunctionList {
	// TODO this needs to depend on if that has changed
	var ret fns.FunctionList

	ret = append(ret, func() error {
		return writeCustomInterfaceFile(processor, ci)
	})
	return ret
}

func (s *Step) processNode(processor *codegen.Processor, info *schema.NodeDataInfo, serr *syncerr.Error) (fns.FunctionList, *writeOptions) {
	var ret fns.FunctionList
	nodeData := info.NodeData

	opts := &writeOptions{
		actionBaseFiles:    map[string]bool{},
		actionFiles:        map[string]bool{},
		edgeFiles:          map[string]bool{},
		deletedActionFiles: map[string]bool{},
		deletedEdgeFiles:   map[string]bool{},
	}

	if processor.Config.WriteAllFiles() {
		opts.writeAllActions = true
		opts.writeAllEdges = true
		opts.writeEnt = true
		opts.writeBase = true
		opts.writeBuilder = true
		opts.edgeBaseFile = true
	}

	if processor.Config.UseChanges() {
		changes := processor.ChangeMap
		nodeChanges := changes[info.NodeData.Node]

		for _, c := range nodeChanges {
			if c.GraphQLOnly {
				continue
			}
			switch c.Change {
			case change.AddNode:
				opts.writeEnt = true
				opts.writeBase = true
				opts.writeBuilder = true
				opts.entAdded = true

			case change.ModifyNode:
				opts.writeBase = true
				opts.writeBuilder = true

			case change.RemoveNode:
				opts.entRemoved = true

			case change.AddAction:
				opts.actionBaseFiles[c.Name] = true
				opts.actionFiles[c.Name] = true

			case change.ModifyAction:
				opts.actionBaseFiles[c.Name] = true

			case change.RemoveAction:
				opts.deletedActionFiles[c.Name] = true

			case change.AddEdge:
				opts.edgeBaseFile = true
				opts.edgeFiles[c.Name] = true
				opts.edgeAdded = true

			case change.ModifyEdge:
				opts.edgeFiles[c.Name] = true
				opts.edgeBaseFile = true

			case change.RemoveEdge:
				opts.deletedEdgeFiles[fmt.Sprintf("%v", c.ExtraInfo)] = true
				opts.edgeRemoved = true
				opts.edgeBaseFile = true
			}
		}
	}

	if err := s.accumulateConsts(nodeData); err != nil {
		serr.Append(err)
		return ret, opts
	}

	if !info.ShouldCodegen {
		return ret, opts
	}

	if nodeData.PackageName == "" {
		serr.Append(fmt.Errorf("invalid node with no package"))
		return ret, opts
	}

	if opts.writeBase {
		ret = append(ret, func() error {
			return writeBaseModelFile(nodeData, processor)
		})
	}

	if opts.writeEnt {
		ret = append(ret, func() error {
			return writeEntFile(nodeData, processor)
		})
	}

	ret = append(ret, s.processActions(processor, nodeData, opts)...)
	ret = append(ret, s.processEdges(processor, nodeData, opts)...)

	return ret, opts
}

func (s *Step) processPattern(processor *codegen.Processor, pattern *schema.PatternInfo, serr *syncerr.Error) (fns.FunctionList, *writeOptions) {
	var ret fns.FunctionList

	opts := &writeOptions{
		actionBaseFiles: map[string]bool{},
		actionFiles:     map[string]bool{},
		edgeFiles:       map[string]bool{},
	}

	if err := s.accumulateConsts(pattern); err != nil {
		serr.Append(err)
		return ret, opts
	}

	if processor.Config.WriteAllFiles() {
		opts.writeAllEdges = true
		opts.edgeBaseFile = true
		if pattern.HasMixin() {
			opts.writeMixin = true
		}
		if pattern.HasBuilder() {
			opts.writeBuilder = true
		}
	}
	if processor.Config.UseChanges() {
		changes := processor.ChangeMap
		nodeChanges := changes[pattern.Name]

		for _, c := range nodeChanges {
			if c.GraphQLOnly {
				continue
			}
			switch c.Change {
			case change.AddPattern, change.ModifyPattern:
				if pattern.HasMixin() {
					opts.writeMixin = true
				}
				if pattern.HasBuilder() {
					opts.writeBuilder = true
				}

			case change.AddEdge:
				opts.edgeBaseFile = true
				opts.edgeFiles[c.Name] = true
				opts.edgeAdded = true

			case change.ModifyEdge:
				opts.edgeFiles[c.Name] = true
				opts.edgeBaseFile = true

			case change.RemoveEdge:
				opts.edgeRemoved = true
			}
		}
	}

	if opts.writeMixin {
		ret = append(ret, func() error {
			return writeMixinFile(processor, pattern)
		})
	}

	if opts.writeBuilder {
		ret = append(ret, func() error {
			return writeMixinBuilderFile(processor, pattern)
		})
	}

	if len(pattern.AssocEdges) == 0 {
		return ret, opts
	}

	if opts.edgeBaseFile {
		ret = append(ret, func() error {
			return writeBasePatternQueryFile(processor, pattern)
		})
	}
	for idx := range pattern.AssocEdges {
		edge := pattern.AssocEdges[idx]
		name := edge.EdgeName
		if opts.writeAllEdges || opts.edgeFiles[name] {
			ret = append(ret, func() error {
				return writeAssocEdgeQueryFile(
					processor,
					edge,
					"Ent",
					getFilePathForPatternAssocEdgeQueryFile(processor.Config, pattern, edge.TsEdgeQueryName()),
				)
			})
		}
	}

	return ret, opts
}

func (s *Step) processDeletedPatterns(processor *codegen.Processor) fns.FunctionList {
	var ret fns.FunctionList

	// TODO not ideal we're doing it this way. we should process this once and flag deleted ish separately
	schema := processor.Schema
	for k := range processor.ChangeMap {
		if schema.NodeNameExists(k) || schema.Patterns[k] != nil {
			continue
		}

		if processor.ChangeMap.ChangesExist(k, change.RemovePattern) {
			ret = append(ret,
				file.GetDeleteFileFunction(processor.Config, getFilePathForMixin(processor.Config, k)),
			)
			ret = append(ret,
				file.GetDeleteFileFunction(processor.Config, getFilePathForMixinBuilderFile(processor.Config, k)),
			)
		}
	}

	return ret
}

func (s *Step) processActions(processor *codegen.Processor, nodeData *schema.NodeData, opts *writeOptions) fns.FunctionList {
	var ret fns.FunctionList

	for k := range opts.deletedActionFiles {
		ret = append(ret, file.GetDeleteFileFunction(processor.Config, getFilePathForActionBaseFile(processor.Config, nodeData, k)))
		ret = append(ret, file.GetDeleteFileFunction(processor.Config, getFilePathForActionFile(processor.Config, nodeData, k)))
	}

	if len(nodeData.ActionInfo.Actions) == 0 {
		return ret
	}

	if opts.writeBuilder {
		ret = append(ret, func() error {
			return writeBuilderFile(nodeData, processor)
		})
	}

	for idx := range nodeData.ActionInfo.Actions {
		action := nodeData.ActionInfo.Actions[idx]
		name := action.GetActionName()
		if opts.writeAllActions || opts.actionBaseFiles[name] {
			ret = append(ret, func() error {
				return writeBaseActionFile(nodeData, processor, action)
			})
		}
		if opts.writeAllActions || opts.actionFiles[name] {
			ret = append(ret, func() error {
				return writeActionFile(nodeData, processor, action)
			})
		}
	}

	return ret
}

func (s *Step) processEdges(processor *codegen.Processor, nodeData *schema.NodeData, opts *writeOptions) fns.FunctionList {
	var ret fns.FunctionList

	if nodeData.EdgeInfo.CreateEdgeBaseFile() && opts.edgeBaseFile {
		ret = append(ret, func() error {
			return writeBaseQueryFile(processor, nodeData)
		})
	}

	for idx := range nodeData.EdgeInfo.Associations {
		edge := nodeData.EdgeInfo.Associations[idx]
		name := edge.EdgeName
		if opts.writeAllEdges || opts.edgeFiles[name] {
			ret = append(ret, func() error {
				return writeAssocEdgeQueryFile(
					processor,
					edge,
					nodeData.Node,
					getFilePathForEdgeQueryFile(processor.Config, nodeData, edge.TsEdgeQueryName()),
				)
			})
		}
	}

	for k := range opts.deletedEdgeFiles {
		ret = append(ret,
			file.GetDeleteFileFunction(
				processor.Config,
				getFilePathForEdgeQueryFile(
					processor.Config,
					nodeData,
					k,
				),
			),
		)
	}

	// edges with IndexLoaderFactory
	edges := nodeData.EdgeInfo.GetEdgesForIndexLoader()
	for idx := range edges {
		edge := edges[idx]
		name := edge.GetEdgeName()
		if opts.writeAllEdges || opts.edgeFiles[name] {
			ret = append(ret, func() error {
				return writeCustomEdgeQueryFile(processor, nodeData, edge)
			})
		}
	}
	return ret
}

func (s *Step) processEnums(processor *codegen.Processor) fns.FunctionList {
	var ret fns.FunctionList

	writeAll := processor.Config.WriteAllFiles()

	for k := range processor.Schema.Enums {
		info := processor.Schema.Enums[k]
		if !info.OwnEnumFile() {
			continue
		}

		if writeAll ||
			processor.ChangeMap.ChangesExist(info.Enum.Name, change.AddEnum, change.ModifyEnum) {
			ret = append(ret, func() error {
				return writeEnumFile(info, processor)
			})
		}
	}

	// TODO this isn't ideal. we should process this once and flag deleted ish separately
	for k := range processor.ChangeMap {
		if processor.Schema.NodeNameExists(k) || processor.Schema.EnumNameExists(k) {
			continue
		}
		if processor.ChangeMap.ChangesExist(k, change.RemoveEnum) {
			filePath := getFilePathForEnumFile(processor.Config, k)
			ret = append(ret, file.GetDeleteFileFunction(processor.Config, filePath))
		}
	}
	return ret
}

func (s *Step) ProcessData(processor *codegen.Processor) error {
	fmt.Println("generating ent code...")
	var serr syncerr.Error

	var entAddedOrRemoved bool
	var edgeAddedOrRemoved bool
	var funcs fns.FunctionList
	for _, ci := range processor.Schema.CustomInterfaces {
		funcs = append(funcs, s.processCustomInterface(processor, ci, &serr)...)
	}

	for _, p := range processor.Schema.Patterns {
		fns, opts := s.processPattern(processor, p, &serr)
		funcs = append(funcs, fns...)
		if opts.edgeAdded || opts.edgeRemoved {
			edgeAddedOrRemoved = true
		}
	}
	funcs = append(funcs, s.processDeletedPatterns(processor)...)
	for _, info := range processor.Schema.Nodes {
		fns, opts := s.processNode(processor, info, &serr)
		funcs = append(funcs, fns...)
		if opts.entAdded || opts.entRemoved {
			entAddedOrRemoved = true
		}
		if opts.edgeAdded || opts.edgeRemoved {
			edgeAddedOrRemoved = true
		}
	}

	if err := s.accumulateConsts(processor.Schema.GetGlobalConsts()); err != nil {
		serr.Append(err)
	}

	for k := range processor.Schema.Enums {
		info := processor.Schema.Enums[k]
		if !info.OwnEnumFile() {
			continue
		}
	}

	writeAll := processor.Config.WriteAllFiles()
	changes := processor.ChangeMap
	updateBecauseChanges := writeAll || len(changes) > 0
	funcs = append(funcs, s.processEnums(processor)...)

	// sort data so that the enum is stable
	sort.Slice(s.nodeTypes, func(i, j int) bool {
		return s.nodeTypes[i].Name < s.nodeTypes[j].Name
	})
	sort.Slice(s.edgeTypes, func(i, j int) bool {
		return s.edgeTypes[i].Name < s.edgeTypes[j].Name
	})

	funcs = append(funcs,
		func() error {
			// ent or edge added or removed
			if writeAll || entAddedOrRemoved || edgeAddedOrRemoved {
				return writeConstFile(processor, s.nodeTypes, s.edgeTypes)
			}
			return nil
		},
		func() error {
			// if any changes, update this
			// eventually only wanna do this if add|remove something
			if updateBecauseChanges {
				return writeInternalEntFile(processor.Schema, processor)
			}
			return nil
		},
		func() error {
			// have writeOnce handle this.
			return writeEntIndexFile(processor)
		},
		func() error {
			if writeAll || entAddedOrRemoved {
				// if node added or removed
				return writeLoadAnyFile(s.nodeTypes, processor)
			}
			return nil
		},
		func() error {
			// if any changes, just do this.
			if updateBecauseChanges {
				return writeLoaderFile(processor)
			}
			return nil
		},
	)

	if err := serr.Err(); err != nil {
		return err
	}

	// build up all the funcs and parallelize as much as possible
	return fns.RunParallel(funcs)
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
	NodeData *schema.NodeData
	// TODO rename from CodePath to Config
	CodePath      *codegen.Config
	Package       *codegen.ImportPackage
	Imports       []*tsimport.ImportPath
	PrivacyConfig *codegen.PrivacyConfig
	Schema        *schema.Schema
}

func getFilePathForBaseModelFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s_base.ts", nodeData.PackageName))
}

func getFilePathForMixin(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/mixins/%s.ts", strcase.ToSnake(name)))
}

func getImportPathForMixin(pattern *schema.PatternInfo) string {
	return fmt.Sprintf("src/ent/generated/mixins/%s", strcase.ToSnake(pattern.Name))
}

func getFilePathForModelFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/%s.ts", nodeData.PackageName))
}

func getFilePathForEnumFile(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s.ts", strcase.ToSnake(name)))
}

// copied to input.go
// copied to type.go
func getFilePathForCustomInterfaceFile(cfg *codegen.Config, ci *customtype.CustomInterface) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s.ts", strcase.ToSnake(ci.TSType)))
}

func getImportPathForCustomInterfaceFile(ci *customtype.CustomInterface) string {
	return fmt.Sprintf("src/ent/generated/%s", strcase.ToSnake(ci.TSType))
}

func getFilePathForBaseQueryFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s_query_base.ts", nodeData.PackageName))
}

func getFilePathForEdgeQueryFile(cfg *codegen.Config, nodeData *schema.NodeData, edgeQueryName string) string {
	return path.Join(cfg.GetAbsPathToRoot(),
		fmt.Sprintf(
			"src/ent/%s/query/%s.ts",
			nodeData.PackageName,
			strcase.ToSnake(edgeQueryName),
		),
	)
}

func getFilePathForPatternBaseQueryFile(cfg *codegen.Config, pattern *schema.PatternInfo) string {
	// just so it doesn't conflict with nodes of same nams
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/patterns/%s_query_base.ts", strcase.ToSnake(pattern.Name)))
}

func getFilePathForPatternAssocEdgeQueryFile(cfg *codegen.Config, pattern *schema.PatternInfo, edgeQueryName string) string {
	return path.Join(cfg.GetAbsPathToRoot(),
		fmt.Sprintf(
			"src/ent/%s/query/%s.ts",
			// TODO there could be a conflict e.g. above...
			"patterns",
			strcase.ToSnake(edgeQueryName),
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

func getFilePathForLoaderFile(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/ent/generated/loaders.ts")
}

func getFilePathForLoadAnyFile(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/ent/generated/loadAny.ts")
}

// TODO
func getFilePathForBuilderFile(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s/actions/%s_builder.ts", nodeData.PackageName, nodeData.PackageName))
}

func getFilePathForMixinBuilderFile(cfg *codegen.Config, name string) string {
	name = strcase.ToSnake(name)
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/mixins/%s/actions/%s_builder.ts", name, name))
}

func getImportPathForBuilderFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/generated/%s/actions/%s_builder", nodeData.PackageName, nodeData.PackageName)
}

func getFilePathForActionBaseFile(cfg *codegen.Config, nodeData *schema.NodeData, actionName string) string {
	fileName := strcase.ToSnake(actionName)
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/ent/generated/%s/actions/%s_base.ts", nodeData.PackageName, fileName))
}

func getImportPathForActionBaseFile(nodeData *schema.NodeData, a action.Action) string {
	fileName := strcase.ToSnake(a.GetActionName())
	return fmt.Sprintf("src/ent/generated/%s/actions/%s_base", nodeData.PackageName, fileName)
}

func getFilePathForActionFile(cfg *codegen.Config, nodeData *schema.NodeData, actionName string) string {
	fileName := strcase.ToSnake(actionName)
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
			Schema:        processor.Schema,
		},
		AbsPathToTemplate:  util.GetAbsolutePath("base.tmpl"),
		TemplateName:       "base.tmpl",
		OtherTemplateFiles: []string{util.GetAbsolutePath("../schema/enum/enum.tmpl")},
		PathToFile:         filePath,
		TsImports:          imps,
		FuncMap:            getBaseFuncs(imps),
	})
}

type patternTemplateCodePath struct {
	Pattern *schema.PatternInfo
	Config  *codegen.Config
	Package *codegen.ImportPackage
	Imports []*tsimport.ImportPath
}

func writeMixinFile(processor *codegen.Processor, pattern *schema.PatternInfo) error {
	cfg := processor.Config
	filePath := getFilePathForMixin(cfg, pattern.Name)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: patternTemplateCodePath{
			Pattern: pattern,
			Config:  cfg,
			Package: cfg.GetImportPackage(),
		},
		AbsPathToTemplate:  util.GetAbsolutePath("mixin.tmpl"),
		TemplateName:       "mixin.tmpl",
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
	filePath := getFilePathForEnumFile(processor.Config, enumInfo.Enum.Name)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write(&file.TemplatedBasedFileWriter{
		// enum file can be rendered on its own so just render it
		Config:            processor.Config,
		Data:              enumInfo.Enum,
		AbsPathToTemplate: util.GetAbsolutePath("../schema/enum/enum.tmpl"),
		TemplateName:      "enum.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeCustomInterfaceFile(processor *codegen.Processor, ci *customtype.CustomInterface) error {
	// TODO we should store the file path here instead of this...
	filePath := getFilePathForCustomInterfaceFile(processor.Config, ci)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Interface *customtype.CustomInterface
			Package   *codegen.ImportPackage
			Config    *codegen.Config
		}{
			Interface: ci,
			Package:   processor.Config.GetImportPackage(),
			Config:    processor.Config,
		},
		AbsPathToTemplate: util.GetAbsolutePath("custom_interface.tmpl"),
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("../schema/enum/enum.tmpl"),
			util.GetAbsolutePath("interface.tmpl"),
		},
		TemplateName: "custom_interface.tmpl",
		PathToFile:   filePath,
		TsImports:    imps,
		FuncMap:      imps.FuncMap(),
		EditableCode: true,
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
			Config     *codegen.Config
		}{
			Edge:       e,
			Package:    cfg.GetImportPackage(),
			SourceNode: sourceNode,
			Config:     cfg,
		},
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
	filePath := getFilePathForEdgeQueryFile(cfg, nodeData, e.TsEdgeQueryName())
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
		AbsPathToTemplate: util.GetAbsolutePath("custom_ent_query.tmpl"),
		TemplateName:      "custom_ent_query.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
	}, file.WriteOnce())
}

type BaseQueryEdgeInfo struct {
	Imports      []*tsimport.ImportPath
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
			Config  *codegen.Config
		}{
			Schema:  s,
			Info:    info,
			Package: cfg.GetImportPackage(),
			Config:  cfg,
		},
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
		PathToFile: filePath,
		TsImports:  imps,
		FuncMap:    imps.FuncMap(),
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
		AbsPathToTemplate: util.GetAbsolutePath("loadAny.tmpl"),
		TemplateName:      "loadAny.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeLoaderFile(processor *codegen.Processor) error {
	cfg := processor.Config
	filePath := getFilePathForLoaderFile(cfg)
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Schema  *schema.Schema
			Package *codegen.ImportPackage
		}{
			processor.Schema,
			cfg.GetImportPackage(),
		},
		AbsPathToTemplate: util.GetAbsolutePath("loaders.tmpl"),
		TemplateName:      "loaders.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func getSortedInternalEntFileLines(s *schema.Schema) []string {
	lines := []string{
		"src/ent/generated/const",
		"src/ent/generated/loaders",
	}

	append2 := func(list *[]string, str string) {
		*list = append(*list, str)
	}

	var baseFiles []string
	for _, ci := range s.CustomInterfaces {
		append2(&baseFiles, getImportPathForCustomInterfaceFile(ci))
	}
	for _, info := range s.Nodes {
		append2(&baseFiles, getImportPathForBaseModelFile(info.NodeData.PackageName))
	}

	var entFiles []string
	for _, info := range s.Nodes {
		append2(&entFiles, getImportPathForModelFile(info.NodeData))
	}

	var enums []string
	for _, enum := range s.Enums {
		if enum.OwnEnumFile() {
			append2(&enums, getImportPathForEnumFile(enum))
		}
	}

	var baseQueryFiles []string
	var queryFiles []string
	var mixins []string
	// add patterns first  after const
	// this whole import stack getting sad
	for _, pattern := range s.Patterns {
		if pattern.HasMixin() {
			mixins = append(mixins, getImportPathForMixin(pattern))
		}
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
		enums,
		mixins,
		baseFiles,
		entFiles,
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
		Config: processor.Config,
		Data: struct {
			SortedLines []string
			Schema      *schema.Schema
			Config      *codegen.Config
			Package     *codegen.ImportPackage
		}{
			getSortedInternalEntFileLines(s),
			s,
			processor.Config,
			cfg.GetImportPackage(),
		},
		AbsPathToTemplate: util.GetAbsolutePath("internal.tmpl"),
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

	// written only once since it just exposes ./internal
	// hmm. writeOnce() removes the generated header...
	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		AbsPathToTemplate: util.GetAbsolutePath("index.tmpl"),
		TemplateName:      "index.tmpl",
		PathToFile:        path,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}, file.WriteOnce())
}

func writeBuilderFile(nodeData *schema.NodeData, processor *codegen.Processor) error {
	cfg := processor.Config
	filePath := getFilePathForBuilderFile(cfg, nodeData)
	imps := tsimport.NewImports(processor.Config, filePath)

	imports, err := nodeData.GetImportsForBaseFile(processor.Schema)
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
			Schema:   processor.Schema,
		},
		AbsPathToTemplate: util.GetAbsolutePath("builder.tmpl"),
		TemplateName:      "builder.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("edge_builder.tmpl"),
		},
		PathToFile: filePath,
		TsImports:  imps,
		FuncMap:    getBuilderFuncs(imps),
	})
}

func writeMixinBuilderFile(processor *codegen.Processor, pattern *schema.PatternInfo) error {
	cfg := processor.Config
	filePath := getFilePathForMixinBuilderFile(cfg, pattern.Name)
	imps := tsimport.NewImports(processor.Config, filePath)

	imports, err := pattern.GetImportsForQueryBaseFile(processor.Schema)
	if err != nil {
		return err
	}
	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: patternTemplateCodePath{
			Pattern: pattern,
			Config:  cfg,
			Package: cfg.GetImportPackage(),
			Imports: imports,
		},
		AbsPathToTemplate: util.GetAbsolutePath("mixin_builder.tmpl"),
		TemplateName:      "mixin_builder.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("edge_builder.tmpl"),
		},
		PathToFile: filePath,
		TsImports:  imps,
		FuncMap:    getBuilderFuncs(imps),
	})
}

func getBuilderFuncs(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["edgeInfos"] = action.GetEdgesFromEdges

	return m
}

func getBaseFuncs(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["callAndConvertFunc"] = func(f *field.Field, cfg codegenapi.Config, val string) (string, error) {
		// only user convert showing here...
		convs := enttype.ConvertFuncs(f.GetTSFieldType(cfg))
		userConv := f.GetUserConvert()
		if userConv != nil {
			convs = append(convs, userConv.Function)
		}

		if len(convs) == 0 {
			return val, nil
		}

		ret := val

		spew.Dump(convs)
		for _, conv := range convs {
			if conv == "" {
				continue
			}

			// could be BigInt which isn't reserved
			_, err := imps.UseMaybe(conv)
			if err != nil {
				return "", err
			}

			ret = fmt.Sprintf("%s(%s)", conv, ret)
		}

		return ret, nil
	}

	m["fieldLoadedInBaseClass"] = func(s *schema.Schema, f *field.Field) bool {
		return !s.PatternFieldWithMixin(f) && f.FetchOnLoad()
	}

	return m
}
