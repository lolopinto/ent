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
	"strings"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
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

type CustomObject struct {
	// TODOO
	NodeName  string `json:"nodeName"`
	ClassName string `json:"className"`
}

// CustomFieldType for a TypeScript class
type CustomFieldType string

// these values map to CustomFieldType enum in JS
const Accessor CustomFieldType = "ACCESSOR"
const Field CustomFieldType = "FIELD"
const Function CustomFieldType = "FUNCTION"
const AsyncFunction CustomFieldType = "ASYNC_FUNCTION"

type CustomField struct {
	Node         string          `json:"nodeName"`
	GraphQLName  string          `json:"gqlName"`
	FunctionName string          `json:"functionName"`
	Args         []CustomItem    `json:"args"`
	Results      []CustomItem    `json:"results"`
	FieldType    CustomFieldType `json:"fieldType"`
}

func (cf CustomField) getArg() string {
	if cf.hasCustomArgs() {
		// interface has been generated for it
		return cf.GraphQLName + "Args"
	}
	return "{}"
}

func (cf CustomField) hasCustomArgs() bool {
	for _, arg := range cf.Args {
		if !arg.IsContextArg {
			return true
		}
	}
	return false
}

func (cf CustomField) getResolveMethodArg() string {
	if cf.hasCustomArgs() {
		return "args"
	}
	return "{}"
}

// custom marshall...
// type CustomField struct {
// 	customField
// }

// func (f *CustomField) UnmarshalJSON(data []byte) error {
// 	var cf *customField

// 	err := json.Unmarshal(data, &cf)
// 	if err != nil {
// 		return err
// 	}

// 	f.customField = *cf
// 	if isConnection(*f) {
// 		connArgs := getConnectionArgs()
// 		f.Args = append(f.Args, connArgs...)
// 	}
// }

type CustomClassInfo struct {
	Name          string `json:"name"`
	Exported      bool   `json:"exported"`
	DefaultExport bool   `json:"defaultExport"`
	Path          string `json:"path"`
}

type customData struct {
	Args    map[string]*CustomObject `json:"args"`
	Inputs  map[string]*CustomObject `json:"inputs"`
	Objects map[string]*CustomObject `json:"objects"`
	// map of class to fields in that class
	Fields      map[string][]CustomField    `json:"fields"`
	Queries     []CustomField               `json:"queries"`
	Mutations   []CustomField               `json:"mutations"`
	Classes     map[string]*CustomClassInfo `json:"classes"`
	Files       map[string]*CustomFile      `json:"files"`
	CustomTypes map[string]*CustomType      `json:"customTypes"`
	Error       error
}

type CustomItem struct {
	Name         string       `json:"name"`
	Type         string       `json:"type"`
	Nullable     NullableItem `json:"nullable"`
	List         bool         `json:"list"`
	Connection   bool         `json:"connection"`
	IsContextArg bool         `json:"isContextArg"`
	TSType       string       `json:"tsType"`
	imports      []*fileImport
}

type CustomType struct {
	Type       string `json:"type"`
	ImportPath string `json:"importPath"`

	// both of these are optional
	TSType       string `json:"tsType"`
	TSImportPath string `json:"tsImportPath"`
}

func (item *CustomItem) addImportImpl(imps ...string) {
	for _, imp := range imps {
		// TODO this doesn't work for the new custom types?
		item.imports = append(item.imports, &fileImport{
			ImportPath: "graphql",
			Type:       imp,
		})
	}
}

func (item *CustomItem) initialize() error {
	switch item.Nullable {
	case NullableTrue:
		if item.List {
			item.addImportImpl("GraphQLList", "GraphQLNonNull")
		}

	case NullableContents:
		if !item.List {
			return fmt.Errorf("list required to use this option")
		}
		item.addImportImpl("GraphQLNonNull", "GraphQLList")

	case NullableContentsAndList:
		if !item.List {
			return fmt.Errorf("list required to use this option")
		}
		item.addImportImpl("GraphQLList")

	default:
		if item.List {
			item.addImportImpl("GraphQLNonNull", "GraphQLList", "GraphQLNonNull")
		} else {
			item.addImportImpl("GraphQLNonNull")
		}
	}

	return nil
}

func (item *CustomItem) addImport(imp *fileImport) {
	item.imports = append(item.imports, imp)
}

func getNativeGQLImportFor(typ string) *fileImport {
	return &fileImport{
		Type:       typ,
		ImportPath: "graphql",
	}
}

func getEntGQLImportFor(typ string) *fileImport {
	return &fileImport{
		Type:       typ,
		ImportPath: codepath.GraphQLPackage,
	}
}

var knownTypes = map[string]*fileImport{
	"String":     getNativeGQLImportFor("GraphQLString"),
	"Date":       getEntGQLImportFor("Time"),
	"Int":        getNativeGQLImportFor("GraphQLInt"),
	"Float":      getNativeGQLImportFor("GraphQLFloat"),
	"Boolean":    getNativeGQLImportFor("GraphQLBoolean"),
	"ID":         getNativeGQLImportFor("GraphQLID"),
	"Node":       getEntGQLImportFor("GraphQLNodeInterface"),
	"Edge":       getEntGQLImportFor("GraphQLEdgeInterface"),
	"Connection": getEntGQLImportFor("GraphQLConnectionInterface"),
}

func (item *CustomItem) getImports(s *gqlSchema, cd *customData) ([]*fileImport, error) {
	if err := item.initialize(); err != nil {
		return nil, err
	}

	// TODO need to know if mutation or query...
	imp := s.getImportFor(item.Type, false)
	if imp != nil {
		item.addImport(imp)
	} else {
		_, ok := s.customData.Objects[item.Type]
		if !ok {
			return nil, fmt.Errorf("found a type %s which was not part of the schema", item.Type)
		}
		item.addImport(
			&fileImport{
				Type: fmt.Sprintf("%sType", item.Type),
				// TODO same here. need to know if mutation or query
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
			})
		//				s.nodes[resultre]
		// now we need to figure out where this is from e.g.
		// result.Type a native thing e.g. User so getUserType
		// TODO need to add it to DefaultImport for the entire file...
		// e.g. getImportPathForNode
		// or in cd.Classes and figure that out for what the path should be...
		//				imports = append(imports, fmt.Sprintf("%sType", result.Type))
		//				spew.Dump(result.Type + " needs to be added to import for file...")
	}

	return item.imports, nil
}

type CustomFile struct {
	Imports map[string]*CustomImportInfo `json:"imports"`
}

type CustomImportInfo struct {
	Path          string `json:"path"`
	DefaultImport bool   `json:"defaultImport"`
}

type NullableItem string

const NullableContents NullableItem = "contents"
const NullableContentsAndList NullableItem = "contentsAndList"
const NullableTrue NullableItem = "true"

type writeFileFn func() error
type writeFileFnList []writeFileFn

func buildSchema(processor *codegen.Processor, fromTest bool) (*gqlSchema, error) {
	cd, s := <-parseCustomData(processor, fromTest), <-buildGQLSchema(processor)
	if cd.Error != nil {
		return nil, cd.Error
	}
	// put this here after the fact
	s.customData = cd

	if err := processCustomData(processor, s); err != nil {
		return nil, err
	}

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
	return generateSchemaFile(processor, p.s.hasMutations)
}

func (p *TSStep) writeBaseFiles(processor *codegen.Processor, s *gqlSchema) error {
	var funcs writeFileFnList
	buildNode := func(node *gqlNode) {
		funcs = append(funcs, func() error {
			return writeFile(processor, node)
		})

		for idx := range node.Dependents {
			dependentNode := node.Dependents[idx]
			funcs = append(funcs, func() error {
				return writeFile(processor, dependentNode)
			})
		}

		for idx := range node.connections {
			conn := node.connections[idx]
			funcs = append(funcs, func() error {
				return writeConnectionFile(processor, s, conn)
			})
		}
	}

	for idx := range s.enums {
		enum := s.enums[idx]
		funcs = append(funcs, func() error {
			return writeEnumFile(processor, enum)
		})
	}

	for _, node := range s.nodes {
		buildNode(node)
	}

	for _, node := range s.customMutations {
		buildNode(node)
	}

	for _, node := range s.customQueries {
		buildNode(node)
	}

	for idx := range s.rootQueries {
		rootQuery := s.rootQueries[idx]
		funcs = append(funcs, func() error {
			return writeRootQueryFile(processor, rootQuery)
		})
	}

	// other files
	funcs = append(
		funcs,
		func() error {
			// query_type.ts
			return writeQueryFile(processor, s)
		},
		func() error {
			// mutation_type.ts
			if s.hasMutations {
				return writeMutationFile(processor, s)
			}
			return nil
		},
		func() error {
			// graphql/resolvers/internal
			return writeInternalGQLResolversFile(s, processor)
		},
		// graphql/resolvers/index
		func() error {
			return writeGQLResolversIndexFile(processor)
		},
		func() error {
			// graphql/schema.ts
			return writeTSSchemaFile(processor, s)
		},
		func() error {
			// graphql/index.ts
			return writeTSIndexFile(processor, s)
		},
	)

	var wg sync.WaitGroup
	var serr syncerr.Error

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

var _ codegen.Step = &TSStep{}

func getFilePathForNode(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", nodeData.PackageName))
}

func getFilePathForEnum(cfg *codegen.Config, e *enum.GQLEnum) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", base.GetSnakeCaseName(e.Name)))
}

func getFilePathForConnection(cfg *codegen.Config, packageName string, connectionName string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/resolvers/generated/%s/%s_type.ts", packageName, base.GetSnakeCaseName(connectionName)))
}

func getQueryFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/resolvers/generated/query_type.ts")
}

func getNodeQueryTypeFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/resolvers/node_query_type.ts")
}

func getRootQueryFilePath(cfg *codegen.Config, nodeData *schema.NodeData) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/resolvers/generated/%s_query_type.ts", nodeData.PackageName))
}

func getMutationFilePath(cfg *codegen.Config) string {
	return path.Join(cfg.GetAbsPathToRoot(), "src/graphql/mutations/generated/mutation_type.ts")
}

func getQueryImportPath() string {
	return "src/graphql/resolvers/generated/query_type"
}

func getMutationImportPath() string {
	return "src/graphql/mutations/generated/mutation_type"
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

func getFilePathForAction(cfg *codegen.Config, nodeData *schema.NodeData, action action.Action) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/mutations/generated/%s/%s_type.ts", nodeData.PackageName, strcase.ToSnake(action.GetGraphQLName())))
}

func getImportPathForAction(nodeData *schema.NodeData, action action.Action) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s/%s_type", nodeData.PackageName, strcase.ToSnake(action.GetGraphQLName()))
}

func getImportPathForActionFromPackage(packageName string, action action.Action) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s/%s_type", packageName, strcase.ToSnake(action.GetGraphQLName()))
}

func getFilePathForCustomMutation(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/mutations/generated/%s_type.ts", strcase.ToSnake(name)))
}

func getImportPathForCustomMutation(name string) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s_type", strcase.ToSnake(name))
}

func getFilePathForCustomQuery(cfg *codegen.Config, name string) string {
	return path.Join(cfg.GetAbsPathToRoot(), fmt.Sprintf("src/graphql/resolvers/generated/%s_query_type.ts", strcase.ToSnake(name)))
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
	var wg sync.WaitGroup
	var serr syncerr.Error
	wg.Add(len(searchFor))
	files := make([][]string, len(searchFor))

	rootPath := processor.Config.GetAbsPathToRoot()
	for i := range searchFor {
		go func(i int) {
			defer wg.Done()

			var buf bytes.Buffer
			cmd := exec.Command("rg", "-tts", "-l", searchFor[i])
			// run in root dir
			cmd.Dir = rootPath
			cmd.Stdout = &buf
			if err := cmd.Run(); err != nil {
				serr.Append(err)
			}
			files[i] = strings.Split(strings.TrimSpace(buf.String()), "\n")
		}(i)
	}
	wg.Wait()

	result := []string{}

	// we want to load all of ent first to make sure that any requires we do resolve correctly
	// we don't need to load graphql by default since we use ent -> graphql objects
	// any custom objects that are referenced should be in the load path
	indexFile := path.Join(rootPath, "src/ent/index.ts")
	stat, _ := os.Stat(indexFile)
	//	spew.Dump(stat, err)
	if stat != nil {
		result = append(result, "src/ent/index.ts")
	}

	seen := make(map[string]bool)
	entPaths := make(map[string]bool)

	for _, info := range processor.Schema.Nodes {
		nodeData := info.NodeData
		entPath := getImportPathForModelFile(nodeData)
		entPaths[entPath] = true
	}

	fileAdded := false
	for _, list := range files {
		for _, file := range list {
			// ignore entPaths since we're doing src/ent/index.ts to get all of ent
			if file == "" || seen[file] || entPaths[file] {
				continue
			}
			seen[file] = true
			fileAdded = true
			result = append(result, file)
		}
	}

	// no files, nothing to do here
	if !fileAdded {
		return []string{}
	}

	return result
}

func parseCustomData(processor *codegen.Processor, fromTest bool) chan *customData {
	var res = make(chan *customData)
	go func() {
		var cd customData
		if processor.DisableCustomGraphQL() {
			res <- &cd
			return
		}

		customFiles := searchForFiles(processor)
		// no custom files, nothing to do here. we're done
		if len(customFiles) == 0 {
			if processor.Config.DebugMode() {
				fmt.Println("no custom graphql files")
			}
			res <- &cd
			return
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
				scriptPath,
				"--path",
				filepath.Join(processor.Config.GetAbsPathToRoot(), "src"),
				"--files",
				strings.Join(customFiles, ","),
			}
		} else {
			cmdArgs = append(
				cmd.GetArgsForScript(processor.Config.GetAbsPathToRoot()),
				scriptPath,
				"--path",
				// TODO this should be a configuration option to indicate where the code root is
				filepath.Join(processor.Config.GetAbsPathToRoot(), "src"),
				"--files",
				strings.Join(customFiles, ","),
			)

			cmdName = "ts-node-script"
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
			cd.Error = err
			res <- &cd
			return
		}

		if err := json.Unmarshal(out.Bytes(), &cd); err != nil {
			spew.Dump((out.Bytes()))
			err = errors.Wrap(err, "error unmarshalling custom processor")
			cd.Error = err
		}
		res <- &cd
	}()
	return res
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

func (obj *gqlobjectData) DefaultImports() []*fileImport {
	var result []*fileImport
	for _, node := range obj.GQLNodes {
		result = append(result, node.DefaultImports...)
	}
	return result
}

func (obj *gqlobjectData) Imports() []*fileImport {
	var result []*fileImport
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
					obj.m[imp.Type] = true
				}
			}

			for _, imp := range fcfg.TypeImports {
				// local...
				if imp.ImportPath == "" {
					obj.m[imp.Type] = true
				}
			}
		}
		obj.initMap = true
	}
	return !obj.m[name]
}

type gqlSchema struct {
	hasMutations    bool
	nodes           map[string]*gqlNode
	enums           map[string]*gqlEnum
	customQueries   []*gqlNode
	customMutations []*gqlNode
	customData      *customData
	edgeNames       map[string]bool
	customEdges     map[string]*objectType
	rootQueries     []*rootQuery
}

func (s *gqlSchema) getImportFor(typ string, mutation bool) *fileImport {
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
			return &fileImport{
				Type: fmt.Sprintf("%sType", typ),
				// it's an existing node, make sure to reference it
				ImportPath: codepath.GetImportPathForExternalGQLFile(),
			}
		}
		return &fileImport{
			Type: fmt.Sprintf("%sType", typ),
			// it's an existing node, make sure to reference it
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
		}
	}

	// Custom type added
	customTyp, ok := s.customData.CustomTypes[typ]
	if ok {
		return &fileImport{
			ImportPath: customTyp.ImportPath,
			Type:       customTyp.Type,
		}
	}

	// don't know needs to be handled at each endpoint

	return nil
}

type rootQuery struct {
	Name        string
	FieldConfig *fieldConfig
	FilePath    string
	Interfaces  []*interfaceType
	WriteOnce   bool
	Imports     []*fileImport
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
	FilePath    string
	Dependents  []*gqlNode // actions are the dependents
	Field       *CustomField
	connections []*gqlConnection
}

type gqlEnum struct {
	Enum *enum.GQLEnum
	Type string // the generated Type
	// Enum Name is the graphql Name
	FilePath string
}

type gqlConnection struct {
	ConnType string
	FilePath string
	Edge     edge.ConnectionEdge
	Imports  []*fileImport
	NodeType string
	Package  *codegen.ImportPackage
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
		ConnType: fmt.Sprintf("%sType", edge.GetGraphQLConnectionName()),
		Edge:     edge,
		FilePath: getFilePathForConnection(processor.Config, packageName, edge.GetGraphQLConnectionName()),
		NodeType: nodeType,
		Imports: []*fileImport{
			{
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
				Type:       nodeType,
			},
			{
				ImportPath: edgeImpPath,
				Type:       edge.TsEdgeQueryEdgeName(),
			},
		},
		Package: processor.Config.GetImportPackage(),
	}
}

func buildGQLSchema(processor *codegen.Processor) chan *gqlSchema {
	var result = make(chan *gqlSchema)
	go func() {
		var hasMutations bool
		nodes := make(map[string]*gqlNode)
		enums := make(map[string]*gqlEnum)
		var rootQueries []*rootQuery
		edgeNames := make(map[string]bool)
		var wg sync.WaitGroup
		var m sync.Mutex
		wg.Add(len(processor.Schema.Nodes))
		wg.Add(len(processor.Schema.Enums))

		if processor.Config.GenerateNodeQuery() {
			rootQueries = []*rootQuery{
				buildNodeRootQuery(processor),
			}
		}

		for key := range processor.Schema.Enums {
			go func(key string) {
				defer wg.Done()

				enumType := processor.Schema.Enums[key].GQLEnum

				m.Lock()
				defer m.Unlock()
				// needs a quoted name
				// Type has GQLType
				enums[enumType.Name] = &gqlEnum{
					Type:     fmt.Sprintf("%sType", enumType.Name),
					Enum:     enumType,
					FilePath: getFilePathForEnum(processor.Config, enumType),
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
						actionPrefix := strcase.ToCamel(action.GetGraphQLName())

						fieldCfg, err := buildActionFieldConfig(processor, nodeData, action, actionPrefix)
						if err != nil {
							// TODO
							panic(err)
						}
						actionObj := gqlNode{
							ObjData: &gqlobjectData{
								Node:         nodeData.Node,
								NodeInstance: nodeData.NodeInstance,
								GQLNodes:     buildActionNodes(nodeData, action, actionPrefix),
								Enums:        buildActionEnums(nodeData, action),
								FieldConfig:  fieldCfg,
								Package:      processor.Config.GetImportPackage(),
							},
							FilePath: getFilePathForAction(processor.Config, nodeData, action),
						}
						obj.Dependents = append(obj.Dependents, &actionObj)
					}
				}

				edgeInfo := nodeData.EdgeInfo
				if edgeInfo != nil {
					for _, edge := range edgeInfo.GetConnectionEdges() {
						if nodeMap.HideFromGraphQL(edge) {
							continue
						}
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

		wg.Wait()
		result <- &gqlSchema{
			nodes:        nodes,
			rootQueries:  rootQueries,
			enums:        enums,
			edgeNames:    edgeNames,
			hasMutations: hasMutations,
			customEdges:  make(map[string]*objectType),
		}
	}()
	return result
}

// write graphql file
func writeFile(processor *codegen.Processor, node *gqlNode) error {
	imps := tsimport.NewImports(processor.Config, node.FilePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config:            processor.Config,
		Data:              node.ObjData,
		CreateDirIfNeeded: true,
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
		CreateDirIfNeeded: true,
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
}

const resolverPath = "src/graphql/resolvers"

// get all types to be passed to GraphQLschema
func getAllTypes(s *gqlSchema, cfg *codegen.Config) []typeInfo {
	var nodes []typeInfo
	var conns []typeInfo
	var actionTypes []typeInfo
	for _, node := range s.nodes {
		for _, n := range node.ObjData.GQLNodes {
			nodes = append(nodes, typeInfo{
				Type:       n.Type,
				ImportPath: resolverPath,
			})
		}
		for _, conn := range node.connections {
			conns = append(conns, typeInfo{
				Type:       conn.ConnType,
				ImportPath: resolverPath,
				Function:   true,
			})
		}

		// right now, only actions are dependents
		for _, dep := range node.Dependents {
			for _, depObj := range dep.ObjData.GQLNodes {
				actionTypes = append(actionTypes, typeInfo{
					Type:       depObj.Type,
					ImportPath: trimPath(cfg, dep.FilePath),
				})
			}
		}
	}
	var enums []typeInfo
	for _, enum := range s.enums {
		enums = append(enums, typeInfo{
			Type:       enum.Type,
			ImportPath: resolverPath,
		})
	}

	var customQueries []typeInfo
	for _, node := range s.customQueries {
		for _, n := range node.ObjData.GQLNodes {
			customQueries = append(customQueries, typeInfo{
				Type:       n.Type,
				ImportPath: resolverPath,
			})

			for _, conn := range node.connections {
				conns = append(conns, typeInfo{
					Type:       conn.ConnType,
					ImportPath: resolverPath,
					Function:   true,
				})
			}
		}
	}

	var customMutations []typeInfo
	for _, node := range s.customMutations {
		for _, n := range node.ObjData.GQLNodes {
			customMutations = append(customMutations, typeInfo{
				Type:       n.Type,
				ImportPath: trimPath(cfg, node.FilePath),
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

func getSortedLines(s *gqlSchema, cfg *codegen.Config) []string {
	// this works based on what we're currently doing
	// if we eventually add other things here, may not work?

	var nodes []string
	var conns []string
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
		CreateDirIfNeeded: true,
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
		CreateDirIfNeeded: true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	})
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
		CreateDirIfNeeded: true,
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
	TypeImports      []*fileImport
	//	ArgImports       []string // incase it's { [argName: string]: any }, we need to know difference
	ArgImports       []*fileImport
	Args             []*fieldConfigArg
	FunctionContents []string
	ReturnTypeHint   string
	connection       *gqlConnection
}

func (f fieldConfig) FieldType() string {
	imps := make([]string, len(f.TypeImports))
	for i, imp := range f.TypeImports {
		if imp.Function {
			imps[i] = fmt.Sprintf("%s()", imp.Type)
		} else {
			imps[i] = imp.Type
		}
	}
	return typeFromImports(imps)
}

type fieldConfigArg struct {
	Name        string
	Description string
	Imports     []*fileImport
}

func (f fieldConfigArg) FieldType() string {
	typs := make([]string, len(f.Imports))
	for idx, imp := range f.Imports {
		typs[idx] = imp.Type
	}
	return typeFromImports(typs)
}

func getGQLFileImports(imps []enttype.FileImport, mutation bool) []*fileImport {
	imports := make([]*fileImport, len(imps))
	fn := false
	for idx, imp := range imps {
		var importPath string
		typ := imp.Type
		switch imp.ImportType {
		case enttype.GraphQL:
			importPath = "graphql"
			typ = imp.Type

		case enttype.Enum, enttype.Connection, enttype.Node:
			if imp.ImportType == enttype.Connection {
				fn = true
			}
			if mutation {
				importPath = codepath.GetImportPathForExternalGQLFile()
			} else {
				importPath = codepath.GetImportPathForInternalGQLFile()
			}
			typ = fmt.Sprintf("%sType", typ)

		case enttype.EntGraphQL:
			importPath = codepath.GraphQLPackage

		case enttype.Package:
			importPath = codepath.Package

		case enttype.GraphQLJSON:
			importPath = "graphql-type-json"

		default:
			// empty means nothing to import and that's ok...
			if imp.ImportType != "" {
				panic(fmt.Sprintf("unsupported Import Type %v", imp.ImportType))
			}
		}
		imports[idx] = &fileImport{
			Type:       typ,
			ImportPath: importPath,
			Function:   fn,
		}
	}
	return imports
}

func getGQLFileImportsFromStrings(imps []string) []*fileImport {
	imports := make([]*fileImport, len(imps))
	for idx, imp := range imps {
		imports[idx] = &fileImport{
			Type:       imp,
			ImportPath: "graphql",
		}
	}
	return imports
}

func buildNodeForObject(processor *codegen.Processor, nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) *objectType {
	result := &objectType{
		Type:     fmt.Sprintf("%sType", nodeData.Node),
		Node:     nodeData.Node,
		TSType:   nodeData.Node,
		GQLType:  "GraphQLObjectType",
		Exported: true,
		// import NodeInterface because ents are always Nodes
		Imports: []*fileImport{
			{
				ImportPath: codepath.GraphQLPackage,
				Type:       "GraphQLNodeInterface",
			},
			{
				ImportPath: codepath.GetExternalImportPath(),
				Type:       nodeData.Node,
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
		result.Imports = append(result.Imports, &fileImport{
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
			Type:       fmt.Sprintf("%sType", node.Node),
		})
	}
	result.Imports = append(result.Imports, &fileImport{
		ImportPath: codepath.GetExternalImportPath(),
		Type:       nodeData.Node,
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
		addSingularEdge(edge, &fields, instance)
	}

	for _, field := range fieldInfo.GraphQLFields() {
		gqlName := field.GetGraphQLName()
		gqlField := &fieldType{
			Name:               gqlName,
			HasResolveFunction: gqlName != field.TsFieldName(),
			FieldImports:       getGQLFileImports(field.GetTSGraphQLTypeForFieldImports(false), false),
		}

		if processor.Config.Base64EncodeIDs() && field.IDType() {
			gqlField.ResolverMethod = "nodeIDEncoder"
		}

		if gqlField.HasResolveFunction {
			gqlField.FunctionContents = []string{fmt.Sprintf("return %s.%s;", instance, field.TsFieldName())}
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
				[]enttype.FileImport{
					{
						Type:       group.ConstType,
						ImportType: enttype.Enum,
					},
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
			Imports: []*fileImport{getNativeGQLImportFor("GraphQLInt")},
		},
		{
			Name:    "after",
			Imports: []*fileImport{getNativeGQLImportFor("GraphQLString")},
		},
		{
			Name:    "last",
			Imports: []*fileImport{getNativeGQLImportFor("GraphQLInt")},
		},
		{
			Name:    "before",
			Imports: []*fileImport{getNativeGQLImportFor("GraphQLString")},
		},
	}
}

func addConnection(nodeData *schema.NodeData, edge edge.ConnectionEdge, fields *[]*fieldType, instance string, customField *CustomField) {

	// import GraphQLEdgeConnection and EdgeQuery file
	extraImports := []*fileImport{
		{
			ImportPath: codepath.GraphQLPackage,
			Type:       "GraphQLEdgeConnection",
		},
	}

	var buildQuery string
	if customField == nil {
		// for custom fields, EntQuery is an implementation detail
		// and may or may not be exposed so we don't depend on it here
		extraImports = append(extraImports, &fileImport{
			ImportPath: codepath.GetExternalImportPath(),
			Type:       edge.TsEdgeQueryName(),
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

func buildActionNodes(nodeData *schema.NodeData, action action.Action, actionPrefix string) []*objectType {
	var ret []*objectType
	for _, c := range action.GetCustomInterfaces() {
		if c.Action == nil {
			ret = append(ret, buildCustomInputNode(c))
		}
	}
	ret = append(ret,
		buildActionInputNode(nodeData, action, actionPrefix),
		buildActionPayloadNode(nodeData, action, actionPrefix),
	)
	return ret
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

func buildCustomInputNode(c *action.CustomInterface) *objectType {
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
			FieldImports: getGQLFileImports(f.GetTSGraphQLTypeForFieldImports(false), true),
		})
	}

	for _, f := range c.NonEntFields {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.FieldType.GetTSGraphQLImports(), true),
		})
	}
	return result
}

func buildActionInputNode(nodeData *schema.NodeData, a action.Action, actionPrefix string) *objectType {
	// TODO shared input types across create/edit for example
	node := fmt.Sprintf("%sInput", actionPrefix)

	result := &objectType{
		Type:     fmt.Sprintf("%sInputType", actionPrefix),
		Node:     node,
		TSType:   node,
		Exported: true,
		GQLType:  "GraphQLInputObjectType",
	}

	// maybe not the best place for this probably but it makes sense
	// as dependencies...
	for _, c := range a.GetCustomInterfaces() {
		if c.Action != nil {
			result.Imports = append(result.Imports, &fileImport{
				Type:       c.GQLType,
				ImportPath: getImportPathForActionFromPackage(c.Action.GetNodeInfo().PackageName, c.Action),
			})
		}
	}

	// add id field for edit and delete mutations
	if a.MutatingExistingObject() {
		result.Fields = append(result.Fields, &fieldType{
			Name:         fmt.Sprintf("%sID", a.GetNodeInfo().NodeInstance),
			FieldImports: getGQLFileImportsFromStrings([]string{"GraphQLNonNull", "GraphQLID"}),
			Description:  fmt.Sprintf("id of %s", nodeData.Node),
		})
	}

	for _, f := range a.GetFields() {
		if !f.EditableField() {
			continue
		}
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.GetTSGraphQLTypeForFieldImports(!action.IsRequiredField(a, f)), true),
		})
	}

	// add custom fields to the input
	for _, f := range a.GetNonEntFields() {
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: getGQLFileImports(f.FieldType.GetTSGraphQLImports(), true),
		})
	}

	// add each edge that's part of the mutation as an ID
	// use singular version so that this is friendID instead of friendsID
	for _, edge := range a.GetEdges() {
		result.Fields = append(result.Fields, &fieldType{
			Name:         fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
			FieldImports: getGQLFileImportsFromStrings([]string{"GraphQLNonNull", "GraphQLID"}),
		})
	}

	if hasCustomInput(a) {
		// custom interface for editing

		// add adminID to interface assuming it's not already there
		intType := &interfaceType{
			Exported: false,
			Name:     fmt.Sprintf("custom%sInput", actionPrefix),
		}

		// only want the id field for the object when editing said object
		if a.MutatingExistingObject() {
			intType.Fields = append(intType.Fields, &interfaceField{
				Name: fmt.Sprintf("%sID", a.GetNodeInfo().NodeInstance),
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			})
		}

		// add edges as part of the input
		// usually only one edge e.g. addFriend or addAdmin etc
		for _, edge := range a.GetEdges() {
			intType.Fields = append(intType.Fields, &interfaceField{
				Name: fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			})
		}

		for _, f := range a.GetFields() {
			if !f.IsEditableIDField() {
				continue
			}
			intType.Fields = append(intType.Fields, &interfaceField{
				Name: f.GetGraphQLName(),
				// we're doing these as strings instead of ids because we're going to convert from gql id to ent id
				Type: "string",
			})
		}

		for _, f := range a.GetNonEntFields() {
			_, ok := f.FieldType.(enttype.IDMarkerInterface)
			// same logic above for regular fields
			if ok {
				intType.Fields = append(intType.Fields, &interfaceField{
					Name: f.GetGraphQLName(),
					Type: "string",
				})
			}
		}

		// TODO do we need to overwrite some fields?
		if action.HasInput(a) {
			intType.Extends = []string{
				a.GetInputName(),
			}
		}

		result.TSInterfaces = []*interfaceType{intType}
	}

	return result
}

func buildActionPayloadNode(nodeData *schema.NodeData, a action.Action, actionPrefix string) *objectType {
	node := fmt.Sprintf("%sPayload", actionPrefix)
	result := &objectType{
		Type:     fmt.Sprintf("%sPayloadType", actionPrefix),
		Node:     node,
		TSType:   node,
		Exported: true,
		GQLType:  "GraphQLObjectType",
		DefaultImports: []*fileImport{
			{
				ImportPath: getActionPath(nodeData, a),
				Type:       a.GetActionName(),
			},
		},
		Imports: []*fileImport{
			{
				ImportPath: codepath.GetExternalImportPath(),
				Type:       nodeData.Node,
			},
			{
				ImportPath: codepath.GetImportPathForExternalGQLFile(),
				Type:       fmt.Sprintf("%sType", nodeData.Node),
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Type:       "mustDecodeIDFromGQLID",
			},
		},
	}

	// this is here but it's probably better in buildActionFieldConfig
	if action.HasInput(a) {
		result.Imports = append(result.Imports, &fileImport{
			ImportPath: getActionPath(nodeData, a),
			Type:       a.GetInputName(),
		})
	}

	nodeInfo := a.GetNodeInfo()
	if a.GetOperation() != ent.DeleteAction {
		result.Fields = append(result.Fields, &fieldType{
			Name: nodeInfo.NodeInstance,
			FieldImports: []*fileImport{
				{
					Type:       "GraphQLNonNull",
					ImportPath: "graphql",
				},
				{
					Type:       fmt.Sprintf("%sType", nodeInfo.Node),
					ImportPath: codepath.GetImportPathForExternalGQLFile(),
				},
			},
		})

		result.TSInterfaces = []*interfaceType{
			{
				Exported: false,
				Name:     fmt.Sprintf("%sPayload", actionPrefix),
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
		result.Fields = append(result.Fields, &fieldType{
			Name:         fmt.Sprintf("deleted%sID", nodeInfo.Node),
			FieldImports: getGQLFileImportsFromStrings([]string{"GraphQLID"}),
		})

		result.TSInterfaces = []*interfaceType{
			{
				Exported: false,
				Name:     fmt.Sprintf("%sPayload", actionPrefix),
				Fields: []*interfaceField{
					{
						Name: fmt.Sprintf("deleted%sID", nodeInfo.Node),
						Type: "string",
					},
				},
			},
		}
	}

	return result
}

func hasCustomInput(a action.Action) bool {
	if a.MutatingExistingObject() {
		return true
	}

	for _, f := range a.GetFields() {
		if f.IsEditableIDField() {
			return true
		}
	}
	return false
}

func getActionPath(nodeData *schema.NodeData, a action.Action) string {
	return fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, strcase.ToSnake(a.GetActionName()))
}

func getActionBasePath(nodeData *schema.NodeData, a action.Action) string {
	return fmt.Sprintf("src/ent/%s/actions/generated/%s", nodeData.PackageName, strcase.ToSnake(a.GetActionName()+"Base"))
}

func buildActionFieldConfig(processor *codegen.Processor, nodeData *schema.NodeData, a action.Action, actionPrefix string) (*fieldConfig, error) {
	// TODO this is so not obvious at all
	// these are things that are automatically useImported....
	argImports := []*fileImport{
		{
			Type:       a.GetActionName(),
			ImportPath: getActionPath(nodeData, a),
		},
	}
	var argName string
	if hasCustomInput(a) {
		argName = fmt.Sprintf("custom%sInput", actionPrefix)
	} else {
		argName = a.GetInputName()
		argImports = append(argImports, &fileImport{
			Type:       argName,
			ImportPath: getActionPath(nodeData, a),
		})
	}
	result := &fieldConfig{
		Exported:         true,
		Name:             fmt.Sprintf("%sType", actionPrefix),
		Arg:              fmt.Sprintf("{ [input: string]: %s}", argName),
		ResolveMethodArg: "{ input }",
		TypeImports: []*fileImport{
			{
				ImportPath: "graphql",
				Type:       "GraphQLNonNull",
			},
			{
				// local so it's fine
				Type: fmt.Sprintf("%sPayloadType", actionPrefix),
			},
		},
		Args: []*fieldConfigArg{
			{
				Name: "input",
				Imports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					{
						// local
						Type: fmt.Sprintf("%sInputType", actionPrefix),
					},
				},
			},
		},
		ReturnTypeHint: fmt.Sprintf("Promise<%sPayload>", actionPrefix),
	}

	base64EncodeIDs := processor.Config.Base64EncodeIDs()

	if a.GetOperation() == ent.CreateAction {
		result.FunctionContents = append(
			result.FunctionContents,
			// we need fields like userID here which aren't exposed to graphql but editable...
			fmt.Sprintf("const %s = await %s.create(context.getViewer(), {", nodeData.NodeInstance, a.GetActionName()),
		)
		for _, f := range a.GetFields() {
			// we need fields like userID here which aren't exposed to graphql but editable...

			if f.IsEditableIDField() && base64EncodeIDs {
				argImports = append(argImports, &fileImport{
					Type:       "mustDecodeIDFromGQLID",
					ImportPath: codepath.GraphQLPackage,
				})
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("%s: mustDecodeIDFromGQLID(input.%s),", f.TsFieldName(), f.TsFieldName()),
				)
			} else if f.EditableField() {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("%s: input.%s,", f.TsFieldName(), f.TsFieldName()),
				)
			}
		}
		for _, f := range a.GetNonEntFields() {
			result.FunctionContents = append(
				result.FunctionContents,
				fmt.Sprintf("%s: input.%s,", f.TsFieldName(), f.TsFieldName()),
			)
		}
		result.FunctionContents = append(result.FunctionContents, "}).saveX();")

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
		)
	} else if a.GetOperation() == ent.DeleteAction {
		if base64EncodeIDs {
			argImports = append(argImports, &fileImport{
				Type:       "mustDecodeIDFromGQLID",
				ImportPath: codepath.GraphQLPackage,
			})
		}

		if base64EncodeIDs {
			result.FunctionContents = append(
				result.FunctionContents,
				fmt.Sprintf("await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%sID));", a.GetActionName(), nodeData.NodeInstance),
			)
		} else {
			result.FunctionContents = append(
				result.FunctionContents,
				fmt.Sprintf("await %s.saveXFromID(context.getViewer(), input.%sID);", a.GetActionName(), nodeData.NodeInstance),
			)
		}

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {deleted%sID: input.%sID};", nodeData.Node, nodeData.NodeInstance),
		)
	} else {
		// some kind of editing
		if base64EncodeIDs {
			argImports = append(argImports, &fileImport{
				Type:       "mustDecodeIDFromGQLID",
				ImportPath: codepath.GraphQLPackage,
			})
		}

		if action.HasInput(a) {
			// have fields and therefore input
			if base64EncodeIDs {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%sID), {", nodeData.NodeInstance, a.GetActionName(), nodeData.NodeInstance),
				)
			} else {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), input.%sID, {", nodeData.NodeInstance, a.GetActionName(), nodeData.NodeInstance),
				)
			}
			for _, f := range a.GetFields() {
				if f.ExposeToGraphQL() && f.EditableField() {
					if base64EncodeIDs && f.IsEditableIDField() {
						result.FunctionContents = append(
							result.FunctionContents,
							fmt.Sprintf("%s: mustDecodeIDFromGQLID(input.%s),", f.TsFieldName(), f.TsFieldName()),
						)
					} else {
						result.FunctionContents = append(
							result.FunctionContents,
							fmt.Sprintf("%s: input.%s,", f.TsFieldName(), f.TsFieldName()),
						)
					}
				}
			}
			for _, f := range a.GetNonEntFields() {
				_, ok := f.FieldType.(enttype.IDMarkerInterface)
				if ok && base64EncodeIDs {
					result.FunctionContents = append(
						result.FunctionContents,
						fmt.Sprintf("%s: mustDecodeIDFromGQLID(input.%s),", f.TsFieldName(), f.TsFieldName()),
					)
				} else {
					result.FunctionContents = append(
						result.FunctionContents,
						fmt.Sprintf("%s: input.%s,", f.TsFieldName(), f.TsFieldName()),
					)
				}
			}
			result.FunctionContents = append(result.FunctionContents, "});")

		} else if action.IsEdgeAction(a) {
			edges := a.GetEdges()
			if len(edges) != 1 {
				return nil, errors.New("expected one edge for an edge action")
			}
			edge := edges[0]
			// have fields and therefore input
			if base64EncodeIDs {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%sID), mustDecodeIDFromGQLID(input.%sID));", nodeData.NodeInstance, a.GetActionName(), nodeData.NodeInstance, strcase.ToLowerCamel(edge.Singular())),
				)
			} else {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), input.%sID, input.%sID);", nodeData.NodeInstance, a.GetActionName(), nodeData.NodeInstance, strcase.ToLowerCamel(edge.Singular())),
				)
			}
		} else {
			if base64EncodeIDs {
				// no fields
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), mustDecodeIDFromGQLID(input.%sID));", nodeData.NodeInstance, a.GetActionName(), nodeData.NodeInstance),
				)
			} else {
				// no fields
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("const %s = await %s.saveXFromID(context.getViewer(), input.%sID);", nodeData.NodeInstance, a.GetActionName(), nodeData.NodeInstance),
				)
			}
		}

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
		)
	}

	// TODO these are just all imports, we don't care where from
	result.ArgImports = argImports

	return result, nil
}

type objectType struct {
	Type     string // GQLType we're creating
	Node     string // GraphQL Node AND also ent node. Need to decouple this...
	TSType   string
	Fields   []*fieldType
	Exported bool
	GQLType  string // GraphQLObjectType or GraphQLInputObjectType

	DefaultImports []*fileImport
	Imports        []*fileImport
	TSInterfaces   []*interfaceType

	// make this a string for now since we're only doing built-in interfaces
	GQLInterfaces  []string
	IsTypeOfMethod []string
}

type fieldType struct {
	Name               string
	HasResolveFunction bool
	HasAsyncModifier   bool
	Description        string
	FieldImports       []*fileImport
	// imports that are ignored in the FieldType method but needed in the file e.g. used in FunctionContents
	ExtraImports []*fileImport
	Args         []*fieldConfigArg
	// no args for now. come back.
	FunctionContents []string
	ResolverMethod   string
	// TODO more types we need to support
}

type interfaceType struct {
	Exported bool
	Name     string
	Fields   []*interfaceField
	// interfaces to extend
	Extends []string
}

func (it interfaceType) InterfaceDecl() string {
	var sb strings.Builder
	if it.Exported {
		sb.WriteString("export ")
	}
	sb.WriteString("interface ")
	sb.WriteString(it.Name)

	if len(it.Extends) > 0 {
		sb.WriteString(" extends ")
		sb.WriteString(strings.Join(it.Extends, ", "))
	}

	return sb.String()
}

type interfaceField struct {
	Name      string
	Type      string
	UseImport bool
}

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

func (f *fieldType) FieldType() string {
	imps := make([]string, len(f.FieldImports))
	for idx, imp := range f.FieldImports {
		if imp.Function {
			imps[idx] = fmt.Sprintf("%s()", imp.Type)
		} else {
			imps[idx] = imp.Type
		}
	}
	return typeFromImports(imps)
}

func (f *fieldType) AllImports() []*fileImport {
	ret := append(f.FieldImports, f.ExtraImports...)
	for _, arg := range f.Args {
		ret = append(ret, arg.Imports...)
	}
	return ret
}

type fileImport struct {
	ImportPath string
	Type       string
	Function   bool // defaults to no. if function, call it instead of just referencing the import when used?
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
}

func getQueryData(processor *codegen.Processor, s *gqlSchema) []rootField {
	results := []rootField{}
	for _, rootQuery := range s.rootQueries {
		results = append(results, rootField{
			Name:       rootQuery.Name,
			Type:       rootQuery.FieldConfig.Name,
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
		})
	}

	for _, node := range s.customQueries {
		if node.Field == nil {
			panic("TODO query with no custom field")
		}
		query := node.Field
		results = append(results, rootField{
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
			Name:       query.GraphQLName,
			Type:       fmt.Sprintf("%sQueryType", strcase.ToCamel(query.GraphQLName)),
		})
	}

	// sort lexicographically so that we are not always changing this
	sort.Slice(results, func(i, j int) bool {
		return results[i].Name < results[j].Name
	})
	return results
}

func getMutationData(processor *codegen.Processor, s *gqlSchema) []rootField {
	var results []rootField
	for key := range processor.Schema.Nodes {

		nodeData := processor.Schema.Nodes[key].NodeData
		if nodeData.HideFromGraphQL {
			continue
		}

		for _, action := range nodeData.ActionInfo.Actions {
			if !action.ExposedToGraphQL() {
				continue
			}
			results = append(results, rootField{
				ImportPath: getImportPathForAction(nodeData, action),
				Type:       fmt.Sprintf("%sType", strcase.ToCamel(action.GetGraphQLName())),
				Name:       action.GetGraphQLName(),
			})
		}
	}

	for _, node := range s.customMutations {
		if node.Field == nil {
			panic("TODO mutation with no custom field")
		}
		mutation := node.Field
		results = append(results, rootField{
			ImportPath: getImportPathForCustomMutation(mutation.GraphQLName),
			Name:       mutation.GraphQLName,
			Type:       fmt.Sprintf("%sType", strcase.ToCamel(mutation.GraphQLName)),
		})
	}

	// sort lexicographically so that we are not always changing this
	sort.Slice(results, func(i, j int) bool {
		return results[i].Name < results[j].Name
	})
	return results
}

func writeQueryFile(processor *codegen.Processor, s *gqlSchema) error {
	filePath := getQueryFilePath(processor.Config)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: gqlRootData{
			RootFields: getQueryData(processor, s),
			Type:       "QueryType",
			Node:       "Query",
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/root.tmpl"),
		TemplateName:      "root.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func writeMutationFile(processor *codegen.Processor, s *gqlSchema) error {
	filePath := getMutationFilePath(processor.Config)
	imps := tsimport.NewImports(processor.Config, filePath)
	return file.Write((&file.TemplatedBasedFileWriter{
		Config: processor.Config,
		Data: gqlRootData{
			RootFields: getMutationData(processor, s),
			Type:       "MutationType",
			Node:       "Mutation",
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/root.tmpl"),
		TemplateName:      "root.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func buildNodeFieldConfig(processor *codegen.Processor) *fieldConfig {
	return &fieldConfig{
		Exported: true,
		Name:     "NodeQueryType",
		Arg:      "NodeQueryArgs",
		TypeImports: []*fileImport{
			{
				Type:       "GraphQLNodeInterface",
				ImportPath: codepath.GraphQLPackage,
			},
		},
		Args: []*fieldConfigArg{
			{
				Name:    "id",
				Imports: []*fileImport{getNativeGQLImportFor("GraphQLNonNull"), getNativeGQLImportFor("GraphQLID")},
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
			TypeImports: []*fileImport{
				{
					Type:       fmt.Sprintf("%sType", nodeData.Node),
					ImportPath: codepath.GetImportPathForInternalGQLFile(),
				},
			},
			Args: []*fieldConfigArg{
				{
					Name:    "id",
					Imports: []*fileImport{getNativeGQLImportFor("GraphQLNonNull"), getNativeGQLImportFor("GraphQLID")},
				},
			},
			ArgImports: []*fileImport{
				{
					ImportPath: codepath.GetExternalImportPath(),
					Type:       nodeData.Node,
				},
			},
			FunctionContents: []string{
				fmt.Sprintf("return %s.load(context.getViewer(), args.id);", nodeData.Node),
			},
		},
		FilePath: getRootQueryFilePath(processor.Config, nodeData),
		Imports: []*fileImport{
			{
				Type:       fmt.Sprintf("%sType", nodeData.Node),
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
			},
			{
				ImportPath: codepath.GetExternalImportPath(),
				Type:       nodeData.Node,
			},
		},
	}
}

func buildNodeRootQuery(processor *codegen.Processor) *rootQuery {
	return &rootQuery{
		FieldConfig: buildNodeFieldConfig(processor),
		Name:        "node",
		FilePath:    getNodeQueryTypeFilePath(processor.Config),
		WriteOnce:   true,
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
		Imports: []*fileImport{
			{
				ImportPath: codepath.GraphQLPackage,
				Type:       "EntNodeResolver",
			},
			{
				ImportPath: "src/ent/generated/loadAny",
				Type:       "loadEntByType",
			},
			{
				ImportPath: "src/ent/",
				Type:       "NodeType",
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Type:       "registerResolver",
			},
			{
				ImportPath: codepath.GraphQLPackage,
				Type:       "resolveID",
			},
			{
				Type:       "GraphQLNodeInterface",
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
		}{
			rq,
			processor.Config.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
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
		EditableCode: true,
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
			getAllTypes(s, processor.Config),
		},

		CreateDirIfNeeded: true,
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
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/index.tmpl"),
		TemplateName:      "index.tmpl",
		PathToFile:        filePath,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
		EditableCode:      true,
	}), file.WriteOnce())
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
			CreateDirIfNeeded: true,
		},
		file.DisableLog(),
		file.TempFile(),
	)
}
