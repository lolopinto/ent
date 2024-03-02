package graphql

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/fns"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

type TSStep struct {
	s *gqlSchema
}

func (p *TSStep) Name() string {
	return "graphql"
}

// note Date here is intentionally commented out
// adding it to knownTypes kills the scalar Time and changes all
// GraphQL Time to Date
// TODO figure out exactly what's happening here...
var knownTypes = map[string]*tsimport.ImportPath{
	"String": tsimport.NewGQLImportPath("GraphQLString"),
	// "Date":       tsimport.NewEntGraphQLImportPath("GraphQLTime"),
	"Int":        tsimport.NewGQLImportPath("GraphQLInt"),
	"Float":      tsimport.NewGQLImportPath("GraphQLFloat"),
	"Boolean":    tsimport.NewGQLImportPath("GraphQLBoolean"),
	"ID":         tsimport.NewGQLImportPath("GraphQLID"),
	"Node":       tsimport.NewEntGraphQLImportPath("GraphQLNodeInterface"),
	"Edge":       tsimport.NewEntGraphQLImportPath("GraphQLEdgeInterface"),
	"Connection": tsimport.NewEntGraphQLImportPath("GraphQLConnectionInterface"),
}

// this should be somewhat kept in touch with knownAllowedNams in src/graphql/graphql.ts
var knownTsTypes = map[string]string{
	"String":  "string",
	"Date":    "Date",
	"Int":     "number",
	"Float":   "float",
	"Boolean": "boolean",
	// "ID":         "ID",
	"BigInt": "bigint",
}

var knownCustomTypes = map[string]string{
	"Date": "GraphQLTime",
	"JSON": "GraphQLJSON",
	"Byte": "GraphQLByte",
}

type NullableItem string

const NullableContents NullableItem = "contents"
const NullableContentsAndList NullableItem = "contentsAndList"
const NullableTrue NullableItem = "true"

func buildSchema(processor *codegen.Processor, fromTest bool) (*gqlSchema, error) {
	cd, schemaResult := <-parseCustomData(processor, fromTest), <-buildGQLSchema(processor)
	if cd.Error != nil {
		return nil, cd.Error
	}
	if schemaResult.error != nil {
		return nil, schemaResult.error
	}
	s := schemaResult.schema
	// put this here after the fact
	s.customData = cd

	if err := processCustomData(processor, s); err != nil {
		return nil, err
	}

	// rootDatas
	s.rootDatas = []*gqlRootData{
		getQueryData(processor, s),
	}
	if s.hasMutations {
		s.rootDatas = append(s.rootDatas, getMutationData(processor, s))
	}

	s.allTypes = getAllTypes(s, processor.Config)

	return s, nil
}

func (p *TSStep) PreProcessData(processor *codegen.Processor) error {
	s, err := buildSchema(processor, processor.FromTest())
	if err != nil {
		return err
	}

	p.s = s
	return nil
}

func (p *TSStep) ProcessData(processor *codegen.Processor) error {
	if p.s == nil {
		return errors.New("weirdness. graphqlSchema is nil when it shouldn't be")
	}

	fmt.Println("generating graphql code...")

	if err := p.writeBaseFiles(processor, p.s); err != nil {
		return err
	}

	if processor.DisableSchemaGQL() {
		return nil
	}
	// generate schema.gql
	return generateAlternateSchemaFile(processor, p.s)
	//return generateSchemaFile(processor, p.s.hasMutations)
}

func (p *TSStep) PostProcessData(processor *codegen.Processor) error {
	if p.s.customData == nil {
		return nil
	}
	return file.Write(&file.JSONFileWriter{
		Config:     processor.Config,
		Data:       p.s.customData,
		PathToFile: processor.Config.GetPathToCustomSchemaFile(),
	})
}

func (p *TSStep) processEnums(processor *codegen.Processor, s *gqlSchema) fns.FunctionList {
	var ret fns.FunctionList

	// TODO we should remove this eventually...
	for _, enum := range s.enums {
		ret = append(ret, file.GetDeleteFileFunction(processor.Config, getFilePathForOldEnum(processor.Config, enum.Enum.Name)))
	}
	return ret
}

type writeOptions struct {
	// anytime any boolean is added here, need to update the
	// else case in processNode
	writeNode              bool
	writeAllMutations      bool
	writeAllConnections    bool
	mutationFiles          map[string]bool
	connectionFiles        map[string]bool
	deletedConnectionFiles map[string]bool
	deletedMutationFiles   map[string]bool

	// nodeAdded, nodeRemoved, connectionAdded, rootQuery etc...
}

func (p *TSStep) processNode(processor *codegen.Processor, s *gqlSchema, node *gqlNode) fns.FunctionList {
	opts := &writeOptions{
		mutationFiles:          map[string]bool{},
		connectionFiles:        map[string]bool{},
		deletedConnectionFiles: map[string]bool{},
		deletedMutationFiles:   map[string]bool{},
	}
	if processor.Config.WriteAllFiles() {
		opts.writeAllConnections = true
		opts.writeAllMutations = true
		opts.writeNode = true
	}
	if processor.Config.UseChanges() {
		changeMap := processor.ChangeMap
		changes := changeMap[node.ObjData.Node]
		for _, c := range changes {
			if c.TSOnly {
				continue
			}
			switch c.Change {
			case change.AddNode, change.RemoveNode, change.ModifyNode:
				if c.WriteAllForNode {
					opts.writeAllConnections = true
					opts.writeAllMutations = true
				}
				if c.Change != change.RemoveNode {
					opts.writeNode = true
				}

			case change.AddEdge, change.ModifyEdge:
				opts.connectionFiles[c.GraphQLName] = true

			case change.RemoveEdge:
				opts.deletedConnectionFiles[c.GraphQLName] = true

			case change.AddAction, change.ModifyAction:
				opts.mutationFiles[c.GraphQLName] = true

			case change.RemoveAction:
				opts.deletedMutationFiles[c.GraphQLName] = true
			}
		}
	}

	// get custom files...
	cmp := s.customData.compareResult
	if cmp != nil {
		for k, v := range cmp.customConnectionsChanged {
			opts.connectionFiles[k] = v
		}
	} else {
		// if cmp is nil for some reason, flag custom connection edges
		for _, c := range node.connections {
			ce, ok := c.Edge.(customGraphQLEdge)
			if ok && ce.isCustomEdge() {
				opts.connectionFiles[c.Connection] = true
			}
		}
	}

	return p.buildNodeWithOpts(processor, s, node, opts)
}

func (p *TSStep) processDeletedNode(processor *codegen.Processor, s *gqlSchema, nodeData *schema.NodeData) fns.FunctionList {
	var ret fns.FunctionList

	packageName := nodeData.PackageName

	ret = append(ret,
		file.GetDeleteFileFunction(processor.Config, getFilePathForNodefromPackageName(processor.Config, packageName)))

	ret = append(ret,
		file.GetDeleteFileFunction(processor.Config, getDirectoryPathForActions(processor.Config, packageName)))

	if nodeData.EdgeInfo != nil {
		for _, edge := range nodeData.EdgeInfo.GetConnectionEdges() {
			ret = append(ret,
				file.GetDeleteFileFunction(
					processor.Config,
					getFilePathForConnection(
						processor.Config,
						packageName,
						edge.GetGraphQLConnectionType()),
				),
			)
		}
	}

	return ret
}

// TODO all of this logic should be rewritten so that the logic for the object and files rendered are tied together so that it's
// all tied together instead of scattered all over the place
// will eliminate this class of bugs
func (p *TSStep) buildNodeWithOpts(processor *codegen.Processor, s *gqlSchema, node *gqlNode, opts *writeOptions) fns.FunctionList {
	var ret fns.FunctionList
	if opts.writeNode {
		ret = append(ret, func() error {
			return writeFile(processor, node)
		})
	}

	cmp := s.customData.compareResult

	for idx := range node.connections {
		conn := node.connections[idx]
		if opts.writeAllConnections ||
			opts.connectionFiles[conn.Connection] || (cmp != nil && cmp.customQueriesChanged[conn.Edge.GraphQLEdgeName()]) {
			ret = append(ret, func() error {
				return writeConnectionFile(processor, s, conn)
			})
		}
	}

	for idx := range node.ActionDependents {
		dependentNode := node.ActionDependents[idx]
		action := dependentNode.Data.(action.Action)
		if opts.writeAllMutations || opts.mutationFiles[action.GetGraphQLName()] {
			ret = append(ret, func() error {
				return writeFile(processor, dependentNode)
			})
		}
	}

	// root queries it's "root"
	for k := range opts.deletedConnectionFiles {
		packageName := "root"
		// for top level connections
		if node.ObjData.NodeData != nil {
			packageName = node.ObjData.NodeData.PackageName
		}
		ret = append(
			ret,
			file.GetDeleteFileFunction(
				processor.Config,
				getFilePathForConnection(
					processor.Config,
					packageName,
					k+"Type"),
			),
		)
	}

	for k := range opts.deletedMutationFiles {
		ret = append(ret, file.GetDeleteFileFunction(processor.Config, getFilePathForAction(processor.Config, node.ObjData.NodeData, k)))
	}
	return ret
}

func (p *TSStep) processCustomNode(processor *codegen.Processor, s *gqlSchema, node *gqlNode, mutation bool) fns.FunctionList {
	cmp := s.customData.compareResult
	all := processor.Config.WriteAllFiles() || cmp == nil
	opts := &writeOptions{
		mutationFiles:          map[string]bool{},
		connectionFiles:        map[string]bool{},
		deletedConnectionFiles: map[string]bool{},
		deletedMutationFiles:   map[string]bool{},
	}

	if all {
		opts.writeAllConnections = true
		opts.writeNode = true
	}
	if cmp != nil {
		gqlName := node.Field.GraphQLName

		if (mutation && cmp.customMutationsChanged[gqlName]) ||
			(!mutation && cmp.customQueriesChanged[gqlName]) {
			opts.writeNode = true
		}

		for idx := range node.connections {
			conn := node.connections[idx]
			if cmp.customConnectionsChanged[conn.Connection] {
				opts.connectionFiles[conn.Connection] = true
			}
		}
	}
	return p.buildNodeWithOpts(processor, s, node, opts)
}

func (p *TSStep) writeBaseFiles(processor *codegen.Processor, s *gqlSchema) error {
	var funcs fns.FunctionList

	writeAll := processor.Config.WriteAllFiles()
	changes := processor.ChangeMap
	updateBecauseChanges := writeAll || len(changes) > 0
	customChanges := s.customData.compareResult
	hasCustomChanges := (customChanges != nil && customChanges.hasAnyChanges())

	if len(s.enums) > 0 {
		// TODO eventually stop deleting this
		funcs = append(funcs, p.processEnums(processor, s)...)

		funcs = append(funcs, func() error {
			return writeEnumsFile(processor, s.enums, getFilePathForEnums(processor.Config))
		})
	}

	if len(s.actionEnums) > 0 {
		funcs = append(funcs, func() error {
			return writeEnumsFile(processor, s.actionEnums, getFilePathForEnumInput(processor.Config))
		})
	}

	for idx := range s.nodes {
		node := s.nodes[idx]
		funcs = append(funcs, p.processNode(processor, s, node)...)
	}

	for k := range processor.ChangeMap {
		nodeInfo := processor.Schema.Nodes[k]
		if s.nodes[k] == nil && nodeInfo != nil {
			funcs = append(funcs, p.processDeletedNode(processor, s, nodeInfo.NodeData)...)
		}
	}

	for idx := range s.customMutations {
		node := s.customMutations[idx]
		funcs = append(funcs, p.processCustomNode(processor, s, node, true)...)
	}

	for idx := range s.customQueries {
		node := s.customQueries[idx]
		funcs = append(funcs, p.processCustomNode(processor, s, node, false)...)
	}

	for idx := range s.otherObjects {
		// TODO need to make this smarter and not always write files
		// except when something changes
		opts := &writeOptions{
			writeNode: true,
		}
		funcs = append(funcs, p.buildNodeWithOpts(processor, s, s.otherObjects[idx], opts)...)
	}

	cmp := s.customData.compareResult

	for idx := range s.unions {
		opts := &writeOptions{}
		if writeAll || cmp == nil || cmp.customUnionsChanged[s.unions[idx].ObjData.Node] {
			opts.writeNode = true
		}
		funcs = append(funcs, p.buildNodeWithOpts(processor, s, s.unions[idx], opts)...)
	}

	for idx := range s.interfaces {
		opts := &writeOptions{}
		if writeAll || cmp == nil || cmp.customInterfacesChanged[s.interfaces[idx].ObjData.Node] {
			opts.writeNode = true
		}
		funcs = append(funcs, p.buildNodeWithOpts(processor, s, s.interfaces[idx], opts)...)
	}

	// delete custom queries|mutations|unions|interfaces
	if cmp != nil {
		for k := range cmp.customQueriesRemoved {
			funcs = append(
				funcs,
				file.GetDeleteFileFunction(
					processor.Config,
					getFilePathForCustomQuery(
						processor.Config,
						k,
					),
				),
			)
		}

		for k := range cmp.customMutationsRemoved {
			funcs = append(
				funcs,
				file.GetDeleteFileFunction(
					processor.Config,
					getFilePathForCustomMutation(
						processor.Config,
						k,
					),
				),
			)
		}

		for k := range cmp.customConnectionsRemoved {
			funcs = append(funcs,
				file.GetDeleteFileFunction(
					processor.Config,
					getFilePathForConnection(
						processor.Config,
						"root",
						names.ToClassType("RootTo", k, "Type"),
					),
				),
			)
		}

		for k := range cmp.customInterfacesRemoved {
			funcs = append(funcs, file.GetDeleteFileFunction(processor.Config, getFilePathForUnionInterfaceFile(processor.Config, k)))
		}

		for k := range cmp.customUnionsRemoved {
			funcs = append(funcs, file.GetDeleteFileFunction(processor.Config, getFilePathForUnionInterfaceFile(processor.Config, k)))
		}
	}

	if updateBecauseChanges {
		// node(), account(), etc
		// TODO this mostly doesn't change so ideally we'd want this to be done
		// only when node is being added or when config is changing
		for idx := range s.rootQueries {
			rootQuery := s.rootQueries[idx]
			funcs = append(funcs, func() error {
				return writeRootQueryFile(processor, rootQuery)
			})
		}
	}

	// simplify and only do this if there's changes, we can be smarter about this over time
	if updateBecauseChanges || hasCustomChanges {
		// Query|Mutation|Subscription
		for idx := range s.rootDatas {
			rootData := s.rootDatas[idx]
			funcs = append(funcs, func() error {
				return writeRootDataFile(processor, rootData)
			})
		}
	}

	// other files
	funcs = append(
		funcs,
		func() error {
			// graphql/resolvers/internal
			// if any changes, update this
			// eventually only wanna do this if add|remove something
			if updateBecauseChanges || hasCustomChanges {
				return writeInternalGQLResolversFile(s, processor)
			}
			return nil
		},
		// graphql/resolvers/index
		func() error {
			// have writeOnce handle this
			return writeGQLResolversIndexFile(processor)
		},
		func() error {
			// graphql/schema.ts
			// if any changes, just do this
			if updateBecauseChanges || hasCustomChanges {
				return writeTSSchemaFile(processor, s)
			}
			return nil
		},
		func() error {
			// graphql/index.ts
			// writeOnce handles this
			return writeTSIndexFile(processor, s)
		},
	)

	return fns.RunParallel(funcs)
}

var _ codegen.Step = &TSStep{}

// TODO
func getFilePathForNode(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", nodeData.PackageName))
}

func getFilePathForNodefromPackageName(cfg *codegen.Config, packageName string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", packageName))
}

func getFilePathForCustomInterfaceFile(cfg *codegen.Config, gqlType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", names.ToFilePathName(gqlType)))
}

func getFilePathForUnionInterfaceFile(cfg *codegen.Config, gqlType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", names.ToFilePathName(gqlType)))
}

func getFilePathForCustomInterfaceInputFile(cfg *codegen.Config, gqlType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/input/%s_type.ts", names.ToFilePathName(gqlType)))
}

func getFilePathForCustomArg(cfg *codegen.Config, gqlType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/arg/%s_type.ts", names.ToFilePathName(gqlType)))
}

func getFilePathForEnums(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/resolvers/enums_type.ts")
}

func getFilePathForOldEnum(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", names.ToFilePathName(name)))
}

func getFilePathForEnumInput(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/mutations/input_enums_type.ts")
}

func getFilePathForConnection(cfg *codegen.Config, packageName string, connectionType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s/%s.ts", packageName, names.ToFilePathName(connectionType)))
}

func getQueryFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/resolvers/query_type.ts")
}

func getNodeQueryTypeFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/resolvers/node_query_type.ts")
}

func getCanViewerDoQueryTypeFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/resolvers/can_viewer_do_query_type.ts")
}

func getRootQueryFilePath(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_query_type.ts", nodeData.PackageName))
}

func getMutationFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/mutations/mutation_type.ts")
}

func getQueryImportPath() string {
	return "src/graphql/generated/resolvers/query_type"
}

func getMutationImportPath() string {
	return "src/graphql/generated/mutations/mutation_type"
}

func getTSSchemaFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/schema.ts")
}

func getTSIndexFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/index.ts")
}

func getTempSchemaFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/gen_schema.ts")
}

func getSchemaFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/schema.gql")
}

func getFilePathForAction(cfg *codegen.Config, nodeData *schema.NodeData, actionName string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/%s/%s_type.ts", nodeData.PackageName, names.ToFilePathName(actionName)))
}

func getDirectoryPathForActions(cfg *codegen.Config, packageName string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/%s/", packageName))
}

func getImportPathForActionFromPackage(packageName string, action action.Action) string {
	return fmt.Sprintf("src/graphql/generated/mutations/%s/%s_type", packageName, names.ToFilePathName(action.GetGraphQLName()))
}

func getFilePathForCustomMutation(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/%s_type.ts", names.ToFilePathName(name)))
}

func getImportPathForCustomMutation(name string) string {
	return fmt.Sprintf("src/graphql/generated/mutations/%s_type", names.ToFilePathName(name))
}

func getFilePathForCustomQuery(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_query_type.ts", names.ToFilePathName(name)))
}

var searchFor = []string{
	"@gqlField",
	"@gqlArgType",
	"@gqlInputObjectType",
	"@gqlObjectType",
	"@gqlQuery",
	"@gqlMutation",
	// gqlContextType intentionally skipped
	"@gqlConnection",
	"@qlFileUpload",
}

func getImportPathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/ent/%s.ts", nodeData.PackageName)
}

func searchForFiles(processor *codegen.Processor) []string {
	rootPath := processor.Config.GetAbsPathToRoot()

	cmd := exec.Command("rg", "-tts", "-l", strings.Join(searchFor, "|"))

	// run in root dir
	cmd.Dir = rootPath
	b, err := cmd.CombinedOutput()
	if err != nil {
		exit, ok := err.(*exec.ExitError)
		// exit code 1 is expected when there's no results. nothing to do here
		if ok && exit.ExitCode() == 1 {
			if processor.Config.DebugMode() {
				fmt.Printf("no custom files found: %s\n", err.Error())
			}
			return nil
		}
		if strings.Contains(err.Error(), "executable file not found") {
			fmt.Printf("%s\n", util.WrapRed("rg executable not found so can't search for custom files. local development error?"))
			return nil
		}
		// this could be because no files exist at all e.g. when running codegen first time...
		if processor.Config.DebugMode() {
			fmt.Printf("error searching for custom files: %v, output: %s\n", err, string(b))
		}
		return nil
	}
	files := strings.Split(strings.TrimSpace(string(b)), "\n")

	result := []string{}

	// we want to load all of ent first to make sure that any requires we do resolve correctly
	// we don't need to load graphql by default since we use ent -> graphql objects
	// any custom objects that are referenced should be in the load path
	indexFile := path.Join(rootPath, "src/ent/index.ts")
	stat, _ := os.Stat(indexFile)
	allEnt := false
	if stat != nil {
		allEnt = true
		result = append(result, "src/ent/index.ts")
	}

	entPaths := make(map[string]bool)

	for _, info := range processor.Schema.Nodes {
		nodeData := info.NodeData
		entPath := getImportPathForModelFile(nodeData)
		entPaths[entPath] = true
	}

	for _, file := range files {
		// ignore entPaths since we're doing src/ent/index.ts to get all of ent
		if allEnt && entPaths[file] {
			continue
		}
		result = append(result, file)
	}

	return result
}

func ParseRawCustomData(processor *codegen.Processor, fromTest bool) ([]byte, error) {
	jsonPath := processor.Config.GetCustomGraphQLJSONPath()
	dynamicPath := processor.Config.GetDynamicScriptCustomGraphQLJSONPath()

	// TODO handle dynamic path but no json path...
	// TODO https://github.com/lolopinto/ent/pull/1338
	var customFiles []string
	if jsonPath == "" {
		customFiles = searchForFiles(processor)
		// no custom files, nothing to do here. we're done
		if len(customFiles) == 0 {
			if processor.Config.DebugMode() {
				fmt.Println("no custom graphql files")
			}
			return nil, nil
		}
	}

	fmt.Println("checking for custom graphql definitions...")

	var buf bytes.Buffer
	var out bytes.Buffer
	for key := range processor.Schema.Nodes {
		info := processor.Schema.Nodes[key]
		nodeData := info.NodeData

		buf.WriteString(nodeData.Node)
		buf.WriteString("\n")
	}

	// send custom enums too
	for _, info := range processor.Schema.Enums {

		if info.GQLEnum == nil {
			continue
		}
		buf.WriteString(info.GQLEnum.Name)
		buf.WriteString("\n")
	}

	// todo why isn't this in Enums??
	for _, info := range processor.Schema.GetGlobalEnums() {
		if info.GQLEnum == nil {
			continue
		}
		buf.WriteString(info.GQLEnum.Name)
		buf.WriteString("\n")
	}

	for _, ci := range processor.Schema.CustomInterfaces {
		buf.WriteString(ci.GQLName)
		buf.WriteString("\n")
	}

	scriptPath := util.GetPathToScript("scripts/custom_graphql.ts", fromTest)

	cmdInfo := cmd.GetCommandInfo(processor.Config.GetAbsPathToRoot(), fromTest)

	if cmdInfo.UseSwc {
		_, err := os.Stat(".swcrc")
		if err != nil && os.IsNotExist(err) {
			// temp .swcrc file to be used
			// probably need this for parse_ts too
			err = os.WriteFile(".swcrc", []byte(`{
		"$schema": "http://json.schemastore.org/swcrc",
    "jsc": {
        "parser": {
            "syntax": "typescript",
            "decorators": true
        },
        "target": "es2020",
        "keepClassNames":true,
        "transform": {
            "decoratorVersion": "2022-03"
        }
    },
		"module": {
			"type": "commonjs",
		}
}
				`), os.ModePerm)

			if err == nil {
				defer os.Remove(".swcrc")
			}
		}
	}

	if fromTest {
		cmdInfo.Env = append(cmdInfo.Env,
			fmt.Sprintf(
				"GRAPHQL_PATH=%s",
				filepath.Join(input.GetAbsoluteRootPathForTest(), "graphql"),
			),
		)
	}

	cmdArgs := append(cmdInfo.Args,
		scriptPath,
		"--path",
		// TODO this should be a configuration option to indicate where the code root is
		filepath.Join(processor.Config.GetAbsPathToRoot(), "src"),
		"--files",
		strings.Join(customFiles, ","),
	)
	if jsonPath != "" {
		cmdArgs = append(cmdArgs, "--json_path", jsonPath)
	}
	if dynamicPath != "" {
		cmdArgs = append(cmdArgs, "--dynamic_path", dynamicPath)
	}

	cmd := exec.Command(cmdInfo.Name, cmdArgs...)
	cmd.Dir = processor.Config.GetAbsPathToRoot()
	cmd.Stdin = &buf
	cmd.Stdout = &out
	cmd.Stderr = os.Stderr
	cmd.Env = cmdInfo.Env

	if err := cmd.Run(); err != nil {
		err = errors.Wrap(err, "error generating custom graphql")
		return nil, err
	}

	return out.Bytes(), nil
}

func parseCustomData(processor *codegen.Processor, fromTest bool) chan *CustomData {
	var res = make(chan *CustomData)
	go func() {
		var cd CustomData
		if processor.DisableCustomGraphQL() {
			res <- &cd
			return
		}

		b, err := ParseRawCustomData(processor, fromTest)
		if err != nil || b == nil {
			cd.Error = err
			res <- &cd
			return
		}

		if err := json.Unmarshal(b, &cd); err != nil {
			spew.Dump(b)
			err = errors.Wrap(err, "error unmarshalling custom processor")
			cd.Error = err
		}
		if cd.Error == nil {
			existing := loadOldCustomData(processor)
			if existing != nil {
				cd.compareResult = CompareCustomData(processor, existing, &cd, processor.ChangeMap)
			}
		}
		res <- &cd
	}()
	return res
}

func loadOldCustomData(processor *codegen.Processor) *CustomData {
	file := processor.Config.GetPathToCustomSchemaFile()
	fi, err := os.Stat(file)
	if fi == nil || os.IsNotExist(err) {
		return nil
	}
	b, err := os.ReadFile(file)
	if err != nil {
		return nil
	}
	var cd CustomData
	if err := json.Unmarshal(b, &cd); err != nil {
		return nil
	}
	return &cd
}

func processCustomData(processor *codegen.Processor, s *gqlSchema) error {
	cd := s.customData

	if err := processCustomArgs(processor, cd, s); err != nil {
		return err
	}

	if err := processCustomFields(processor, cd, s); err != nil {
		return err
	}

	if err := processCustomMutations(processor, cd, s); err != nil {
		return err
	}

	if err := processCustomQueries(processor, cd, s); err != nil {
		return err
	}

	if err := processCusomTypes(processor, cd, s); err != nil {
		return err
	}

	if err := processCustomUnions(processor, cd, s); err != nil {
		return err
	}

	if err := processCustomInterfaces(processor, cd, s); err != nil {
		return err
	}

	for k := range cd.Objects {
		if s.seenCustomObjects[k] {
			continue
		}
		obj := cd.Objects[k]
		if err := processDanglingCustomObject(processor, cd, s, obj); err != nil {
			return err
		}
	}

	return nil
}

type gqlobjectData struct {
	NodeData    *schema.NodeData
	interfaces  []*interfaceType
	Node        string
	GQLNodes    []*objectType
	Enums       []*gqlEnum
	FieldConfig *fieldConfig
	initMap     bool
	m           map[string]bool
	Package     *codegen.ImportPackage
	// hack because I'm lazy to add imports for custom dependencies here
	customDependencyImports []*tsimport.ImportPath
}

func (obj *gqlobjectData) DefaultImports() []*tsimport.ImportPath {
	var result []*tsimport.ImportPath
	for _, node := range obj.GQLNodes {
		result = append(result, node.DefaultImports...)
	}
	return result
}

func (obj *gqlobjectData) Imports() []*tsimport.ImportPath {
	var result []*tsimport.ImportPath
	for _, node := range obj.GQLNodes {
		result = append(result, node.Imports...)
		for _, field := range node.Fields {
			// append field imports to get non-graphql imports (and graphql but most already manually included)
			result = append(result, field.AllImports()...)
		}
	}
	if obj.FieldConfig != nil {
		result = append(result, obj.FieldConfig.ArgImports...)
		result = append(result, obj.FieldConfig.TypeImports...)
		for _, arg := range obj.FieldConfig.Args {
			result = append(result, arg.Imports...)
		}
	}
	result = append(result, obj.customDependencyImports...)
	return result
}

func (obj *gqlobjectData) UnconditionalImports() []*tsimport.ImportPath {
	var result []*tsimport.ImportPath
	for _, node := range obj.GQLNodes {
		for _, class := range node.Classes {
			result = append(result, class.UnconditionalImports...)
		}
	}
	return result
}

func (obj *gqlobjectData) TSInterfaces() []*interfaceType {
	result := obj.interfaces[:]
	for _, node := range obj.GQLNodes {
		result = append(result, node.TSInterfaces...)
	}
	return result
}

func (obj *gqlobjectData) ForeignImport(name string) bool {
	if !obj.initMap {
		obj.m = make(map[string]bool)

		// any node Type defined here is local
		for _, node := range obj.GQLNodes {
			obj.m[node.Type] = true

			// same for interfaces
			for _, in := range node.TSInterfaces {
				obj.m[in.Name] = true
			}

			for _, class := range node.Classes {
				obj.m[class.Name] = true
			}
		}
		for _, enum := range obj.Enums {
			obj.m[enum.Type] = true
		}
		// and field config
		if obj.FieldConfig != nil {
			fcfg := obj.FieldConfig
			obj.m[fcfg.Name] = true

			for _, imp := range fcfg.ArgImports {
				// local...
				if imp.ImportPath == "" {
					obj.m[imp.Import] = true
				}
			}

			for _, imp := range fcfg.TypeImports {
				// local...
				if imp.ImportPath == "" {
					obj.m[imp.Import] = true
				}
			}
		}
		obj.initMap = true
	}
	return !obj.m[name]
}

func (obj *gqlobjectData) Classes() []*classType {
	var result []*classType
	for _, node := range obj.GQLNodes {
		result = append(result, node.Classes...)
	}
	return result
}

type gqlSchema struct {
	hasConnections    bool
	hasMutations      bool
	nodes             map[string]*gqlNode
	enums             map[string]*gqlEnum
	actionEnums       map[string]*gqlEnum
	customQueries     []*gqlNode
	customMutations   []*gqlNode
	unions            map[string]*gqlNode
	interfaces        map[string]*gqlNode
	customData        *CustomData
	edgeNames         map[string]bool
	customEdges       map[string]*objectType
	rootQueries       []*rootQuery
	allTypes          []typeInfo
	otherObjects      map[string]*gqlNode
	seenCustomObjects map[string]bool
	// Query|Mutation|Subscription
	rootDatas []*gqlRootData
}

func (s *gqlSchema) getNodeNameFor(typ string) string {
	// this is to handle renames of custom input and object types
	obj := s.customData.Objects[typ]
	if obj != nil {
		return obj.NodeName
	}
	obj = s.customData.Inputs[typ]
	if obj != nil {
		return obj.NodeName
	}
	return typ
}

func (s *gqlSchema) getImportFor(processor *codegen.Processor, typ string, mutation bool) *tsimport.ImportPath {
	// handle Date super special
	typ2, ok := knownCustomTypes[typ]
	if ok {
		customTyp, ok := s.customData.CustomTypes[typ2]
		if ok {
			return customTyp.getGraphQLImportPath(processor.Config)
		}

	}
	// known type e.g. boolean, string, etc
	knownType, ok := knownTypes[typ]
	if ok {
		return knownType
	}

	// custom nodes in the schema.
	// e.g. User object, Event
	// custom enums, interfaces, unions
	_, ok = s.nodes[typ]
	_, ok2 := s.enums[typ]
	_, ok3 := s.interfaces[typ]
	_, ok4 := s.unions[typ]
	// custom objects or StructType
	_, ok5 := s.otherObjects[typ]
	if ok || ok2 || ok3 || ok4 || ok5 {
		if mutation {
			return &tsimport.ImportPath{
				Import: fmt.Sprintf("%sType", typ),
				// it's an existing node, make sure to reference it
				ImportPath: codepath.GetImportPathForExternalGQLFile(),
			}
		}
		return &tsimport.ImportPath{
			Import: fmt.Sprintf("%sType", typ),
			// it's an existing node, make sure to reference it
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
		}
	}

	// Custom type added
	customTyp, ok := s.customData.CustomTypes[typ]
	if ok {
		return customTyp.getGraphQLImportPath(processor.Config)
	}

	// don't know needs to be handled at each endpoint

	return nil
}

type rootQuery struct {
	Name         string
	FieldConfig  *fieldConfig
	FilePath     string
	Interfaces   []*interfaceType
	WriteOnce    bool
	EditableCode bool
	Imports      []*tsimport.ImportPath
	// custom code after interface before field_config
	CustomCode string
}

// everything is foreign here
func (n *rootQuery) ForeignImport(name string) bool {
	return true
}

type gqlNode struct {
	ObjData *gqlobjectData
	// TODO instead of converting back and forth by joining the path here and then doing the relative
	// path again in trimPath, we should have the relative path, pass the cfg to TemplateBasedFileWriter
	// and then use that when writing the file.
	FilePath         string
	ActionDependents []*gqlNode // actions are the dependents
	Field            *CustomField
	connections      []*gqlConnection
	Data             interface{}
}

func (g *gqlNode) getRenderer(s *gqlSchema) renderer {
	var ret listRenderer
	for _, node := range g.ObjData.GQLNodes {
		ret = append(ret, node.getRenderer(s))
	}
	return ret
}

type gqlEnum struct {
	Enum *enum.GQLEnum
	Type string // the generated Type
	// Enum Name is the graphql Name
	FilePath string
}

func (e *gqlEnum) getRenderer(s *gqlSchema) renderer {
	return &enumRenderer{
		enum:   e.Enum.Name,
		values: e.Enum.GetGraphQLNames(),
	}
}

type gqlConnection struct {
	Connection string
	ConnType   string
	FilePath   string
	Edge       edge.ConnectionEdge
	Imports    []*tsimport.ImportPath
	NodeType   string
	Package    *codegen.ImportPackage
}

func (c *gqlConnection) GraphQLNodeType() string {
	if c.NodeType == "EntType" {
		return "GraphQLNodeInterface"
	}
	return c.NodeType
}

func (c *gqlConnection) GraphQLNode() string {
	if c.NodeType == "EntType" {
		return "Node"
	}
	return c.NodeType
}

func (c *gqlConnection) getRenderer(s *gqlSchema) renderer {
	edgeName := c.Edge.GetGraphQLEdgePrefix() + "Edge"

	// ImportPath not needed here so ignored

	connFields := []*fieldType{
		{
			Name: "edges",
			FieldImports: []*tsimport.ImportPath{
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: "GraphQLList",
				},
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: c.Edge.GetGraphQLEdgePrefix() + "Edge",
				},
			},
		},
		{
			Name: "nodes",
			FieldImports: []*tsimport.ImportPath{
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: "GraphQLList",
				},
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: c.GraphQLNode(),
				},
			},
		},
		{
			Name: "pageInfo",
			FieldImports: []*tsimport.ImportPath{
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: "PageInfo",
				},
			},
		},
		{
			Name: "rawCount",
			FieldImports: []*tsimport.ImportPath{
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: "GraphQLInt",
				},
			},
		},
	}

	edgeFields := []*fieldType{
		{
			Name: "node",
			FieldImports: []*tsimport.ImportPath{
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: c.GraphQLNode(),
				},
			},
		},
		{
			Name: "cursor",
			FieldImports: []*tsimport.ImportPath{
				{
					Import: "GraphQLNonNull",
				},
				{
					Import: "GraphQLString",
				},
			},
		},
	}

	// add custom edge fields
	cedge, ok := s.customEdges[c.Edge.TsEdgeQueryEdgeName()]
	if ok {
		edgeFields = append(edgeFields, cedge.Fields...)
	}

	connRender := &elemRenderer{
		name:       c.Connection,
		interfaces: []string{"Connection"},
		fields:     connFields,
	}
	edgeRender := &elemRenderer{
		name:       edgeName,
		interfaces: []string{"Edge"},
		fields:     edgeFields,
	}

	return listRenderer{edgeRender, connRender}
}

func getGqlConnection(packageName string, edge edge.ConnectionEdge, processor *codegen.Processor) *gqlConnection {
	nodeType := fmt.Sprintf("%sType", edge.GetNodeInfo().Node)

	var edgeImpPath string
	if edge.TsEdgeQueryEdgeName() == "Data" {
		edgeImpPath = codepath.Package
	} else {
		edgeImpPath = codepath.GetExternalImportPath()
	}
	return &gqlConnection{
		Connection: edge.GetGraphQLConnectionName(),
		ConnType:   edge.GetGraphQLConnectionType(),
		Edge:       edge,
		FilePath:   getFilePathForConnection(processor.Config, packageName, edge.GetGraphQLConnectionType()),
		NodeType:   nodeType,
		Imports: []*tsimport.ImportPath{
			{
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
				Import:     nodeType,
			},
			{
				ImportPath: edgeImpPath,
				Import:     edge.TsEdgeQueryEdgeName(),
			},
		},
		Package: processor.Config.GetImportPackage(),
	}
}

type buildGQLSchemaResult struct {
	schema *gqlSchema
	error  error
}

func buildGQLSchema(processor *codegen.Processor) chan *buildGQLSchemaResult {
	var result = make(chan *buildGQLSchemaResult)
	go func() {
		var hasMutations bool
		var hasConnections bool
		nodes := make(map[string]*gqlNode)
		enums := make(map[string]*gqlEnum)
		actionEnums := make(map[string]*gqlEnum)
		var rootQueries []*rootQuery
		edgeNames := make(map[string]bool)
		var wg sync.WaitGroup
		var m sync.Mutex
		otherNodes := make(map[string]*gqlNode)
		var serr syncerr.Error
		wg.Add(len(processor.Schema.Nodes))
		wg.Add(len(processor.Schema.Enums))
		wg.Add(len(processor.Schema.CustomInterfaces))

		if processor.Config.GenerateNodeQuery() {
			rootQueries = []*rootQuery{
				buildNodeRootQuery(processor),
			}
		}

		for key := range processor.Schema.Enums {
			go func(key string) {
				defer wg.Done()

				enumType := processor.Schema.Enums[key].GQLEnum
				// hidden from graphql. nothing to do here
				if enumType == nil {
					return
				}

				m.Lock()
				defer m.Unlock()
				// needs a quoted name
				// Type has GQLType
				enums[enumType.Name] = &gqlEnum{
					Type:     enumType.GetGraphQLType(),
					Enum:     enumType,
					FilePath: getFilePathForEnums(processor.Config),
				}
			}(key)
		}
		nodeMap := processor.Schema.Nodes
		for key := range processor.Schema.Nodes {
			go func(key string) {
				defer wg.Done()

				info := processor.Schema.Nodes[key]
				nodeData := info.NodeData

				// nothing to do here
				if nodeData.HideFromGraphQL {
					return
				}

				objectTypes, err := buildNodeForObject(processor, nodeMap, nodeData)
				if err != nil {
					serr.Append(err)
				}
				obj := gqlNode{
					ObjData: &gqlobjectData{
						NodeData: nodeData,
						Node:     nodeData.Node,
						GQLNodes: objectTypes,
						Package:  processor.Config.GetImportPackage(),
					},
					FilePath: getFilePathForNode(processor.Config, nodeData),
				}

				actionInfo := nodeData.ActionInfo
				var localActionEnums []*gqlEnum
				if actionInfo != nil {
					for _, action := range actionInfo.Actions {
						if !action.ExposedToGraphQL() {
							continue
						}
						hasMutations = true

						fieldCfg, err := buildActionFieldConfig(processor, nodeData, action)
						if err != nil {
							serr.Append(err)
						}
						nodes, err := buildActionNodes(processor, nodeData, action)
						if err != nil {
							serr.Append(err)
						}
						actionObj := gqlNode{
							ObjData: &gqlobjectData{
								Node:     nodeData.Node,
								GQLNodes: nodes,
								// Enums:        buildActionEnums(nodeData, action),
								FieldConfig: fieldCfg,
								Package:     processor.Config.GetImportPackage(),
							},
							FilePath: getFilePathForAction(processor.Config, nodeData, action.GetGraphQLName()),
							Data:     action,
						}
						obj.ActionDependents = append(obj.ActionDependents, &actionObj)

						localActionEnums = append(localActionEnums, buildActionEnums(action)...)
					}
				}

				edgeInfo := nodeData.EdgeInfo
				if edgeInfo != nil {
					for _, edge := range edgeInfo.GetConnectionEdges() {
						if nodeMap.HideFromGraphQL(edge) {
							continue
						}
						hasConnections = true
						conn := getGqlConnection(nodeData.PackageName, edge, processor)
						obj.connections = append(obj.connections, conn)
					}
				}

				m.Lock()
				defer m.Unlock()
				nodes[nodeData.Node] = &obj
				for _, conn := range obj.connections {
					edgeNames[conn.Edge.TsEdgeQueryEdgeName()] = true
				}
				if processor.Config.GenerateRootResolvers() {
					rootQueries = append(rootQueries, buildRootQuery(processor, nodeData))
				}

				for _, enum := range localActionEnums {
					actionEnums[enum.Type] = enum
				}
			}(key)
		}

		for key := range processor.Schema.CustomInterfaces {
			go func(key string) {
				defer wg.Done()

				// need both input and non-input type...
				ci := processor.Schema.CustomInterfaces[key]

				var objs []*objectType
				var imports []string
				for _, typ := range ci.GetAllCustomTypes() {
					imports = append(imports, typ.GetTSType())

					if typ.IsCustomUnion() {
						cu := typ.(*customtype.CustomUnion)
						objs = append(objs, buildCustomUnionNode(processor, cu))
					} else {
						ci2 := typ.(*customtype.CustomInterface)
						obj, err := buildCustomInterfaceNode(processor, ci2, &customInterfaceInfo{
							// only export root object
							exported: typ == ci,
							name:     ci2.GQLName,
							imports:  imports,
						})
						if err != nil {
							serr.Append(err)
						} else {
							objs = append(objs, obj)
						}
					}
				}

				obj := &gqlNode{
					ObjData: &gqlobjectData{
						Node:     ci.GQLName,
						GQLNodes: objs,
						Package:  processor.Config.GetImportPackage(),
					},
					FilePath: getFilePathForCustomInterfaceFile(processor.Config, ci.GQLName),
				}

				// reset imports
				imports = []string{}

				inputType := ci.GQLName + "Input"
				var inputObjs []*objectType
				for _, typ := range ci.GetAllCustomTypes() {
					imports = append(imports, typ.GetTSType())

					if typ.IsCustomUnion() {
						cu := typ.(*customtype.CustomUnion)
						obj, err := buildCustomUnionInputNode(processor, cu)
						if err != nil {
							// TODO
							panic(err)
						}
						inputObjs = append(inputObjs, obj)
					} else {

						ci2 := typ.(*customtype.CustomInterface)

						obj, err := buildCustomInterfaceNode(processor, ci2, &customInterfaceInfo{
							exported: typ == ci,
							name:     ci2.GQLName + "Input",
							input:    true,
							imports:  imports,
						})
						if err != nil {
							serr.Append(err)
						} else {
							inputObjs = append(inputObjs, obj)
						}
					}
				}

				inputObj := &gqlNode{
					ObjData: &gqlobjectData{
						Node:     inputType,
						GQLNodes: inputObjs,
						Package:  processor.Config.GetImportPackage(),
					},
					FilePath: getFilePathForCustomInterfaceInputFile(processor.Config, inputType),
				}

				m.Lock()
				defer m.Unlock()
				otherNodes[obj.ObjData.Node] = obj
				otherNodes[inputObj.ObjData.Node] = inputObj

			}(key)
		}

		globalCanViewerDo := processor.Schema.GetGlobalCanViewerDo()
		if len(globalCanViewerDo) > 0 {
			wg.Add(1)

			go func() {
				defer wg.Done()
				obj, err := getGlobalCanViewerDoObject(processor, globalCanViewerDo)
				if err != nil {
					serr.Append(err)
					return
				}
				m.Lock()
				defer m.Unlock()

				fieldCfg := &fieldConfig{
					Exported: true,
					Name:     "CanViewerDoQueryType",
					Arg:      "{}",
					TypeImports: []*tsimport.ImportPath{
						{
							Import: "GlobalCanViewerDoType",
						},
					},
					FunctionContents: []string{
						"return new GlobalCanViewerDo(context);",
					},
				}
				gqlNode := &gqlNode{
					ObjData: &gqlobjectData{
						Node:        obj.Node,
						GQLNodes:    []*objectType{obj},
						FieldConfig: fieldCfg,
						Package:     processor.Config.GetImportPackage(),
					},
					FilePath: getCanViewerDoQueryTypeFilePath(processor.Config),
				}
				// put it in other nodes to render
				otherNodes[gqlNode.ObjData.Node] = gqlNode
			}()
		}

		wg.Wait()
		schema := &gqlSchema{
			nodes:             nodes,
			rootQueries:       rootQueries,
			enums:             enums,
			actionEnums:       actionEnums,
			edgeNames:         edgeNames,
			hasMutations:      hasMutations,
			hasConnections:    hasConnections,
			customEdges:       make(map[string]*objectType),
			otherObjects:      otherNodes,
			unions:            map[string]*gqlNode{},
			seenCustomObjects: map[string]bool{},
		}
		result <- &buildGQLSchemaResult{
			schema: schema,
			error:  serr.Err(),
		}
	}()
	return result
}

// write graphql file
func writeFile(processor *codegen.Processor, node *gqlNode) error {
	imps := tsimport.NewImports(processor.Config, node.FilePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Data   *gqlobjectData
			Config *codegen.Config
		}{
			node.ObjData,
			processor.Config,
		},
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/object.tmpl"),
		TemplateName:      "object.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("ts_templates/field_config.tmpl"),
			util.GetAbsolutePath("ts_templates/render_args.tmpl"),
			util.GetAbsolutePath("ts_templates/enum.tmpl"),
			util.GetAbsolutePath("ts_templates/field.tmpl"),
			util.GetAbsolutePath("ts_templates/interfaces.tmpl"),
		},
		PathToFile: node.FilePath,
		TsImports:  imps,
		FuncMap:    imps.FuncMap(),
	}))
}

func writeEnumFile(processor *codegen.Processor, enum *gqlEnum) error {
	imps := tsimport.NewImports(processor.Config, enum.FilePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		Data:              enum,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/enum.tmpl"),
		TemplateName:      "enum.tmpl",
		PathToFile:        enum.FilePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func writeEnumsFile(processor *codegen.Processor, enums map[string]*gqlEnum, path string) error {
	imps := tsimport.NewImports(processor.Config, path)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Enums map[string]*gqlEnum
		}{
			Enums: enums,
		},
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/enums.tmpl"),
		TemplateName:      "enums.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("ts_templates/enum.tmpl"),
		},
		PathToFile: path,
		TsImports:  imps,
		FuncMap:    imps.FuncMap(),
	}))
}

type typeInfo struct {
	Type       string
	Function   bool
	ImportPath string
	Path       string
	NodeType   string
	Obj        interface{}
	Exported   bool
}

const resolverPath = "src/graphql/resolvers"

// get all types to be passed to GraphQLschema
func getAllTypes(s *gqlSchema, cfg *codegen.Config) []typeInfo {
	var nodes []typeInfo
	var conns []typeInfo
	var actionTypes []typeInfo

	processNode := func(node *gqlNode, nodeType string) {
		for _, n := range node.ObjData.GQLNodes {
			nodes = append(nodes, typeInfo{
				Type:       n.Type,
				ImportPath: resolverPath,
				NodeType:   nodeType,
				Obj:        n,
				Exported:   n.Exported,
			})
		}
		for _, conn := range node.connections {
			conns = append(conns, typeInfo{
				Type:       conn.ConnType,
				ImportPath: resolverPath,
				Function:   true,
				NodeType:   "Connection",
				Obj:        conn,
				Exported:   true,
			})
		}

		// right now, only actions are dependents
		for _, dep := range node.ActionDependents {
			for _, depObj := range dep.ObjData.GQLNodes {
				actionTypes = append(actionTypes, typeInfo{
					Type:       depObj.Type,
					ImportPath: trimPath(cfg, dep.FilePath),
					NodeType:   "Mutation",
					Obj:        depObj,
					Exported:   depObj.Exported,
				})
			}
		}
	}
	for _, enum := range s.actionEnums {
		actionTypes = append(actionTypes, typeInfo{
			Type: enum.Type,
			// moved to top level input file
			ImportPath: trimPath(cfg, getFilePathForEnumInput(cfg)),
			NodeType:   "Enum",
			Obj:        enum,
			Exported:   true,
		})
	}

	for _, node := range s.nodes {
		processNode(node, "Node")
	}

	for _, node := range s.otherObjects {
		if otherObjectIsInput(node) {
			for _, obj := range node.ObjData.GQLNodes {
				actionTypes = append(actionTypes, typeInfo{
					Type:       obj.Type,
					ImportPath: trimPath(cfg, node.FilePath),
					NodeType:   "CustomInput",
					Obj:        obj,
					Exported:   obj.Exported,
				})
			}
		} else {
			processNode(node, "CustomObject")
		}
	}

	for _, node := range s.interfaces {
		processNode(node, "Interface")
	}

	for _, node := range s.unions {
		processNode(node, "Union")
	}

	var enums []typeInfo
	for _, enum := range s.enums {
		enums = append(enums, typeInfo{
			Type:       enum.Type,
			ImportPath: resolverPath,
			NodeType:   "Enum",
			Obj:        enum,
			Exported:   true,
		})
	}

	var customQueries []typeInfo
	for _, node := range s.customQueries {
		for _, n := range node.ObjData.GQLNodes {
			customQueries = append(customQueries, typeInfo{
				Type:       n.Type,
				ImportPath: resolverPath,
				NodeType:   "CustomQuery",
				Obj:        node,
				Exported:   true,
			})
		}

		for _, conn := range node.connections {
			conns = append(conns, typeInfo{
				Type:       conn.ConnType,
				ImportPath: resolverPath,
				Function:   true,
				NodeType:   "CustomConn",
				Obj:        conn,
				Exported:   true,
			})
		}
	}

	var customMutations []typeInfo
	for _, node := range s.customMutations {
		for _, n := range node.ObjData.GQLNodes {
			customMutations = append(customMutations, typeInfo{
				Type:       n.Type,
				ImportPath: trimPath(cfg, node.FilePath),
				NodeType:   "CustomMutation",
				Obj:        n,
				Exported:   true,
			})
		}
	}

	var lines []typeInfo
	// get the enums
	// get top level nodes e.g. User, Photo
	// get the connections
	// get the custom queries
	list := [][]typeInfo{
		enums,
		nodes,
		conns,
		customQueries,
		customMutations,
		// input, payload in Actions
		actionTypes,
	}
	for _, l := range list {
		sort.Slice(l, func(i, j int) bool {
			return l[i].Type < l[j].Type
		})
		lines = append(lines, l...)
	}
	return lines
}

func trimPath(cfg *codegen.Config, path string) string {
	rel, err := filepath.Rel(cfg.GetAbsPathToRoot(), path)
	if err != nil {
		panic((err))
	}
	return strings.TrimSuffix(rel, ".ts")
}

func otherObjectIsInput(node *gqlNode) bool {
	// not the best check in the world...
	// input file
	if len(node.ObjData.GQLNodes) < 1 {
		return false
	}
	obj := node.ObjData.GQLNodes[0]
	return obj.GQLType == "GraphQLInputObjectType" && !obj.ArgNotInput
}

func getSortedLines(s *gqlSchema, cfg *codegen.Config) []string {
	// this works based on what we're currently doing
	// if we eventually add other things here, may not work?

	var nodes []string
	var conns []string
	var otherObjs []string
	for _, node := range s.otherObjects {
		if otherObjectIsInput(node) {
			continue
		}
		otherObjs = append(otherObjs, trimPath(cfg, node.FilePath))
	}
	for _, node := range s.nodes {
		nodes = append(nodes, trimPath(cfg, node.FilePath))
		for _, conn := range node.connections {
			conns = append(conns, trimPath(cfg, conn.FilePath))
		}
	}
	for _, node := range s.unions {
		otherObjs = append(otherObjs, trimPath(cfg, node.FilePath))
	}
	for _, node := range s.interfaces {
		otherObjs = append(otherObjs, trimPath(cfg, node.FilePath))
	}
	var enums []string
	if len(s.enums) > 0 {
		// enums in one file
		enums = append(enums, trimPath(cfg, getFilePathForEnums(cfg)))
	}

	var customQueries []string
	for _, node := range s.customQueries {
		customQueries = append(customQueries, trimPath(cfg, node.FilePath))
		for _, conn := range node.connections {
			conns = append(conns, trimPath(cfg, conn.FilePath))
		}
	}

	rootQueryImports := []string{}
	for _, rootQuery := range s.rootQueries {
		rootQueryImports = append(rootQueryImports, trimPath(cfg, rootQuery.FilePath))
	}

	var lines []string
	// get the enums
	// get top level nodes e.g. User, Photo
	// get the connections
	// get the custom queries
	list := [][]string{
		enums,
		otherObjs,
		nodes,
		conns,
		customQueries,
		rootQueryImports,
	}
	for _, l := range list {
		sort.Strings(l)
		lines = append(lines, l...)
	}
	return lines
}

func writeInternalGQLResolversFile(s *gqlSchema, processor *codegen.Processor) error {
	filePath := filepath.Join(processor.Config.GetAbsPathToRoot(), codepath.GetFilePathForInternalGQLFile())
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		Data:              getSortedLines(s, processor.Config),
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/resolver_internal.tmpl"),
		TemplateName:      "resolver_internal.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
}

func writeGQLResolversIndexFile(processor *codegen.Processor) error {
	filePath := filepath.Join(processor.Config.GetAbsPathToRoot(), codepath.GetFilePathForExternalGQLFile())
	imps := tsimport.NewImports(processor.Config, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/resolver_index.tmpl"),
		TemplateName:      "resolver_index.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}, file.WriteOnce())
}

type connectionBaseObj struct{}

// everything is foreign here
func (n *connectionBaseObj) ForeignImport(name string) bool {
	return true
}

func writeConnectionFile(processor *codegen.Processor, s *gqlSchema, conn *gqlConnection) error {
	imps := tsimport.NewImports(processor.Config, conn.FilePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Connection   *gqlConnection
			CustomObject *objectType
			BaseObj      *connectionBaseObj
			Package      *codegen.ImportPackage
			Config       *codegen.Config
		}{
			conn,
			s.customEdges[conn.Edge.TsEdgeQueryEdgeName()],
			&connectionBaseObj{},
			processor.Config.GetImportPackage(),
			processor.Config,
		},
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/connection.tmpl"),
		TemplateName:      "connection.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("ts_templates/render_args.tmpl"),
			util.GetAbsolutePath("ts_templates/field.tmpl"),
		},
		PathToFile: conn.FilePath,
		TsImports:  imps,
		FuncMap:    imps.FuncMap(),
	}))
}

type fieldConfig struct {
	Exported         bool
	Name             string
	Arg              string
	Description      string
	ResolveMethodArg string
	TypeImports      []*tsimport.ImportPath
	//	ArgImports       []string // incase it's { [argName: string]: any }, we need to know difference
	ReserveAndUseImports []*tsimport.ImportPath
	ArgImports           []*tsimport.ImportPath
	Args                 []*fieldConfigArg
	FunctionContents     []string
	ReturnTypeHint       string
	connection           *gqlConnection
}

func (f fieldConfig) FieldType() string {
	return fieldTypeFromImports(f.TypeImports)
}

type fieldConfigArg struct {
	Name        string
	Description string
	Imports     []*tsimport.ImportPath
}

func (f *fieldConfigArg) render(s *gqlSchema) string {
	return fmt.Sprintf("%s: %s", f.Name, getTypeForImports(f.Imports, s))
}

func (f fieldConfigArg) FieldType() string {
	return fieldTypeFromImports(f.Imports)
}

func getGQLFileImports(imps []*tsimport.ImportPath, mutation bool) []*tsimport.ImportPath {
	if !mutation {
		return imps
	}
	ret := make([]*tsimport.ImportPath, len(imps))

	for idx, v := range imps {
		ret[idx] = v
		if !v.TransformedForGraphQLMutation {
			continue
		}
		ret[idx] = &tsimport.ImportPath{
			ImportPath:    codepath.GetImportPathForExternalGQLFile(),
			Import:        v.Import,
			DefaultImport: v.DefaultImport,
			Function:      v.Function,
		}
	}
	return ret
}

func buildNodeForObject(processor *codegen.Processor, nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) ([]*objectType, error) {
	result := newObjectType(&objectType{
		Type:     fmt.Sprintf("%sType", nodeData.Node),
		Node:     nodeData.Node,
		TSType:   nodeData.Node,
		GQLType:  "GraphQLObjectType",
		Exported: true,
		// import NodeInterface because ents are always Nodes
		Imports: []*tsimport.ImportPath{
			{
				ImportPath: codepath.GraphQLPackage,
				Import:     "GraphQLNodeInterface",
			},
			{
				ImportPath: codepath.GetExternalImportPath(),
				Import:     nodeData.Node,
			},
		},
		GQLInterfaces: []string{"GraphQLNodeInterface"},
		IsTypeOfMethod: []string{
			fmt.Sprintf("return obj instanceof %s", nodeData.Node),
		},
	})

	// add any custom interfaces
	for _, inter := range nodeData.CustomGraphQLInterfaces {
		result.GQLInterfaces = append(result.GQLInterfaces, inter+"Type")
		result.Imports = append(result.Imports, tsimport.NewLocalGraphQLEntImportPath(inter))
	}

	for _, node := range nodeData.GetUniqueNodes() {
		// no need to import yourself
		if node.Node == nodeData.Node {
			continue
		}
		result.Imports = append(result.Imports, &tsimport.ImportPath{
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
			Import:     fmt.Sprintf("%sType", node.Node),
		})
	}
	result.Imports = append(result.Imports, &tsimport.ImportPath{
		ImportPath: codepath.GetExternalImportPath(),
		Import:     nodeData.Node,
	})

	fieldInfo := nodeData.FieldInfo

	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		// if field was already hidden, don't create edge for it
		if !f.ExposeToGraphQL() {
			continue
		}

		// if node is hidden from graphql, don't create edge for it
		if edge.Polymorphic == nil &&
			nodeMap[edge.NodeInfo.Node].NodeData.HideFromGraphQL {
			continue
		}

		// TODO this shouldn't be here but be somewhere else...
		if f != nil {
			if err := fieldInfo.InvalidateFieldForGraphQL(f); err != nil {
				return nil, err
			}
		}
		if edge.IsList() {
			if err := addPluralEdge(edge, result); err != nil {
				return nil, err
			}
		} else {
			if err := addSingularEdge(edge, result); err != nil {
				return nil, err
			}
		}
	}

	for _, field := range fieldInfo.GraphQLFields() {
		gqlName := field.GetGraphQLName()
		asyncAccessor := field.HasAsyncAccessor(processor.Config)
		gqlField := &fieldType{
			Name:               gqlName,
			HasResolveFunction: asyncAccessor || gqlName != field.TSPublicAPIName(),
			FieldImports:       getGQLFileImports(field.GetTSGraphQLTypeForFieldImports(false), false),
			HasAsyncModifier:   asyncAccessor,
		}

		if processor.Config.Base64EncodeIDs() && field.IDType() {
			gqlField.ResolverMethod = "nodeIDEncoder"
		}

		if gqlField.HasResolveFunction {
			if asyncAccessor {
				gqlField.FunctionContents = []string{fmt.Sprintf("return obj.%s();", field.TSPublicAPIName())}
			} else {
				gqlField.FunctionContents = []string{fmt.Sprintf("return obj.%s;", field.TSPublicAPIName())}
			}
		}
		if err := result.addField(gqlField); err != nil {
			return nil, err
		}
	}

	for _, edge := range nodeData.EdgeInfo.GetSingularEdges() {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		if err := addSingularEdge(edge, result); err != nil {
			return nil, err
		}
	}

	for _, edge := range nodeData.EdgeInfo.GetConnectionEdges() {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		if err := addConnection(processor, nodeData, edge, result, nil, nil); err != nil {
			return nil, err
		}
	}

	for _, group := range nodeData.EdgeInfo.AssocGroups {
		method := group.GetStatusMethod()
		gqlName := group.GetGraphQLNameForStatusMethod(processor.Config)
		var imps []*tsimport.ImportPath
		if !group.IsNullable() {
			imps = append(imps, tsimport.NewGQLClassImportPath("GraphQLNonNull"))
		}
		imps = append(imps, tsimport.NewLocalGraphQLEntImportPath(group.ConstType))
		imps = getGQLFileImports(imps, false)

		if group.ViewerBased {
			hasResolve := method != gqlName
			var contents []string
			if hasResolve {
				contents = []string{
					fmt.Sprintf("return obj.%s();", method),
				}
			}

			if err := result.addField(&fieldType{
				Name:               gqlName,
				FieldImports:       imps,
				HasResolveFunction: hasResolve,
				HasAsyncModifier:   true,
				FunctionContents:   contents,
			}); err != nil {
				return nil, err
			}
		} else {
			if err := result.addField(&fieldType{
				Name:         gqlName,
				FieldImports: imps,
				ExtraImports: []*tsimport.ImportPath{
					tsimport.NewLocalEntImportPath(group.DestNodeInfo.Node),
				},
				Args: []*fieldConfigArg{
					{
						Name:    "id",
						Imports: []*tsimport.ImportPath{tsimport.NewGQLClassImportPath("GraphQLNonNull"), tsimport.NewGQLImportPath("GraphQLID")},
					},
				},
				HasAsyncModifier:   true,
				HasResolveFunction: true,
				FunctionContents: []string{
					fmt.Sprintf("const ent = await %s.loadX(context.getViewer(), args.id);", group.DestNodeInfo.Node),
					fmt.Sprintf("return obj.%s(ent);", method),
				},
			}); err != nil {
				return nil, err
			}
		}
	}
	ret := []*objectType{result}

	canSeeViewerInfo := nodeData.GetCanViewerSeeInfo()
	if canSeeViewerInfo != nil {
		canViewerSee, err := getCanViewerSeeInfoObject(processor, result, nodeData, canSeeViewerInfo, "canViewerSeeInfo")
		if err != nil {
			return nil, err
		}

		ret = append(ret, canViewerSee)
	}

	canViewerEditInfo := nodeData.GetCanViewerEditInfo()
	if canViewerEditInfo != nil {
		canViewerEdit, err := getCanViewerSeeInfoObject(processor, result, nodeData, canViewerEditInfo, "canViewerEditInfo")
		if err != nil {
			return nil, err
		}

		ret = append(ret, canViewerEdit)
	}

	if nodeData.HasCanViewerDo() {
		canViewerDoInfo := nodeData.GetCanViewerDoInfo()

		// not creating a thin layer in ent because of circular dependencies of calling actions from ent
		// so doing it all in graphql...
		canViewerDo, err := getCanViewerDoObject(processor, result, nodeData, canViewerDoInfo)
		if err != nil {
			return nil, err
		}
		ret = append(ret, canViewerDo)
	}

	return ret, nil
}

func getCanViewerSeeInfoObject(processor *codegen.Processor, result *objectType, nodeData *schema.NodeData, canSeeViewerInfo *schema.CanViewerSeeInfo, method string) (*objectType, error) {
	// add can viewer see|edit object
	canViewerSee := newObjectType(&objectType{
		Type:     fmt.Sprintf("%sType", canSeeViewerInfo.Name),
		GQLType:  "GraphQLObjectType",
		Node:     canSeeViewerInfo.Name,
		Exported: true,
		TSType:   canSeeViewerInfo.Name,
		Imports: []*tsimport.ImportPath{
			tsimport.NewLocalEntImportPath(canSeeViewerInfo.Name),
		},
	})
	for _, field := range canSeeViewerInfo.Fields {
		name := field.GetGraphQLName()
		if !field.ExposeToGraphQL() {
			if !field.ExposeFieldOrFieldEdgeToGraphQL() {
				continue
			}
			name, _ = base.TranslateIDSuffix(name)
		}
		gqlField := &fieldType{
			Name: name,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLBoolean"),
			},
			HasAsyncModifier:   true,
			HasResolveFunction: true,
			FunctionContents: []string{
				fmt.Sprintf("return obj.%s();", field.TSPublicAPIName()),
			},
		}
		if err := canViewerSee.addField(gqlField); err != nil {
			return nil, err
		}
	}

	// add field to node
	if err := result.addField(&fieldType{
		Name: names.ToGraphQLName(processor.Config, method),
		FieldImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewLocalGraphQLEntImportPath(canSeeViewerInfo.Name),
		},
		HasResolveFunction: true,
		FunctionContents: []string{
			fmt.Sprintf("return obj.%s();", method),
		},
	}); err != nil {
		return nil, err
	}
	return canViewerSee, nil
}

func addSingularEdge(edge edge.Edge, obj *objectType) error {
	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       getGQLFileImports(edge.GetTSGraphQLTypeImports(), false),
		FunctionContents:   []string{fmt.Sprintf("return obj.load%s();", edge.CamelCaseEdgeName())},
	}
	return obj.addField(gqlField)
}

func addPluralEdge(edge edge.Edge, obj *objectType) error {
	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       getGQLFileImports(edge.GetTSGraphQLTypeImports(), false),
		FunctionContents:   []string{fmt.Sprintf("return obj.load%s();", edge.CamelCaseEdgeName())},
	}
	return obj.addField(gqlField)
}

func addConnection(processor *codegen.Processor, nodeData *schema.NodeData, edge edge.ConnectionEdge, obj *objectType, customField *CustomField, s *gqlSchema) error {
	// import GraphQLEdgeConnection and EdgeQuery file
	extraImports := []*tsimport.ImportPath{
		{
			ImportPath: codepath.GraphQLPackage,
			Import:     "GraphQLEdgeConnection",
		},
	}

	var buildQuery string
	var args []CustomItem
	if customField == nil {
		// for custom fields, EntQuery is an implementation detail
		// and may or may not be exposed so we don't depend on it here
		extraImports = append(extraImports, &tsimport.ImportPath{
			ImportPath: codepath.GetExternalImportPath(),
			Import:     edge.TsEdgeQueryName(),
		})
		buildQuery = fmt.Sprintf("%s.query(v, obj)", edge.TsEdgeQueryName())
		args = getConnectionArgs()
	} else {
		args = customField.Args
		nonConnectionArgs := customField.getNonConnectionArgs()
		var params []string
		for _, arg := range nonConnectionArgs {
			params = append(params, fmt.Sprintf("args.%s", arg.Name))

		}
		buildQuery = fmt.Sprintf("%s.%s(%s)", "obj", customField.FunctionName, strings.Join(params, ", "))
	}

	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       getGQLFileImports(edge.GetTSGraphQLTypeImports(), false),
		ExtraImports:       extraImports,
		Args:               getFieldConfigArgsFrom(processor, args, s, false),
		// TODO typing for args later?
		FunctionContents: []string{
			fmt.Sprintf(
				"return new GraphQLEdgeConnection(obj.viewer, obj, (v, obj: %s) => %s, args);",
				nodeData.Node,
				buildQuery,
			),
		},
	}
	return obj.addField(gqlField)
}

func buildActionNodes(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) ([]*objectType, error) {
	var ret []*objectType
	for _, c := range a.GetCustomInterfaces() {
		_, ok := c.Action.(action.Action)
		if !ok {
			node, err := buildCustomInputNode(c)
			if err != nil {
				return nil, err
			}
			ret = append(ret, node)
		}
	}
	input, err := buildActionInputNode(processor, nodeData, a)
	if err != nil {
		return nil, err
	}

	payload, err := buildActionPayloadNode(processor, nodeData, a)
	if err != nil {
		return nil, err
	}

	ret = append(ret, input, payload)
	return ret, nil
}

func buildActionEnums(action action.Action) []*gqlEnum {
	var ret []*gqlEnum
	for _, enumType := range action.GetGQLEnums() {
		ret = append(ret, &gqlEnum{
			Type: fmt.Sprintf("%sType", enumType.Name),
			Enum: enumType,
		})
	}
	return ret
}

func buildCustomInputNode(c *customtype.CustomInterface) (*objectType, error) {
	result := newObjectType(&objectType{
		Type:     c.GQLName,
		Node:     c.GQLName,
		TSType:   c.GQLName,
		GQLType:  "GraphQLInputObjectType",
		Exported: true,
	})

	for _, f := range c.Fields {
		if err := result.addField(&fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetTSMutationGraphQLTypeForFieldImports(false, true), true),
		}); err != nil {
			return nil, err
		}
	}

	for _, f := range c.NonEntFields {
		if err := result.addField(&fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetGraphQLMutationFieldType(f.ForceOptionalInAction()).GetTSGraphQLImports(true), true),
		}); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func buildActionInputNode(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) (*objectType, error) {
	// TODO shared input types across create/edit for example
	node := a.GetGraphQLInputName()

	result := newObjectType(&objectType{
		Type:     fmt.Sprintf("%sType", node),
		Node:     node,
		TSType:   node,
		Exported: true,
		GQLType:  "GraphQLInputObjectType",
	})

	// maybe not the best place for this probably but it makes sense
	// as dependencies...
	for _, c := range a.GetCustomInterfaces() {
		if c.Action != nil {
			action := c.Action.(action.Action)
			result.Imports = append(result.Imports, &tsimport.ImportPath{
				Import:     c.GQLName,
				ImportPath: getImportPathForActionFromPackage(action.GetNodeInfo().PackageName, action),
			})
		}
	}

	// add id field for edit and delete mutations
	// TODO use GetPublicAPIFields and remove this check everywhere that's doing this check here
	if a.MutatingExistingObject() {
		id, err := getIDField(processor, nodeData)
		if err != nil {
			return nil, err
		}
		if err := result.addField(&fieldType{
			Name: id,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLID"),
			},
			Description: fmt.Sprintf("id of %s", nodeData.Node),
		}); err != nil {
			return nil, err
		}
	}

	for _, f := range a.GetGraphQLFields() {
		if err := result.addField(&fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetTSMutationGraphQLTypeForFieldImports(!action.IsRequiredField(a, f), true), true),
		}); err != nil {
			return nil, err
		}
	}

	// add custom fields to the input
	for _, f := range a.GetGraphQLNonEntFields() {
		if err := result.addField(&fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetGraphQLMutationFieldType(f.ForceOptionalInAction()).GetTSGraphQLImports(true), true),
		}); err != nil {
			return nil, err
		}
	}

	// add each edge that's part of the mutation as an ID
	// use singular version so that this is friendID instead of friendsID
	for _, edge := range a.GetEdges() {
		if err := result.addField(&fieldType{
			Name: getEdgeField(processor, edge),
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLID"),
			},
		}); err != nil {
			return nil, err
		}
	}

	if hasCustomInput(a, processor) {
		// custom interface for editing

		var omittedFields []string
		// add adminID to interface assuming it's not already there
		intType := newInterfaceType(&interfaceType{
			Exported: false,
			Name:     fmt.Sprintf("custom%s", node),
		})

		// only want the id field for the object when editing said object
		if a.MutatingExistingObject() {
			id, err := getIDField(processor, nodeData)
			if err != nil {
				return nil, err
			}
			if err := intType.addField(&interfaceField{
				Name: id,
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			}); err != nil {
				return nil, err
			}
		}

		// add edges as part of the input
		// usually only one edge e.g. addFriend or addAdmin etc
		for _, edge := range a.GetEdges() {
			if err := intType.addField(&interfaceField{
				Name: getEdgeField(processor, edge),
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			}); err != nil {
				return nil, err
			}
		}

		// these conditions duplicated in hasCustomInput
		processField := func(f action.ActionField) error {
			fieldName := f.TSPublicAPIName()
			if f.IsEditableIDField(a.GetEditableFieldContext()) {
				// should probably also do this for id lists but not pressing
				// ID[] -> string[]
				if err := intType.addField(&interfaceField{
					Name:     f.GetGraphQLName(),
					Optional: !action.IsRequiredField(a, f),
					// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
					Type: "string",
				}); err != nil {
					return err
				}
			} else if fieldName != f.GetGraphQLName() {
				// need imports...
				omittedFields = append(omittedFields, fieldName)
				var useImports []string
				imps := f.GetTsTypeImports()
				if len(imps) != 0 {
					result.Imports = append(result.Imports, imps...)
					for _, v := range imps {
						useImports = append(useImports, v.Import)
					}
				}
				if err := intType.addField(&interfaceField{
					Name:     f.GetGraphQLName(),
					Optional: !action.IsRequiredField(a, f),
					// TODO we want the same types without the Builder part if it's an id field...
					Type:       f.TsBuilderType(processor.Config),
					UseImports: useImports,
				}); err != nil {
					return err
				}
			}
			return nil
		}
		for _, f := range a.GetGraphQLFields() {
			if err := processField(f); err != nil {
				return nil, err
			}
		}

		for _, f := range a.GetGraphQLNonEntFields() {
			if err := processField(f); err != nil {
				return nil, err
			}
		}

		// TODO do we need to overwrite some fields?
		if action.HasInput(a) {
			// TODO? we should just skip this and have all the fields here if snake_case
			// since long list of omitted fields
			intType.Extends = []string{
				a.GetActionInputName(),
			}
			intType.Omitted = omittedFields
		}

		result.TSInterfaces = []*interfaceType{intType}
	}

	return result, nil
}

func buildActionPayloadNode(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) (*objectType, error) {
	payload := a.GetGraphQLPayloadName()
	result := newObjectType(&objectType{
		Type:     a.GetGraphQLPayloadTypeName(),
		Node:     payload,
		TSType:   payload,
		Exported: true,
		GQLType:  "GraphQLObjectType",
		Imports: []*tsimport.ImportPath{
			{
				ImportPath: codepath.GetExternalImportPath(),
				Import:     nodeData.Node,
			},
			{
				ImportPath: codepath.GetImportPathForExternalGQLFile(),
				Import:     nodeData.GetGraphQLTypeName(),
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Import:     "mustDecodeIDFromGQLID",
			},
		},
	})
	if processor.Config.DisableDefaultExportForActions() {
		result.Imports = append(result.Imports, &tsimport.ImportPath{
			ImportPath: getActionPath(nodeData, a),
			Import:     a.GetActionName(),
		})
	} else {
		result.DefaultImports = append(result.DefaultImports, &tsimport.ImportPath{
			ImportPath: getActionPath(nodeData, a),
			Import:     a.GetActionName(),
		})
	}

	// this is here but it's probably better in buildActionFieldConfig
	if action.HasInput(a) {
		result.Imports = append(result.Imports, &tsimport.ImportPath{
			ImportPath: getActionPath(nodeData, a),
			Import:     a.GetActionInputName(),
		})
	}

	nodeInfo := a.GetNodeInfo()
	if a.GetOperation() != ent.DeleteAction {
		typ := nodeData.Node
		var fieldImports []*tsimport.ImportPath

		if a.CanFail() {
			typ = fmt.Sprintf("%s | null", typ)

			fieldImports = []*tsimport.ImportPath{
				{
					Import:     fmt.Sprintf("%sType", nodeInfo.Node),
					ImportPath: codepath.GetImportPathForExternalGQLFile(),
				},
			}
		} else {
			fieldImports = []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				{
					Import:     fmt.Sprintf("%sType", nodeInfo.Node),
					ImportPath: codepath.GetImportPathForExternalGQLFile(),
				},
			}
		}

		if err := result.addField(&fieldType{
			Name:         nodeInfo.NodeInstance,
			FieldImports: fieldImports,
		}); err != nil {
			return nil, err
		}

		result.TSInterfaces = []*interfaceType{
			newInterfaceType(&interfaceType{
				Exported: false,
				Name:     payload,
				Fields: []*interfaceField{
					{
						Name:       nodeData.NodeInstance,
						Type:       typ,
						UseImports: []string{nodeData.Node},
					},
				},
			}),
		}
	} else {
		deleted := getDeletedField(processor, nodeInfo.Node)
		if err := result.addField(&fieldType{
			Name: deleted,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLImportPath("GraphQLID"),
			},
		}); err != nil {
			return nil, err
		}

		result.TSInterfaces = []*interfaceType{
			newInterfaceType(&interfaceType{
				Exported: false,
				Name:     payload,
				Fields: []*interfaceField{
					{
						Name: deleted,
						Type: "string",
					},
				},
			}),
		}
	}

	return result, nil
}

func hasCustomInput(a action.Action, processor *codegen.Processor) bool {
	if a.MutatingExistingObject() {
		return true
	}

	processField := func(f action.ActionField) bool {
		// these conditions duplicated in hasInput in buildActionInputNode
		// editable id field. needs custom input because we don't want to type as ID or Builder when we call base64encodeIDs
		// mustDecodeIDFromGQLID
		if f.IsEditableIDField(a.GetEditableFieldContext()) && processor.Config.Base64EncodeIDs() {
			return true
		}
		// if graphql name is not equal to typescript name, we need to add the new field here
		if f.GetGraphQLName() != f.TSPublicAPIName() {
			return true
		}
		return false
	}

	for _, f := range a.GetGraphQLFields() {
		if processField(f) {
			return true
		}
	}

	for _, f := range a.GetGraphQLNonEntFields() {
		if processField(f) {
			return true
		}
	}
	return false
}

func getActionPath(nodeData *schema.NodeData, a action.Action) string {
	return fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, names.ToFilePathName(a.GetActionName()))
}

func getActionPathFromAction(a action.Action) string {
	return fmt.Sprintf("src/ent/%s/actions/%s", a.GetNodeInfo().PackageName, names.ToFilePathName(a.GetActionName()))
}

func checkUnionType(cfg codegenapi.Config, nodeName string, f *field.Field, curr []string) ([]string, bool, error) {
	t := f.GetFieldType()

	t2, ok := t.(enttype.TSWithSubFields)
	if ok {
		// can have subFields nil and unionFields
		subFields := t2.GetSubFields()
		if subFields != nil {
			newCurr := append(curr, f.GetGraphQLName())
			actualSubFields := subFields.([]*input.Field)

			fi, err := field.NewFieldInfoFromInputs(cfg, nodeName, actualSubFields, &field.Options{})
			if err != nil {
				return nil, false, err
			}
			for _, v := range fi.EntFields() {
				ret, done, err := checkUnionType(cfg, nodeName, v, newCurr)
				if err != nil {
					return nil, false, err
				}
				if done {
					return ret, done, nil
				}
			}
		}
	}
	t3, ok2 := t.(enttype.TSWithUnionFields)
	if ok2 {
		unionFields := t3.GetUnionFields()
		if unionFields != nil {
			newCurr := append(curr, f.GetGraphQLName())
			return newCurr, true, nil
		}
	}

	return nil, false, nil
}

// prefix:input or args
// returns (`foo: input.foo`, imports)
func processActionField(processor *codegen.Processor, a action.Action, f action.ActionField, prefix string) (string, []*tsimport.ImportPath) {
	typ := f.GetFieldType()
	// get nullable version
	if !action.IsRequiredField(a, f) {
		nullable, ok := typ.(enttype.NullableType)
		if ok {
			typ = nullable.GetNullableType()
		}
	}

	inputField := fmt.Sprintf("%s.%s", prefix, f.GetGraphQLName())

	customRenderer, ok := typ.(enttype.CustomGQLRenderer)

	var argImports []*tsimport.ImportPath
	if ok {
		inputField = customRenderer.CustomGQLRender(processor.Config, inputField)
		argImports = append(argImports, getGQLFileImports(customRenderer.ArgImports(processor.Config), true)...)
	}

	return fmt.Sprintf(
		"%s: %s,",
		f.TSPublicAPIName(),
		inputField,
	), argImports
}

func buildActionFieldConfig(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) (*fieldConfig, error) {
	// TODO this is so not obvious at all
	// these are things that are automatically useImported....
	argImports := []*tsimport.ImportPath{
		{
			Import:     a.GetActionName(),
			ImportPath: getActionPath(nodeData, a),
		},
	}
	var argName string
	if hasCustomInput(a, processor) {
		input := a.GetGraphQLInputName()
		argName = fmt.Sprintf("custom%s", input)
	} else {
		argName = a.GetActionInputName()
		argImports = append(argImports, &tsimport.ImportPath{
			Import:     argName,
			ImportPath: getActionPath(nodeData, a),
		})
	}
	prefix := names.ToClassType(a.GetGraphQLName())
	result := &fieldConfig{
		Exported:         true,
		Name:             fmt.Sprintf("%sType", prefix),
		Arg:              fmt.Sprintf("{ [input: string]: %s}", argName),
		ResolveMethodArg: "{ input }",
		TypeImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			{
				// local so it's fine
				Import: a.GetGraphQLPayloadTypeName(),
			},
		},
		Args: []*fieldConfigArg{
			{
				Name: "input",
				Imports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					{
						// local
						Import: a.GetGraphQLInputTypeName(),
					},
				},
			},
		},
		ReturnTypeHint: fmt.Sprintf("Promise<%s>", a.GetGraphQLPayloadName()),
	}

	base64EncodeIDs := processor.Config.Base64EncodeIDs()

	addField := func(f action.ActionField) {
		inputFieldLine, imports := processActionField(processor, a, f, "input")

		result.FunctionContents = append(
			result.FunctionContents,
			inputFieldLine,
		)
		argImports = append(argImports, imports...)
	}

	lists := [][]string{}
	for _, f := range a.GetFields() {
		list, union, err := checkUnionType(processor.Config, nodeData.Node, f, []string{})

		if err != nil {
			return nil, err
		}
		if union {
			lists = append(lists, list)
		}
	}

	if len(lists) > 0 {
		var sb strings.Builder
		// outer list
		sb.WriteString("[")
		for _, list := range lists {
			// inner list
			sb.WriteString("[")
			for _, str := range list {
				sb.WriteString(strconv.Quote(str))
				sb.WriteString(",")
			}
			// inner list
			sb.WriteString("]")
		}
		// outer list
		sb.WriteString("]")

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("input = transformUnionTypes(input, %s);", sb.String()),
		)
		argImports = append(argImports, tsimport.NewEntGraphQLImportPath("transformUnionTypes"))
	}

	if a.GetOperation() == ent.CreateAction {
		result.FunctionContents = append(
			result.FunctionContents,
			// we need fields like userID here which aren't exposed to graphql but editable...
			fmt.Sprintf("const %s = await %s.create(context.getViewer(), {", nodeData.NodeInstance, a.GetActionName()),
		)
		for _, f := range a.GetGraphQLFields() {
			// we need fields like userID here which aren't exposed to graphql but editable...
			addField(f)
		}

		for _, f := range a.GetGraphQLNonEntFields() {
			addField(f)
		}
		result.FunctionContents = append(result.FunctionContents, "}).saveX();")

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
		)
	} else {
		deleteAction := a.GetOperation() == ent.DeleteAction

		// edit or delete
		if base64EncodeIDs {
			argImports = append(argImports, &tsimport.ImportPath{
				Import:     "mustDecodeIDFromGQLID",
				ImportPath: codepath.GraphQLPackage,
			})
		}

		saveMethod := "saveXFromID"
		if a.CanFail() {
			saveMethod = "saveFromID"
		}

		idField, err := getIDField(processor, nodeData)
		if err != nil {
			return nil, err
		}

		if action.HasInput(a) {
			// have fields and therefore input
			if !deleteAction {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s =", nodeData.NodeInstance),
				)
			}

			if base64EncodeIDs {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("await %s.%s(context.getViewer(), mustDecodeIDFromGQLID(input.%s), {", a.GetActionName(), saveMethod, idField),
				)
			} else {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("await %s.%s(context.getViewer(), input.%s, {", a.GetActionName(), saveMethod, idField),
				)
			}
			for _, f := range a.GetGraphQLFields() {
				addField(f)
			}
			for _, f := range a.GetGraphQLNonEntFields() {
				addField(f)
			}
			result.FunctionContents = append(result.FunctionContents, "});")

		} else if action.IsEdgeAction(a) {
			edges := a.GetEdges()
			if len(edges) != 1 {
				return nil, errors.New("expected one edge for an edge action")
			}
			edge := edges[0]
			// have fields and therefore input
			edgeField := getEdgeField(processor, edge)
			if base64EncodeIDs {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.%s(context.getViewer(), mustDecodeIDFromGQLID(input.%s), mustDecodeIDFromGQLID(input.%s));", nodeData.NodeInstance, a.GetActionName(), saveMethod, idField, edgeField),
				)
			} else {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.%s(context.getViewer(), input.%s, input.%s);", nodeData.NodeInstance, a.GetActionName(), saveMethod, idField, edgeField),
				)
			}
		} else {
			if !deleteAction {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s =", nodeData.NodeInstance),
				)
			}
			if base64EncodeIDs {
				// no fields
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("await %s.%s(context.getViewer(), mustDecodeIDFromGQLID(input.%s));", a.GetActionName(), saveMethod, idField),
				)
			} else {
				// no fields
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("await %s.%s(context.getViewer(), input.%s);", a.GetActionName(), saveMethod, idField),
				)
			}
		}

		if deleteAction {
			deletedField := getDeletedField(processor, nodeData.Node)
			result.FunctionContents = append(
				result.FunctionContents,
				fmt.Sprintf("return {%s: input.%s};", deletedField, idField),
			)
		} else {

			result.FunctionContents = append(
				result.FunctionContents,
				fmt.Sprintf("return {%s};", nodeData.NodeInstance),
			)
		}
	}

	// TODO these are just all imports, we don't care where from
	result.ArgImports = argImports

	return result, nil
}

func getDeletedField(processor *codegen.Processor, node string) string {
	return names.ToGraphQLName(processor.Config, fmt.Sprintf("deleted%sID", node))
}

func getIDField(processor *codegen.Processor, nodeData *schema.NodeData) (string, error) {
	pkey := nodeData.FieldInfo.SingleFieldPrimaryKey()
	if pkey == "" {
		return "", fmt.Errorf("no single field primary key for %s", nodeData.Node)
	}
	return names.ToGraphQLName(processor.Config, pkey), nil
}

func getEdgeField(processor *codegen.Processor, edge *edge.AssociationEdge) string {
	return names.ToGraphQLName(processor.Config, edge.Singular(), "ID")
}

type customInterfaceInfo struct {
	exported bool
	name     string
	input    bool
	imports  []string
}

// similar to buildCustomInputNode but different...
// buildCustomInputNode is used for action inputs
// while this is used for StructType. can probably eventually be used together
func buildCustomInterfaceNode(processor *codegen.Processor, ci *customtype.CustomInterface, ciInfo *customInterfaceInfo) (*objectType, error) {
	node := ciInfo.name
	gqlType := "GraphQLObjectType"
	if ciInfo.input {
		gqlType = "GraphQLInputObjectType"
	}

	result := newObjectType(&objectType{
		Type:     fmt.Sprintf("%sType", node),
		Node:     node,
		TSType:   node,
		Exported: ciInfo.exported,
		GQLType:  gqlType,
	})
	// top level
	if ciInfo.exported {
		result.Imports = []*tsimport.ImportPath{
			{
				ImportPath: codepath.GetTypesImportPath(),
				Import:     ci.TSType,
			},
		}
	}
	for _, imp := range ciInfo.imports {
		result.Imports = append(result.Imports, &tsimport.ImportPath{
			ImportPath: codepath.GetTypesImportPath(),
			Import:     imp,
		})
	}

	for _, f := range ci.Fields {
		ft := &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetTSGraphQLTypeForFieldImports(ciInfo.input), ciInfo.input),
		}
		if !ciInfo.input && f.TsFieldName(processor.Config) != f.GetGraphQLName() {
			ft.HasResolveFunction = true
			ft.FunctionContents = []string{fmt.Sprintf("return obj.%s", f.TsFieldName(processor.Config))}
		}
		if err := result.addField(ft); err != nil {
			return nil, err
		}
	}

	for _, f := range ci.NonEntFields {
		if err := result.addField(&fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetGraphQLMutationFieldType(f.ForceOptionalInAction()).GetTSGraphQLImports(true), ciInfo.input),
		}); err != nil {
			return nil, err
		}
	}

	return result, nil
}

func buildCustomUnionNode(processor *codegen.Processor, cu *customtype.CustomUnion) *objectType {
	result := newObjectType(&objectType{
		Type:    fmt.Sprintf("%sType", cu.GQLName),
		Node:    cu.GQLName,
		TSType:  cu.TSType,
		GQLType: "GraphQLUnionType",
	})

	unionTypes := make([]string, len(cu.Interfaces))
	for i, ci := range cu.Interfaces {
		unionTypes[i] = fmt.Sprintf("%sType", ci.GQLName)
	}
	result.UnionTypes = unionTypes

	return result
}

func buildCustomUnionInputNode(processor *codegen.Processor, cu *customtype.CustomUnion) (*objectType, error) {
	result := newObjectType(&objectType{
		Type:    fmt.Sprintf("%sInputType", cu.GQLName),
		Node:    cu.GQLName + "Input",
		TSType:  cu.TSType,
		GQLType: "GraphQLInputObjectType",
	})

	for _, ci := range cu.Interfaces {
		if ci.GraphQLFieldName == "" {
			return nil, fmt.Errorf("invalid field name for interface %s", ci.GQLName)
		}
		if err := result.addField(&fieldType{
			Name: ci.GraphQLFieldName,
			FieldImports: []*tsimport.ImportPath{
				{
					Import: ci.GQLName + "InputType",
				},
			},
		}); err != nil {
			return nil, err
		}
	}

	return result, nil
}

type objectType struct {
	Type        string // GQLType we're creating
	Node        string // GraphQL Node AND also ent node. Need to decouple this...
	TSType      string
	Fields      []*fieldType
	fieldMap    map[string]bool
	Exported    bool
	ArgNotInput bool
	GQLType     string // GraphQLObjectType or GraphQLInputObjectType

	DefaultImports []*tsimport.ImportPath
	Imports        []*tsimport.ImportPath
	TSInterfaces   []*interfaceType
	Classes        []*classType

	// make this a string for now since we're only doing built-in interfaces
	GQLInterfaces  []string
	IsTypeOfMethod []string

	UnionTypes []string
}

func newObjectType(obj *objectType) *objectType {
	obj.fieldMap = make(map[string]bool)
	return obj
}

func (obj *objectType) addField(f *fieldType) error {
	if obj.fieldMap[f.Name] {
		return fmt.Errorf("duplicate graphql field %s in object %s", f.Name, obj.Node)
	}
	obj.fieldMap[f.Name] = true
	obj.Fields = append(obj.Fields, f)
	return nil
}

func (obj *objectType) getRenderer(s *gqlSchema) renderer {
	interfaces := make([]string, len(obj.GQLInterfaces))
	for idx, inter := range obj.GQLInterfaces {
		interfaces[idx] = strings.TrimSuffix(strings.TrimPrefix(inter, "GraphQL"), "Interface")
	}

	unions := make([]string, len(obj.UnionTypes))
	for idx, u := range obj.UnionTypes {
		unions[idx] = strings.TrimSuffix(u, "Type")
	}

	return &elemRenderer{
		input:       obj.GQLType == "GraphQLInputObjectType",
		union:       obj.GQLType == "GraphQLUnionType",
		isInterface: obj.GQLType == "GraphQLInterfaceType",
		name:        obj.Node,
		interfaces:  interfaces,
		fields:      obj.Fields,
		unionTypes:  unions,
	}
}

type fieldType struct {
	Name               string
	HasResolveFunction bool
	HasAsyncModifier   bool
	Description        string
	FieldImports       []*tsimport.ImportPath
	// imports that are ignored in the FieldType method but needed in the file e.g. used in FunctionContents
	ExtraImports []*tsimport.ImportPath
	Args         []*fieldConfigArg
	// no args for now. come back.
	FunctionContents []string
	ResolverMethod   string
	// TODO more types we need to support
}

var flagTime = false

func getRawType(typ string, s *gqlSchema) string {
	rawType := typ
	if strings.HasPrefix(typ, "GraphQL") {
		rawType = strings.TrimPrefix(typ, "GraphQL")
	} else {
		rawType = strings.TrimSuffix(typ, "Type")
	}
	cs, ok := s.customData.Objects[rawType]
	if ok {
		return cs.NodeName
	}
	for k, v := range knownTypes {
		if v.Import == typ {
			return k
		}
	}
	if rawType == "Time" {
		flagTime = true
	}
	return rawType
}

func getTypeForImports(imps []*tsimport.ImportPath, s *gqlSchema) string {
	typ := ""
	nonNullable := false
	list := false
	nonNullableContents := false
	for _, imp := range imps {
		if imp.Import == "GraphQLNonNull" {
			if list {
				nonNullableContents = true
			} else {
				nonNullable = true
			}
		} else if imp.Import == "GraphQLList" {
			list = true
		} else {
			// TODO imp.Name
			// Custom types
			typ = getRawType(imp.Import, s)
		}
	}

	ret := typ
	if nonNullableContents || (!list && nonNullable) {
		ret = ret + "!"
	}
	if list {
		ret = "[" + ret + "]"
	}
	if list && nonNullable {
		ret = ret + "!"
	}
	return ret
}

func (f *fieldType) getType(s *gqlSchema) string {
	return getTypeForImports(f.FieldImports, s)
}

func (f *fieldType) render(s *gqlSchema) string {
	var sb strings.Builder
	if f.Description != "" {
		sb.WriteString("  ")
		renderDescription(&sb, f.Description)
	}

	sb.WriteString("  ")
	sb.WriteString(f.Name)

	if len(f.Args) > 0 {
		sb.WriteString("(")
		args := make([]string, len(f.Args))
		for idx, arg := range f.Args {
			args[idx] = arg.render(s)
		}
		sb.WriteString(strings.Join(args, ", "))

		sb.WriteString(")")
	}

	sb.WriteString(": ")
	sb.WriteString(f.getType(s))
	sb.WriteString("\n")
	return sb.String()
}

type interfaceType struct {
	Exported bool
	Name     string
	Fields   []*interfaceField
	fieldMap map[string]bool
	// interfaces to extend
	Extends []string

	//	list of omitted fields
	// interface ends up being
	// interface customFooInput extends Omit<FooInput, 'f1' | 'f2'> { ... fields}
	Omitted []string
}

func newInterfaceType(it *interfaceType) *interfaceType {
	it.fieldMap = make(map[string]bool)
	return it
}

func (it *interfaceType) addField(f *interfaceField) error {
	if it.fieldMap[f.Name] {
		return fmt.Errorf("duplicate graphql field %s in object %s", f.Name, it.Name)
	}
	it.fieldMap[f.Name] = true
	it.Fields = append(it.Fields, f)
	return nil
}

func (it interfaceType) InterfaceDecl() (string, error) {
	var sb strings.Builder
	if it.Exported {
		sb.WriteString("export ")
	}
	sb.WriteString("interface ")
	sb.WriteString(it.Name)

	if len(it.Omitted) != 0 {
		if len(it.Extends) != 1 {
			return "", fmt.Errorf("if omitted fields exists, need only 1 class being extended")
		}
		sb.WriteString(" extends Omit<")
		sb.WriteString(it.Extends[0])
		sb.WriteString(",")
		omitted := make([]string, len(it.Omitted))
		for i := range it.Omitted {
			omitted[i] = strconv.Quote(it.Omitted[i])
		}
		sb.WriteString(strings.Join(omitted, "| "))
		sb.WriteString(">")
	} else {
		if len(it.Extends) > 0 {
			sb.WriteString(" extends ")
			sb.WriteString(strings.Join(it.Extends, ", "))
		}
	}

	return sb.String(), nil
}

type interfaceField struct {
	Name       string
	Optional   bool
	Type       string
	UseImport  bool
	UseImports []string
}

type classType struct {
	Name     string
	Exported bool
	Contents string
	//any imports here are reserved and used and assumed they're added because they're needed...
	UnconditionalImports []*tsimport.ImportPath
}

// TODO inline this in fieldTypeFromImports
func typeFromImports(imports []string) string {
	var sb strings.Builder
	var endSb strings.Builder
	for idx, imp := range imports {
		// only need to write () if we have more than one
		if idx != 0 {
			sb.WriteString("(")
			endSb.WriteString(")")
		}
		sb.WriteString(imp)
	}
	sb.WriteString(endSb.String())
	return sb.String()
}

func fieldTypeFromImports(imports []*tsimport.ImportPath) string {
	imps := make([]string, len(imports))
	for idx, imp := range imports {
		if imp.Function {
			imps[idx] = fmt.Sprintf("%s()", imp.Import)
		} else if imp.Class {
			imps[idx] = fmt.Sprintf("new %s", imp.Import)
		} else {
			imps[idx] = imp.Import
		}
	}
	return typeFromImports(imps)
}

func (f *fieldType) FieldType() string {
	return fieldTypeFromImports(f.FieldImports)
}

func (f *fieldType) AllImports() []*tsimport.ImportPath {
	ret := append(f.FieldImports, f.ExtraImports...)
	for _, arg := range f.Args {
		ret = append(ret, arg.Imports...)
	}
	return ret
}

// a root field in the schema
type rootField struct {
	ImportPath string // import path
	Name       string // name e.g. viewer, contact, userCreate
	Type       string // TypeScript type e.g. User
}

// for root query | mutation in schema
type gqlRootData struct {
	RootFields []rootField
	Type       string
	Node       string
	FilePath   string
	// this seems to be used in schema.gql
	fieldTypes []*fieldType
}

func (r *gqlRootData) getRenderer(s *gqlSchema) renderer {
	return &elemRenderer{
		name:   r.Node,
		fields: r.fieldTypes,
	}
}

func getQueryData(processor *codegen.Processor, s *gqlSchema) *gqlRootData {
	rootFields := []rootField{}
	fieldTypes := []*fieldType{}
	for _, rootQuery := range s.rootQueries {
		rootFields = append(rootFields, rootField{
			Name:       rootQuery.Name,
			Type:       rootQuery.FieldConfig.Name,
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
		})

		fieldTypes = append(fieldTypes, &fieldType{
			Name:         rootQuery.Name,
			Args:         rootQuery.FieldConfig.Args,
			FieldImports: rootQuery.FieldConfig.TypeImports,
			Description:  rootQuery.FieldConfig.Description,
		})
	}

	for _, node := range s.customQueries {
		if node.Field == nil {
			panic("TODO query with no custom field")
		}
		query := node.Field
		rootFields = append(rootFields, rootField{
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
			Name:       query.GraphQLName,
			Type:       names.ToClassType(query.GraphQLName, "QueryType"),
		})

		fieldTypes = append(fieldTypes, &fieldType{
			Name:         query.GraphQLName,
			Args:         node.ObjData.FieldConfig.Args,
			FieldImports: node.ObjData.FieldConfig.TypeImports,
			Description:  node.ObjData.FieldConfig.Description,
		})
	}

	canViewerDo := s.otherObjects["GlobalCanViewerDo"]
	if canViewerDo != nil {
		rootFields = append(rootFields, rootField{
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
			Name:       "can_viewer_do",
			Type:       canViewerDo.ObjData.FieldConfig.Name,
		})

		fieldTypes = append(fieldTypes, &fieldType{
			Name:         "can_viewer_do",
			Args:         canViewerDo.ObjData.FieldConfig.Args,
			FieldImports: canViewerDo.ObjData.FieldConfig.TypeImports,
		})
	}

	// sort lexicographically so that we are not always changing this
	sort.Slice(rootFields, func(i, j int) bool {
		return rootFields[i].Name < rootFields[j].Name
	})
	// sort lexicographically so that we are not always changing this
	sort.Slice(fieldTypes, func(i, j int) bool {
		return fieldTypes[i].Name < fieldTypes[j].Name
	})

	return &gqlRootData{
		Type:       "QueryType",
		Node:       "Query",
		RootFields: rootFields,
		fieldTypes: fieldTypes,
		FilePath:   getQueryFilePath(processor.Config),
	}
}

func getMutationData(processor *codegen.Processor, s *gqlSchema) *gqlRootData {
	rootFields := []rootField{}
	fieldTypes := []*fieldType{}

	for _, node := range s.nodes {
		for _, dep := range node.ActionDependents {
			action := dep.Data.(action.Action)
			gqlName := action.GetGraphQLName()
			rootFields = append(rootFields, rootField{
				ImportPath: trimPath(processor.Config, dep.FilePath),
				Type:       names.ToClassType(gqlName, "Type"),
				Name:       gqlName,
			})

			fieldTypes = append(fieldTypes, &fieldType{
				Name:         gqlName,
				Args:         dep.ObjData.FieldConfig.Args,
				FieldImports: dep.ObjData.FieldConfig.TypeImports,
				Description:  dep.ObjData.FieldConfig.Description,
			})
		}
	}

	for _, node := range s.customMutations {
		if node.Field == nil {
			panic("TODO mutation with no custom field")
		}
		mutation := node.Field
		rootFields = append(rootFields, rootField{
			ImportPath: getImportPathForCustomMutation(mutation.GraphQLName),
			Name:       mutation.GraphQLName,
			Type:       names.ToClassType(mutation.GraphQLName, "Type"),
		})

		fieldTypes = append(fieldTypes, &fieldType{
			Name:         mutation.GraphQLName,
			Args:         node.ObjData.FieldConfig.Args,
			FieldImports: node.ObjData.FieldConfig.TypeImports,
			Description:  node.ObjData.FieldConfig.Description,
		})
	}

	// sort lexicographically so that we are not always changing this
	sort.Slice(rootFields, func(i, j int) bool {
		return rootFields[i].Name < rootFields[j].Name
	})

	sort.Slice(fieldTypes, func(i, j int) bool {
		return fieldTypes[i].Name < fieldTypes[j].Name
	})

	return &gqlRootData{
		RootFields: rootFields,
		Type:       "MutationType",
		Node:       "Mutation",
		fieldTypes: fieldTypes,
		FilePath:   getMutationFilePath(processor.Config),
	}
}

func writeRootDataFile(processor *codegen.Processor, rootData *gqlRootData) error {
	imps := tsimport.NewImports(processor.Config, rootData.FilePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		Data:              rootData,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/root.tmpl"),
		TemplateName:      "root.tmpl",
		PathToFile:        rootData.FilePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func buildNodeFieldConfig(processor *codegen.Processor) *fieldConfig {
	return &fieldConfig{
		Exported: true,
		Name:     "NodeQueryType",
		Arg:      "NodeQueryArgs",
		TypeImports: []*tsimport.ImportPath{
			{
				Import:     "GraphQLNodeInterface",
				ImportPath: codepath.GraphQLPackage,
			},
		},
		Args: []*fieldConfigArg{
			{
				Name:    "id",
				Imports: []*tsimport.ImportPath{tsimport.NewGQLClassImportPath("GraphQLNonNull"), tsimport.NewGQLImportPath("GraphQLID")},
			},
		},
		FunctionContents: []string{
			"return resolveID(context.getViewer(), args.id);",
		},
	}
}

func buildRootQuery(processor *codegen.Processor, nodeData *schema.NodeData) *rootQuery {
	return &rootQuery{
		Name: nodeData.PackageName,
		Interfaces: []*interfaceType{
			newInterfaceType(&interfaceType{
				Name: fmt.Sprintf("%sQueryArgs", nodeData.Node),
				Fields: []*interfaceField{
					{
						Name: "id",
						Type: "string",
					},
				},
			}),
		},
		FieldConfig: &fieldConfig{
			Exported: true,
			Name:     fmt.Sprintf("%sQueryType", nodeData.Node),
			Arg:      fmt.Sprintf("%sQueryArgs", nodeData.Node),
			TypeImports: []*tsimport.ImportPath{
				{
					Import:     fmt.Sprintf("%sType", nodeData.Node),
					ImportPath: codepath.GetImportPathForInternalGQLFile(),
				},
			},
			Args: []*fieldConfigArg{
				{
					Name:    "id",
					Imports: []*tsimport.ImportPath{tsimport.NewGQLClassImportPath("GraphQLNonNull"), tsimport.NewGQLImportPath("GraphQLID")},
				},
			},
			ArgImports: []*tsimport.ImportPath{
				{
					ImportPath: codepath.GetExternalImportPath(),
					Import:     nodeData.Node,
				},
			},
			FunctionContents: []string{
				fmt.Sprintf("return %s.load(context.getViewer(), args.id);", nodeData.Node),
			},
		},
		FilePath: getRootQueryFilePath(processor.Config, nodeData),
		Imports: []*tsimport.ImportPath{
			{
				Import:     fmt.Sprintf("%sType", nodeData.Node),
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
			},
			{
				ImportPath: codepath.GetExternalImportPath(),
				Import:     nodeData.Node,
			},
		},
	}
}

func buildNodeRootQuery(processor *codegen.Processor) *rootQuery {
	return &rootQuery{
		FieldConfig:  buildNodeFieldConfig(processor),
		Name:         "node",
		FilePath:     getNodeQueryTypeFilePath(processor.Config),
		WriteOnce:    true,
		EditableCode: true,
		Interfaces: []*interfaceType{
			{
				Name: "NodeQueryArgs",
				Fields: []*interfaceField{
					{
						Name: "id",
						Type: "string",
					},
				},
			},
		},
		Imports: []*tsimport.ImportPath{
			{
				ImportPath: codepath.GraphQLPackage,
				Import:     "EntNodeResolver",
			},
			{
				ImportPath: "src/ent/generated/loadAny",
				Import:     "loadEntByType",
			},
			{
				ImportPath: codepath.GetTypesImportPath(),
				Import:     "NodeType",
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Import:     "registerResolver",
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Import:     "resolveID",
			},
			{
				Import:     "GraphQLNodeInterface",
				ImportPath: codepath.GraphQLPackage,
			},
		},
		CustomCode: `
		const resolver = new EntNodeResolver((v, nodeType, id) =>
      loadEntByType(v, nodeType as NodeType, id),
    );
		registerResolver("entNode", resolver);
		// add any custom Node Resolvers here
		`,
	}
}

// marker interface that field_config.tmpl uses
type importHelper interface {
	ForeignImport(name string) bool
}

func writeRootQueryFile(processor *codegen.Processor, rq *rootQuery) error {
	imps := tsimport.NewImports(processor.Config, rq.FilePath)
	opts := []func(opt *file.Options){}
	if rq.WriteOnce {
		opts = append(opts, file.WriteOnce())
	}
	return file.Write(&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			RootQuery *rootQuery
			Package   *codegen.ImportPackage
			Config    *codegen.Config
		}{
			rq,
			processor.Config.GetImportPackage(),
			processor.Config,
		},
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/root_query.tmpl"),
		TemplateName:      "root_query.tmpl",
		OtherTemplateFiles: []string{
			util.GetAbsolutePath("ts_templates/field_config.tmpl"),
			util.GetAbsolutePath("ts_templates/render_args.tmpl"),
			util.GetAbsolutePath("ts_templates/field.tmpl"),
			util.GetAbsolutePath("ts_templates/interfaces.tmpl"),
		},
		PathToFile:   rq.FilePath,
		TsImports:    imps,
		FuncMap:      imps.FuncMap(),
		EditableCode: rq.EditableCode,
	}, opts...)
}

func writeTSSchemaFile(processor *codegen.Processor, s *gqlSchema) error {
	cfg := processor.Config
	filePath := getTSSchemaFilePath(cfg)
	imps := tsimport.NewImports(cfg, filePath)

	var subscription *tsimport.ImportPath
	if obj := cfg.SubscriptionType(); obj != nil {
		subscription = obj.GetImportPath()
	}

	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			HasMutations           bool
			SubscriptionImportPath *tsimport.ImportPath
			QueryPath              string
			MutationPath           string
			AllTypes               []typeInfo
		}{
			s.hasMutations,
			subscription,
			getQueryImportPath(),
			getMutationImportPath(),
			s.allTypes,
		},
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/schema.tmpl"),
		TemplateName:      "schema.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func writeTSIndexFile(processor *codegen.Processor, s *gqlSchema) error {
	// nothing to do here
	if processor.Config.DisableGraphQLRoot() {
		return nil
	}
	filePath := getTSIndexFilePath(processor.Config)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			Package     string
			AuthPackage string
		}{
			codepath.Package,
			codepath.AuthPackage,
		},
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/index.tmpl"),
		TemplateName:      "index.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
	}), file.WriteOnce())
}

func generateAlternateSchemaFile(processor *codegen.Processor, s *gqlSchema) error {
	var sb strings.Builder

	sb.WriteString("# Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.\n\n")

	writeRenderable := func(r renderable) {
		sb.WriteString(r.getRenderer(s).render(s))
		sb.WriteString("\n")
	}

	writeRenderer := func(r renderer) {
		sb.WriteString(r.render(s))
		sb.WriteString("\n")
	}

	// add node interface
	if len(s.nodes) > 0 {
		writeRenderer(getNodeInterfaceRenderer())
	}
	// add connection info
	if s.hasConnections {
		writeRenderer(getConnectionRenderer())
	}

	for _, typ := range s.allTypes {
		r, ok := typ.Obj.(renderable)
		if ok {
			writeRenderable(r)
		} else {
			spew.Dump(typ.Obj)
			fmt.Printf("invalid unrenderable obj %v\n", typ.Obj)
		}
	}

	for _, rd := range s.rootDatas {
		writeRenderable(rd)
	}

	// sort scalars so stable
	var scalars []*CustomScalarInfo
	for _, ct := range s.customData.CustomTypes {
		if ct.ScalarInfo != nil {
			// TODO eventually make this generic instead of this ugliness
			// this prevents scalar Time from showing up until we make this generic enough
			if ct.Type == "GraphQLTime" && !flagTime {
				continue
			}
			scalars = append(scalars, ct.ScalarInfo)
		}
	}
	sort.Slice(scalars, func(i, j int) bool {
		return scalars[i].Name < scalars[j].Name
	})

	for _, scalar := range scalars {
		writeRenderable(scalar)
	}

	return os.WriteFile("src/graphql/generated/schema.gql", []byte(sb.String()), 0666)
}

func generateSchemaFile(processor *codegen.Processor, hasMutations bool) error {
	// this generates the schema.gql file
	// needs to be done after all files have been generated
	filePath := getTempSchemaFilePath(processor.Config)

	err := writeSchemaFile(processor.Config, filePath, hasMutations)

	defer os.Remove(filePath)
	if err != nil {
		return errors.Wrap(err, "error writing temporary schema file")
	}

	cmd := exec.Command("ts-node", "-r", cmd.GetTsconfigPaths(), filePath)
	// TODO check this and do something useful with it
	// and then apply this in more places
	// for now we'll just spew it when there's an error as it's a hint as to what
	// TODO https://github.com/lolopinto/ent/issues/61
	// TODO https://github.com/lolopinto/ent/issues/76
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		return errors.Wrap(err, "error writing schema file")
	}
	return nil
}

type schemaData struct {
	QueryPath    string
	MutationPath string
	HasMutations bool
	SchemaPath   string
}

func writeSchemaFile(cfg *codegen.Config, fileToWrite string, hasMutations bool) error {
	return file.Write(
		&file.TemplatedBasedFileWriter{
			Config: cfg,
			Data: schemaData{
				QueryPath:    getQueryImportPath(),
				MutationPath: getMutationImportPath(),
				HasMutations: hasMutations,
				SchemaPath:   getSchemaFilePath(cfg),
			},
			AbsPathToTemplate: util.GetAbsolutePath("generate_schema.tmpl"),
			TemplateName:      "generate_schema.tmpl",
			PathToFile:        fileToWrite,
		},
		file.DisableLog(),
		file.TempFile(),
	)
}
