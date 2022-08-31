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
	"github.com/iancoleman/strcase"
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
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/testingutils"
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

var knownCustomTypes = map[string]string{
	"Date": "GraphQLTime",
	"JSON": "GraphQLJSON",
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

	writeAll := processor.Config.WriteAllFiles()
	for idx := range s.enums {
		enum := s.enums[idx]
		if writeAll ||
			processor.ChangeMap.ChangesExist(enum.Enum.Name, change.AddEnum, change.ModifyEnum) {
			ret = append(ret, func() error {
				return writeEnumFile(processor, enum)
			})
		}
	}

	// enum doesn't exist so won't be in s.enums anymore so have to go through all changes
	// to delete the file
	// TODO this isn't ideal. we should process this once and flag deleted ish separately
	for k := range processor.ChangeMap {
		if s.nodes[k] != nil || s.enums[k] != nil {
			continue
		}
		if processor.ChangeMap.ChangesExist(k, change.RemoveEnum) {
			ret = append(ret, file.GetDeleteFileFunction(processor.Config, getFilePathForEnum(processor.Config, k)))
		}
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
		changemap := processor.ChangeMap
		changes := changemap[node.ObjData.Node]
		for _, c := range changes {
			if c.TSOnly {
				continue
			}
			switch c.Change {
			case change.AddNode, change.ModifyNode:
				opts.writeNode = true

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

func (p *TSStep) buildNodeWithOpts(processor *codegen.Processor, s *gqlSchema, node *gqlNode, opts *writeOptions) fns.FunctionList {
	var ret fns.FunctionList
	if opts.writeNode {
		ret = append(ret, func() error {
			return writeFile(processor, node)
		})
	}

	for idx := range node.connections {
		conn := node.connections[idx]
		if opts.writeAllConnections || opts.connectionFiles[conn.Connection] {
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
					k),
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
	funcs = append(funcs, p.processEnums(processor, s)...)

	for idx := range s.nodes {
		node := s.nodes[idx]
		funcs = append(funcs, p.processNode(processor, s, node)...)
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
	// delete custom queries|mutations
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

func getFilePathForCustomInterfaceFile(cfg *codegen.Config, gqlType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", strcase.ToSnake(gqlType)))
}

func getFilePathForCustomInterfaceInputFile(cfg *codegen.Config, gqlType string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/input/%s_type.ts", strcase.ToSnake(gqlType)))
}

func getFilePathForEnum(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_type.ts", base.GetSnakeCaseName(name)))
}

func getFilePathForConnection(cfg *codegen.Config, packageName string, connectionName string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s/%s_type.ts", packageName, base.GetSnakeCaseName(connectionName)))
}

func getQueryFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/generated/resolvers/query_type.ts")
}

func getNodeQueryTypeFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/resolvers/node_query_type.ts")
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
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/%s/%s_type.ts", nodeData.PackageName, strcase.ToSnake(actionName)))
}

func getImportPathForActionFromPackage(packageName string, action action.Action) string {
	return fmt.Sprintf("src/graphql/generated/mutations/%s/%s_type", packageName, strcase.ToSnake(action.GetGraphQLName()))
}

func getFilePathForCustomMutation(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/mutations/%s_type.ts", strcase.ToSnake(name)))
}

func getImportPathForCustomMutation(name string) string {
	return fmt.Sprintf("src/graphql/generated/mutations/%s_type", strcase.ToSnake(name))
}

func getFilePathForCustomQuery(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/generated/resolvers/%s_query_type.ts", strcase.ToSnake(name)))
}

var searchFor = []string{
	"@gqlField",
	"@gqlArg",
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
			fmt.Print("\u001b[31mrg executable not found so can't search for custom files. local development error?\u001b[0m\n")
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

	// similar to writeTsFile in parse_ts.go
	// unfortunately that this is being done

	var cmdName string
	var cmdArgs []string
	var env []string

	scriptPath := util.GetPathToScript("scripts/custom_graphql.ts", fromTest)
	if fromTest {
		env = []string{
			fmt.Sprintf(
				"GRAPHQL_PATH=%s",
				filepath.Join(input.GetAbsoluteRootPathForTest(), "graphql"),
			),
		}
		cmdName = "ts-node"

		cmdArgs = []string{
			"--compiler-options",
			testingutils.DefaultCompilerOptions(),
		}
	} else {
		cmdArgs = cmd.GetArgsForScript(processor.Config.GetAbsPathToRoot())

		cmdName = "ts-node-script"
	}

	// append LOCAL_SCRIPT_PATH so we know
	if util.EnvIsTrue("LOCAL_SCRIPT_PATH") {
		env = append(env, "LOCAL_SCRIPT_PATH=true")
	}

	cmdArgs = append(cmdArgs,
		// TODO https://github.com/lolopinto/ent/issues/792
		//			"--swc",
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

	cmd := exec.Command(cmdName, cmdArgs...)
	cmd.Stdin = &buf
	cmd.Stdout = &out
	cmd.Stderr = os.Stderr
	if len(env) != 0 {
		env2 := append(os.Environ(), env...)
		cmd.Env = env2
	}

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
	// TODO remove this
	if len(cd.Args) > 0 {
		return errors.New("TOOD: need to process args. doesn't work at the moment")
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

	return nil
}

type gqlobjectData struct {
	NodeData     *schema.NodeData
	interfaces   []*interfaceType
	Node         string
	NodeInstance string
	GQLNodes     []*objectType
	Enums        []*gqlEnum
	FieldConfig  *fieldConfig
	initMap      bool
	m            map[string]bool
	Package      *codegen.ImportPackage
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

type gqlSchema struct {
	hasConnections  bool
	hasMutations    bool
	nodes           map[string]*gqlNode
	enums           map[string]*gqlEnum
	customQueries   []*gqlNode
	customMutations []*gqlNode
	customData      *CustomData
	edgeNames       map[string]bool
	customEdges     map[string]*objectType
	rootQueries     []*rootQuery
	allTypes        []typeInfo
	otherObjects    []*gqlNode
	// Query|Mutation|Subscription
	rootDatas []*gqlRootData
}

func (s *gqlSchema) getImportFor(typ string, mutation bool) *tsimport.ImportPath {
	// handle Date super special
	typ2, ok := knownCustomTypes[typ]
	if ok {
		customTyp, ok := s.customData.CustomTypes[typ2]
		if ok {
			return &tsimport.ImportPath{
				ImportPath: customTyp.ImportPath,
				Import:     customTyp.Type,
			}
		}

	}
	// known type e.g. boolean, string, etc
	knownType, ok := knownTypes[typ]
	if ok {
		return knownType
	}

	// custom nodes in the schema.
	// e.g. User object, Event
	_, ok = s.nodes[typ]
	if ok {
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
		return &tsimport.ImportPath{
			ImportPath: customTyp.ImportPath,
			Import:     customTyp.Type,
		}
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

func getGqlConnectionType(edge edge.ConnectionEdge) string {
	return fmt.Sprintf("%sType", edge.GetGraphQLConnectionName())
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
		ConnType:   getGqlConnectionType(edge),
		Edge:       edge,
		FilePath:   getFilePathForConnection(processor.Config, packageName, edge.GetGraphQLConnectionName()),
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
		var rootQueries []*rootQuery
		edgeNames := make(map[string]bool)
		var wg sync.WaitGroup
		var m sync.Mutex
		var otherNodes []*gqlNode
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
					Type:     fmt.Sprintf("%sType", enumType.Name),
					Enum:     enumType,
					FilePath: getFilePathForEnum(processor.Config, enumType.Name),
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

				obj := gqlNode{
					ObjData: &gqlobjectData{
						NodeData:     nodeData,
						Node:         nodeData.Node,
						NodeInstance: nodeData.NodeInstance,
						GQLNodes:     []*objectType{buildNodeForObject(processor, nodeMap, nodeData)},
						Package:      processor.Config.GetImportPackage(),
					},
					FilePath: getFilePathForNode(processor.Config, nodeData),
				}

				actionInfo := nodeData.ActionInfo
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
								Node:         nodeData.Node,
								NodeInstance: nodeData.NodeInstance,
								GQLNodes:     nodes,
								Enums:        buildActionEnums(nodeData, action),
								FieldConfig:  fieldCfg,
								Package:      processor.Config.GetImportPackage(),
							},
							FilePath: getFilePathForAction(processor.Config, nodeData, action.GetGraphQLName()),
							Data:     action,
						}
						obj.ActionDependents = append(obj.ActionDependents, &actionObj)
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
						objs = append(objs, buildCustomInterfaceNode(processor, ci2, &customInterfaceInfo{
							// only export root object
							exported: typ == ci,
							name:     ci2.GQLType,
							imports:  imports,
						}))
					}
				}

				obj := &gqlNode{
					ObjData: &gqlobjectData{
						Node:         ci.GQLType,
						NodeInstance: strcase.ToLowerCamel(ci.GQLType),
						GQLNodes:     objs,
						Package:      processor.Config.GetImportPackage(),
					},
					FilePath: getFilePathForCustomInterfaceFile(processor.Config, ci.GQLType),
				}

				// reset imports
				imports = []string{}

				inputType := ci.GQLType + "Input"
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

						inputObjs = append(inputObjs, buildCustomInterfaceNode(processor, ci2, &customInterfaceInfo{
							exported: typ == ci,
							name:     ci2.GQLType + "Input",
							input:    true,
							imports:  imports,
						}))
					}
				}

				inputObj := &gqlNode{
					ObjData: &gqlobjectData{
						Node:         inputType,
						NodeInstance: strcase.ToLowerCamel(inputType),
						GQLNodes:     inputObjs,
						Package:      processor.Config.GetImportPackage(),
					},
					FilePath: getFilePathForCustomInterfaceInputFile(processor.Config, inputType),
				}

				m.Lock()
				defer m.Unlock()
				otherNodes = append(otherNodes, obj, inputObj)

			}(key)
		}

		wg.Wait()
		schema := &gqlSchema{
			nodes:          nodes,
			rootQueries:    rootQueries,
			enums:          enums,
			edgeNames:      edgeNames,
			hasMutations:   hasMutations,
			hasConnections: hasConnections,
			customEdges:    make(map[string]*objectType),
			otherObjects:   otherNodes,
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

			for _, depEnum := range dep.ObjData.Enums {
				actionTypes = append(actionTypes, typeInfo{
					Type: depEnum.Type,
					// they're embedded in the action's file
					ImportPath: trimPath(cfg, dep.FilePath),
					NodeType:   "Enum",
					Obj:        depEnum,
					Exported:   true,
				})
			}
		}
	}
	for _, node := range s.nodes {
		processNode(node, "Node")
	}

	for _, node := range s.otherObjects {
		if otherObjectIsInput(node) {
			continue
		}
		processNode(node, "CustomObject")
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
	return len(node.ObjData.GQLNodes) >= 1 && node.ObjData.GQLNodes[0].GQLType == "GraphQLInputObjectType"
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
	var enums []string
	for _, enum := range s.enums {
		enums = append(enums, trimPath(cfg, enum.FilePath))
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
		}{
			conn,
			s.customEdges[conn.Edge.TsEdgeQueryEdgeName()],
			&connectionBaseObj{},
			processor.Config.GetImportPackage(),
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
	ResolveMethodArg string
	TypeImports      []*tsimport.ImportPath
	//	ArgImports       []string // incase it's { [argName: string]: any }, we need to know difference
	ArgImports       []*tsimport.ImportPath
	Args             []*fieldConfigArg
	FunctionContents []string
	ReturnTypeHint   string
	connection       *gqlConnection
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

func buildNodeForObject(processor *codegen.Processor, nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) *objectType {
	result := &objectType{
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

	instance := nodeData.NodeInstance

	fieldInfo := nodeData.FieldInfo
	var fields []*fieldType

	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		// if field was already hidden, don't create edge for it
		if !f.ExposeToGraphQL() {
			continue
		}

		// TODO this shouldn't be here but be somewhere else...
		if f != nil {
			if err := fieldInfo.InvalidateFieldForGraphQL(f); err != nil {
				// TODO move this validation up
				panic(err)
			}
		}
		if edge.IsList() {
			addPluralEdge(edge, &fields, instance)
		} else {
			addSingularEdge(edge, &fields, instance)
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
				gqlField.FunctionContents = []string{fmt.Sprintf("return %s.%s();", instance, field.TSPublicAPIName())}
			} else {
				gqlField.FunctionContents = []string{fmt.Sprintf("return %s.%s;", instance, field.TSPublicAPIName())}
			}
		}
		fields = append(fields, gqlField)
	}

	for _, edge := range nodeData.EdgeInfo.GetSingularEdges() {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		addSingularEdge(edge, &fields, instance)
	}

	for _, edge := range nodeData.EdgeInfo.GetConnectionEdges() {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		addConnection(nodeData, edge, &fields, instance, nil)
	}

	for _, group := range nodeData.EdgeInfo.AssocGroups {
		fields = append(fields, &fieldType{
			Name: group.GetStatusMethod(),
			FieldImports: getGQLFileImports(
				[]*tsimport.ImportPath{
					tsimport.NewLocalGraphQLEntImportPath(group.ConstType),
				},
				false,
			),
		})
	}

	result.Fields = fields
	return result
}

func addSingularEdge(edge edge.Edge, fields *[]*fieldType, instance string) {
	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       getGQLFileImports(edge.GetTSGraphQLTypeImports(), false),
		FunctionContents:   []string{fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName())},
	}
	*fields = append(*fields, gqlField)
}

func addPluralEdge(edge edge.Edge, fields *[]*fieldType, instance string) {
	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       getGQLFileImports(edge.GetTSGraphQLTypeImports(), false),
		FunctionContents:   []string{fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName())},
	}
	*fields = append(*fields, gqlField)
}

func getConnectionArgs() []*fieldConfigArg {
	return []*fieldConfigArg{
		{
			Name:    "first",
			Imports: []*tsimport.ImportPath{tsimport.NewGQLImportPath("GraphQLInt")},
		},
		{
			Name:    "after",
			Imports: []*tsimport.ImportPath{tsimport.NewGQLImportPath("GraphQLString")},
		},
		{
			Name:    "last",
			Imports: []*tsimport.ImportPath{tsimport.NewGQLImportPath("GraphQLInt")},
		},
		{
			Name:    "before",
			Imports: []*tsimport.ImportPath{tsimport.NewGQLImportPath("GraphQLString")},
		},
	}
}

func addConnection(nodeData *schema.NodeData, edge edge.ConnectionEdge, fields *[]*fieldType, instance string, customField *CustomField) {
	// import GraphQLEdgeConnection and EdgeQuery file
	extraImports := []*tsimport.ImportPath{
		{
			ImportPath: codepath.GraphQLPackage,
			Import:     "GraphQLEdgeConnection",
		},
	}

	var buildQuery string
	if customField == nil {
		// for custom fields, EntQuery is an implementation detail
		// and may or may not be exposed so we don't depend on it here
		extraImports = append(extraImports, &tsimport.ImportPath{
			ImportPath: codepath.GetExternalImportPath(),
			Import:     edge.TsEdgeQueryName(),
		})
		buildQuery = fmt.Sprintf("%s.query(v, %s)", edge.TsEdgeQueryName(), instance)
	} else {
		buildQuery = fmt.Sprintf("%s.%s()", instance, customField.FunctionName)
	}

	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       getGQLFileImports(edge.GetTSGraphQLTypeImports(), false),
		ExtraImports:       extraImports,
		Args:               getConnectionArgs(),
		// TODO typing for args later?
		FunctionContents: []string{
			fmt.Sprintf(
				"return new GraphQLEdgeConnection(%s.viewer, %s, (v, %s: %s) => %s, args);",
				instance,
				instance,
				instance,
				nodeData.Node,
				buildQuery,
			),
		},
	}
	*fields = append(*fields, gqlField)
}

func buildActionNodes(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) ([]*objectType, error) {
	var ret []*objectType
	for _, c := range a.GetCustomInterfaces() {
		_, ok := c.Action.(action.Action)
		if !ok {
			ret = append(ret, buildCustomInputNode(c))
		}
	}
	input, err := buildActionInputNode(processor, nodeData, a)
	if err != nil {
		return nil, err
	}

	ret = append(ret,
		input,
		buildActionPayloadNode(processor, nodeData, a),
	)
	return ret, nil
}

func buildActionEnums(nodeData *schema.NodeData, action action.Action) []*gqlEnum {
	var ret []*gqlEnum
	for _, enumType := range action.GetGQLEnums() {
		ret = append(ret, &gqlEnum{
			Type: fmt.Sprintf("%sType", enumType.Name),
			Enum: enumType,
		})
	}
	return ret
}

func buildCustomInputNode(c *customtype.CustomInterface) *objectType {
	result := &objectType{
		Type:     c.GQLType,
		Node:     c.GQLType,
		TSType:   c.GQLType,
		GQLType:  "GraphQLInputObjectType",
		Exported: true,
	}

	for _, f := range c.Fields {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetTSMutationGraphQLTypeForFieldImports(false, true), true),
		})
	}

	for _, f := range c.NonEntFields {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetGraphQLFieldType().GetTSGraphQLImports(true), true),
		})
	}
	return result
}

func buildActionInputNode(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) (*objectType, error) {
	// TODO shared input types across create/edit for example
	node := a.GetGraphQLInputName()

	result := &objectType{
		Type:     fmt.Sprintf("%sType", node),
		Node:     node,
		TSType:   node,
		Exported: true,
		GQLType:  "GraphQLInputObjectType",
	}

	// maybe not the best place for this probably but it makes sense
	// as dependencies...
	for _, c := range a.GetCustomInterfaces() {
		if c.Action != nil {
			action := c.Action.(action.Action)
			result.Imports = append(result.Imports, &tsimport.ImportPath{
				Import:     c.GQLType,
				ImportPath: getImportPathForActionFromPackage(action.GetNodeInfo().PackageName, action),
			})
		}
	}

	// add id field for edit and delete mutations
	if a.MutatingExistingObject() {
		id, err := getIDField(processor, nodeData)
		if err != nil {
			return nil, err
		}
		result.Fields = append(result.Fields, &fieldType{
			Name: id,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLID"),
			},
			Description: fmt.Sprintf("id of %s", nodeData.Node),
		})
	}

	for _, f := range a.GetGraphQLFields() {
		result.Fields = append(result.Fields, &fieldType{
			Name: f.GetGraphQLName(),
			// here...
			FieldImports: getGQLFileImports(f.GetTSMutationGraphQLTypeForFieldImports(!action.IsRequiredField(a, f), true), true),
		})
	}

	// add custom fields to the input
	for _, f := range a.GetNonEntFields() {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetGraphQLFieldType().GetTSGraphQLImports(true), true),
		})
	}

	// add each edge that's part of the mutation as an ID
	// use singular version so that this is friendID instead of friendsID
	for _, edge := range a.GetEdges() {
		result.Fields = append(result.Fields, &fieldType{
			Name: getEdgeField(processor, edge),
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLID"),
			},
		})
	}

	if hasCustomInput(a, processor) {
		// custom interface for editing

		var omittedFields []string
		// add adminID to interface assuming it's not already there
		intType := &interfaceType{
			Exported: false,
			Name:     fmt.Sprintf("custom%s", node),
		}

		// only want the id field for the object when editing said object
		if a.MutatingExistingObject() {
			id, err := getIDField(processor, nodeData)
			if err != nil {
				return nil, err
			}
			intType.Fields = append(intType.Fields, &interfaceField{
				Name: id,
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			})
		}

		// add edges as part of the input
		// usually only one edge e.g. addFriend or addAdmin etc
		for _, edge := range a.GetEdges() {
			intType.Fields = append(intType.Fields, &interfaceField{
				Name: getEdgeField(processor, edge),
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			})
		}

		// these conditions duplicated in hasCustomInput
		processField := func(f action.ActionField) {
			fieldName := f.TSPublicAPIName()
			if f.IsEditableIDField() {
				// should probably also do this for id lists but not pressing
				// ID[] -> string[]
				intType.Fields = append(intType.Fields, &interfaceField{
					Name:     f.GetGraphQLName(),
					Optional: !action.IsRequiredField(a, f),
					// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
					Type: "string",
				})
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
				intType.Fields = append(intType.Fields, &interfaceField{
					Name:     f.GetGraphQLName(),
					Optional: !action.IsRequiredField(a, f),
					// TODO we want the same types without the Builder part if it's an id field...
					Type:       f.TsBuilderType(processor.Config),
					UseImports: useImports,
				})
			}
		}
		for _, f := range a.GetGraphQLFields() {
			processField(f)
		}

		for _, f := range a.GetNonEntFields() {
			processField(f)
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

func getPayloadNameFromAction(a action.Action) string {
	input := a.GetGraphQLInputName()
	return strings.TrimSuffix(input, "Input") + "Payload"
}

func buildActionPayloadNode(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) *objectType {
	payload := getPayloadNameFromAction(a)
	result := &objectType{
		Type:     fmt.Sprintf("%sType", payload),
		Node:     payload,
		TSType:   payload,
		Exported: true,
		GQLType:  "GraphQLObjectType",
		DefaultImports: []*tsimport.ImportPath{
			{
				ImportPath: getActionPath(nodeData, a),
				Import:     a.GetActionName(),
			},
		},
		Imports: []*tsimport.ImportPath{
			{
				ImportPath: codepath.GetExternalImportPath(),
				Import:     nodeData.Node,
			},
			{
				ImportPath: codepath.GetImportPathForExternalGQLFile(),
				Import:     fmt.Sprintf("%sType", nodeData.Node),
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Import:     "mustDecodeIDFromGQLID",
			},
		},
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
		result.Fields = append(result.Fields, &fieldType{
			Name: nodeInfo.NodeInstance,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				{
					Import:     fmt.Sprintf("%sType", nodeInfo.Node),
					ImportPath: codepath.GetImportPathForExternalGQLFile(),
				},
			},
		})

		result.TSInterfaces = []*interfaceType{
			{
				Exported: false,
				Name:     payload,
				Fields: []*interfaceField{
					{
						Name:      nodeData.NodeInstance,
						Type:      nodeData.Node,
						UseImport: true,
					},
				},
			},
		}
	} else {
		deleted := getDeletedField(processor, nodeInfo.Node)
		result.Fields = append(result.Fields, &fieldType{
			Name: deleted,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLImportPath("GraphQLID"),
			},
		})

		result.TSInterfaces = []*interfaceType{
			{
				Exported: false,
				Name:     payload,
				Fields: []*interfaceField{
					{
						Name: deleted,
						Type: "string",
					},
				},
			},
		}
	}

	return result
}

func hasCustomInput(a action.Action, processor *codegen.Processor) bool {
	if a.MutatingExistingObject() {
		return true
	}

	processField := func(f action.ActionField) bool {
		// these conditions duplicated in hasInput in buildActionInputNode
		// editable id field. needs custom input because we don't want to type as ID or Builder when we call base64encodeIDs
		// mustDecodeIDFromGQLID
		if f.IsEditableIDField() && processor.Config.Base64EncodeIDs() {
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

	for _, f := range a.GetNonEntFields() {
		if processField(f) {
			return true
		}
	}
	return false
}

func getActionPath(nodeData *schema.NodeData, a action.Action) string {
	return fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, strcase.ToSnake(a.GetActionName()))
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
			for _, v := range fi.Fields {
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

func buildActionFieldConfig(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action) (*fieldConfig, error) {
	// TODO this is so not obvious at all
	// these are things that are automatically useImported....
	argImports := []*tsimport.ImportPath{
		{
			Import:     a.GetActionName(),
			ImportPath: getActionPath(nodeData, a),
		},
	}
	input := a.GetGraphQLInputName()
	payload := getPayloadNameFromAction(a)
	var argName string
	if hasCustomInput(a, processor) {
		argName = fmt.Sprintf("custom%s", input)
	} else {
		argName = a.GetActionInputName()
		argImports = append(argImports, &tsimport.ImportPath{
			Import:     argName,
			ImportPath: getActionPath(nodeData, a),
		})
	}
	prefix := strcase.ToCamel(a.GetGraphQLName())
	result := &fieldConfig{
		Exported:         true,
		Name:             fmt.Sprintf("%sType", prefix),
		Arg:              fmt.Sprintf("{ [input: string]: %s}", argName),
		ResolveMethodArg: "{ input }",
		TypeImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			{
				// local so it's fine
				Import: fmt.Sprintf("%sType", payload),
			},
		},
		Args: []*fieldConfigArg{
			{
				Name: "input",
				Imports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					{
						// local
						Import: fmt.Sprintf("%sType", input),
					},
				},
			},
		},
		ReturnTypeHint: fmt.Sprintf("Promise<%s>", payload),
	}

	base64EncodeIDs := processor.Config.Base64EncodeIDs()

	addField := func(f action.ActionField) {
		typ := f.GetFieldType()
		// get nullable version
		if !action.IsRequiredField(a, f) {
			nullable, ok := typ.(enttype.NullableType)
			if ok {
				typ = nullable.GetNullableType()
			}
		}

		inputField := fmt.Sprintf("input.%s", f.GetGraphQLName())

		customRenderer, ok := typ.(enttype.CustomGQLRenderer)
		if ok {
			inputField = customRenderer.CustomGQLRender(processor.Config, inputField)
			argImports = append(argImports, getGQLFileImports(customRenderer.ArgImports(processor.Config), true)...)
		}
		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf(
				"%s: %s,",
				f.TSPublicAPIName(),
				inputField,
			))
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

		for _, f := range a.GetNonEntFields() {
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
					fmt.Sprintf("await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%s), {", a.GetActionName(), idField),
				)
			} else {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("await %s.saveXFromID(context.getViewer(), input.%s, {", a.GetActionName(), idField),
				)
			}
			for _, f := range a.GetGraphQLFields() {
				addField(f)
			}
			for _, f := range a.GetNonEntFields() {
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
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%s), mustDecodeIDFromGQLID(input.%s));", nodeData.NodeInstance, a.GetActionName(), idField, edgeField),
				)
			} else {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), input.%s, input.%s);", nodeData.NodeInstance, a.GetActionName(), idField, edgeField),
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
					fmt.Sprintf("await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%s));", a.GetActionName(), idField),
				)
			} else {
				// no fields
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("await %s.saveXFromID(context.getViewer(), input.%s);", a.GetActionName(), idField),
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
				fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
			)
		}
	}

	// TODO these are just all imports, we don't care where from
	result.ArgImports = argImports

	return result, nil
}

func getDeletedField(processor *codegen.Processor, node string) string {
	return codegenapi.GraphQLName(processor.Config, fmt.Sprintf("deleted%sID", node))
}

func getIDField(processor *codegen.Processor, nodeData *schema.NodeData) (string, error) {
	pkey := nodeData.FieldInfo.SingleFieldPrimaryKey()
	if pkey == "" {
		return "", fmt.Errorf("no single field primary key for %s", nodeData.Node)
	}
	return codegenapi.GraphQLName(processor.Config, pkey), nil
}

func getEdgeField(processor *codegen.Processor, edge *edge.AssociationEdge) string {
	field := fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular()))
	return codegenapi.GraphQLName(processor.Config, field)
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
func buildCustomInterfaceNode(processor *codegen.Processor, ci *customtype.CustomInterface, ciInfo *customInterfaceInfo) *objectType {
	node := ciInfo.name
	gqlType := "GraphQLObjectType"
	if ciInfo.input {
		gqlType = "GraphQLInputObjectType"
	}

	result := &objectType{
		Type:     fmt.Sprintf("%sType", node),
		Node:     node,
		TSType:   node,
		Exported: ciInfo.exported,
		GQLType:  gqlType,
	}
	// top level
	if ciInfo.exported {
		result.Imports = []*tsimport.ImportPath{
			{
				ImportPath: codepath.GetExternalImportPath(),
				Import:     ci.TSType,
			},
		}
	}
	for _, imp := range ciInfo.imports {
		result.Imports = append(result.Imports, &tsimport.ImportPath{
			ImportPath: codepath.GetExternalImportPath(),
			Import:     imp,
		})
	}

	for _, f := range ci.Fields {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetTSGraphQLTypeForFieldImports(ciInfo.input), ciInfo.input),
		})
	}

	for _, f := range ci.NonEntFields {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetGraphQLFieldType().GetTSGraphQLImports(true), ciInfo.input),
		})
	}

	return result
}

func buildCustomUnionNode(processor *codegen.Processor, cu *customtype.CustomUnion) *objectType {
	result := &objectType{
		Type:    fmt.Sprintf("%sType", cu.GQLType),
		Node:    cu.GQLType,
		TSType:  cu.TSType,
		GQLType: "GraphQLUnionType",
	}

	unionTypes := make([]string, len(cu.Interfaces))
	for i, ci := range cu.Interfaces {
		unionTypes[i] = fmt.Sprintf("%sType", ci.GQLType)
	}
	result.UnionTypes = unionTypes

	return result
}

func buildCustomUnionInputNode(processor *codegen.Processor, cu *customtype.CustomUnion) (*objectType, error) {
	result := &objectType{
		Type:    fmt.Sprintf("%sInputType", cu.GQLType),
		Node:    cu.GQLType + "Input",
		TSType:  cu.TSType,
		GQLType: "GraphQLInputObjectType",
	}

	for _, ci := range cu.Interfaces {
		if ci.GraphQLFieldName == "" {
			return nil, fmt.Errorf("invalid field name for interface %s", ci.GQLType)
		}
		result.Fields = append(result.Fields, &fieldType{
			Name: ci.GraphQLFieldName,
			FieldImports: []*tsimport.ImportPath{
				{
					Import: ci.GQLType + "InputType",
				},
			},
		})
	}

	return result, nil
}

type objectType struct {
	Type     string // GQLType we're creating
	Node     string // GraphQL Node AND also ent node. Need to decouple this...
	TSType   string
	Fields   []*fieldType
	Exported bool
	GQLType  string // GraphQLObjectType or GraphQLInputObjectType

	DefaultImports []*tsimport.ImportPath
	Imports        []*tsimport.ImportPath
	TSInterfaces   []*interfaceType

	// make this a string for now since we're only doing built-in interfaces
	GQLInterfaces  []string
	IsTypeOfMethod []string

	UnionTypes []string
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
		input:      obj.GQLType == "GraphQLInputObjectType",
		union:      obj.GQLType == "GraphQLUnionType",
		name:       obj.Node,
		interfaces: interfaces,
		fields:     obj.Fields,
		unionTypes: unions,
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
	// interfaces to extend
	Extends []string

	//	list of omitted fields
	// interface ends up being
	// interface customFooInput extends Omit<FooInput, 'f1' | 'f2'> { ... fields}
	Omitted []string
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
			Type:       fmt.Sprintf("%sQueryType", strcase.ToCamel(query.GraphQLName)),
		})

		fieldTypes = append(fieldTypes, &fieldType{
			Name:         query.GraphQLName,
			Args:         node.ObjData.FieldConfig.Args,
			FieldImports: node.ObjData.FieldConfig.TypeImports,
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
				Type:       fmt.Sprintf("%sType", strcase.ToCamel(gqlName)),
				Name:       gqlName,
			})

			fieldTypes = append(fieldTypes, &fieldType{
				Name:         gqlName,
				Args:         dep.ObjData.FieldConfig.Args,
				FieldImports: dep.ObjData.FieldConfig.TypeImports,
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
			Type:       fmt.Sprintf("%sType", strcase.ToCamel(mutation.GraphQLName)),
		})

		fieldTypes = append(fieldTypes, &fieldType{
			Name:         mutation.GraphQLName,
			Args:         node.ObjData.FieldConfig.Args,
			FieldImports: node.ObjData.FieldConfig.TypeImports,
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
			{
				Name: fmt.Sprintf("%sQueryArgs", nodeData.Node),
				Fields: []*interfaceField{
					{
						Name: "id",
						Type: "string",
					},
				},
			},
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
				ImportPath: "src/ent/",
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
	filePath := getTSSchemaFilePath(processor.Config)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: struct {
			HasMutations bool
			QueryPath    string
			MutationPath string
			AllTypes     []typeInfo
		}{
			s.hasMutations,
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
