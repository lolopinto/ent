package graphql

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
	"github.com/square/go-jose/json"
)

type TSStep struct {
}

func (p *TSStep) Name() string {
	return "graphql"
}

type CustomArg struct {
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

type CustomClassInfo struct {
	Name          string `json:"name"`
	Exported      bool   `json:"exported"`
	DefaultExport bool   `json:"defaultExport"`
	Path          string `json:"path"`
}

type customData struct {
	Args      map[string]*CustomArg       `json:"args"`
	Inputs    map[string]*CustomArg       `json:"inputs"`
	Objects   map[string]*CustomArg       `json:"objects"`
	Fields    []CustomField               `json:"fields"`
	Queries   []CustomField               `json:"queries"`
	Mutations []CustomField               `json:"mutations"`
	Classes   map[string]*CustomClassInfo `json:"classes"`
	Error     error
}

type CustomItem struct {
	Name         string       `json:"name"`
	Type         string       `json:"type"`
	Nullable     NullableItem `json:"nullable"`
	List         bool         `json:"list"`
	IsContextArg bool         `json:"isContextArg"`
	TSType       *string      `json:"tsType"`
}

type NullableItem string

const NullableContents NullableItem = "contents"
const NullableContentsAndList NullableItem = "contentsAndList"
const NullableTrue NullableItem = "true"

func (p *TSStep) ProcessData(data *codegen.Data) error {
	// these all need to be done after
	// 1a/ build data (actions and nodes)
	// 1b/ parse custom files
	// 2/ inject any custom data in there
	// 3/ write node files first then action files since there's a dependency...
	// 4/ write query/mutation/schema file
	// schema file depends on query/mutation so not quite worth the complication of breaking those 2 up

	cd, s := <-parseCustomData(data), <-buildGQLSchema(data)
	if cd.Error != nil {
		return cd.Error
	}
	// put this here after the fact
	s.customData = cd

	if err := processCustomData(data, s); err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(len(s.nodes))
	var serr syncerr.Error

	for key := range s.nodes {
		go func(key string) {
			defer wg.Done()
			node := s.nodes[key]

			if err := writeFile(node); err != nil {
				serr.Append(err)
			}

			if len(node.Dependents) == 0 {
				return
			}

			var dependentsWg sync.WaitGroup
			dependentsWg.Add(len(node.Dependents))
			for idx := range node.Dependents {
				go func(idx int) {
					defer dependentsWg.Done()
					dependentNode := node.Dependents[idx]

					if err := writeFile(dependentNode); err != nil {
						serr.Append(err)
					}
				}(idx)
			}
			dependentsWg.Wait()
		}(key)
	}
	wg.Add(len(s.customMutations))
	for idx := range s.customMutations {
		go func(idx int) {
			defer wg.Done()
			node := s.customMutations[idx]

			if err := writeFile(node); err != nil {
				serr.Append(err)
			}
		}(idx)
	}

	wg.Wait()

	if err := serr.Err(); err != nil {
		return err
	}

	if err := writeQueryFile(data); err != nil {
		serr.Append(err)
	}
	if s.hasMutations {
		if err := writeMutationFile(data, s); err != nil {
			serr.Append(err)
		}
	}

	if err := generateSchemaFile(s.hasMutations); err != nil {
		serr.Append(err)
	}

	return serr.Err()
}

var _ codegen.Step = &TSStep{}

func getFilePathForNode(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", nodeData.PackageName)
}

func getImportPathForNode(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/graphql/resolvers/generated/%s_type", nodeData.PackageName)
}

func getQueryFilePath() string {
	return fmt.Sprintf("src/graphql/resolvers/generated/query_type.ts")
}

func getMutationFilePath() string {
	return fmt.Sprintf("src/graphql/mutations/generated/mutation_type.ts")
}

func getTempSchemaFilePath() string {
	return fmt.Sprintf("src/graphql/gen_schema.ts")
}

func getSchemaFilePath() string {
	// just put it at root of src/graphql
	return "src/graphql/schema.gql"
}

func getFilePathForAction(nodeData *schema.NodeData, action action.Action) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s/%s_type.ts", nodeData.PackageName, strcase.ToSnake(action.GetGraphQLName()))
}

func getImportPathForAction(nodeData *schema.NodeData, action action.Action) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s/%s_type", nodeData.PackageName, strcase.ToSnake(action.GetGraphQLName()))
}

func getFilePathForCustomMutation(name string) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s_type.ts", strcase.ToSnake(name))
}

func getImportPathForCustomMutation(name string) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s_type", strcase.ToSnake(name))
}

func parseCustomData(data *codegen.Data) chan *customData {
	var res = make(chan *customData)
	go func() {
		var cd customData
		fmt.Println("checking for custom graphql definitions...")

		var buf bytes.Buffer
		var out bytes.Buffer
		var stderr bytes.Buffer
		for key := range data.Schema.Nodes {
			info := data.Schema.Nodes[key]
			nodeData := info.NodeData

			buf.WriteString(nodeData.Node)
			buf.WriteString("\n")
		}

		cmdArgs := []string{
			"--log-error", // TODO spend more time figuring this out
			"--project",
			// TODO this should find the tsconfig.json and not assume there's one at the root but fine for now
			filepath.Join(data.CodePath.GetAbsPathToRoot(), "tsconfig.json"),
			"-r",
			"tsconfig-paths/register",
			"../../src/scripts/custom_graphql.ts",
			"--path",
			// TODO this should be a configuration option to indicate where the code root is
			filepath.Join(data.CodePath.GetAbsPathToRoot(), "src"),
		}
		cmd := exec.Command("ts-node", cmdArgs...)
		cmd.Stdin = &buf
		cmd.Stdout = &out
		cmd.Stderr = &stderr
		if err := cmd.Run(); err != nil {
			str := stderr.String()
			err = errors.Wrap(err, str)
			cd.Error = err
			res <- &cd
			return
		}

		if err := json.Unmarshal(out.Bytes(), &cd); err != nil {
			err = errors.Wrap(err, "error unmarshalling custom data")
			cd.Error = err
		}
		res <- &cd
	}()
	return res
}

func processCustomData(data *codegen.Data, s *gqlSchema) error {
	cd := s.customData
	// TODO remove this
	if len(cd.Args) > 0 {
		return errors.New("TOOD: need to process args. doesn't work at the moment")
	}

	if err := processCustomFields(cd, s); err != nil {
		return err
	}

	if err := processCustomMutations(data, cd, s); err != nil {
		return err
	}
	return nil
}

func processCustomFields(cd *customData, s *gqlSchema) error {
	for _, field := range cd.Fields {
		nodeName := field.Node
		if cd.Inputs[nodeName] != nil {
			continue
		}

		if cd.Objects[nodeName] != nil {
			continue
		}

		nodeInfo := s.nodes[nodeName]

		if nodeInfo == nil {
			return fmt.Errorf("can't find %s node that has custom field %s ", field.Node, field.GraphQLName)
		}

		if len(field.Args) > 0 {
			return fmt.Errorf("don't currently support fields with any args")
		}

		objData := nodeInfo.ObjData
		nodeData := objData.NodeData
		// always has a node for now
		obj := objData.GQLNodes[0]

		gqlField, err := getCustomGQLField(field, s, nodeData.NodeInstance)
		if err != nil {
			return err
		}
		// append the field
		obj.Fields = append(obj.Fields, gqlField)
	}
	return nil
}

func getCustomGQLField(field CustomField, s *gqlSchema, instance string) (*fieldType, error) {
	imports, err := getGraphQLImportsForField(field, s)
	if err != nil {
		return nil, err
	}
	gqlField := &fieldType{
		Name:               field.GraphQLName,
		HasResolveFunction: false,
		FieldImports:       imports,
	}

	switch field.FieldType {
	case Accessor, Field:
		// for an accessor or field, we only add a resolve function if named differently
		if field.GraphQLName != field.FunctionName {
			gqlField.HasResolveFunction = true
			gqlField.FunctionContents = fmt.Sprintf("return %s.%s;", instance, field.FunctionName)
		}
		break

	case Function:
		gqlField.HasResolveFunction = true
		gqlField.FunctionContents = fmt.Sprintf("return %s.%s();", instance, field.FunctionName)
		break
	case AsyncFunction:
		gqlField.HasAsyncModifier = true
		gqlField.HasResolveFunction = true
		gqlField.FunctionContents = fmt.Sprintf("return %s.%s();", instance, field.FunctionName)

		break

	default:
		spew.Dump("default case")
	}
	return gqlField, nil
}

func getRelativeImportPath(data *codegen.Data, basepath, targetpath string) (string, error) {
	// BONUS: instead of this, we should use the nice paths in tsconfig...
	absPath := filepath.Join(data.CodePath.GetAbsPathToRoot(), basepath)

	// need to do any relative imports from the directory not from the file itself
	dir := filepath.Dir(absPath)
	rel, err := filepath.Rel(dir, targetpath)
	if err != nil {
		return "", err
	}

	return strings.TrimSuffix(rel, ".ts"), nil
}

func processCustomMutations(data *codegen.Data, cd *customData, s *gqlSchema) error {
	spew.Dump(data.CodePath.GetAbsPathToRoot())
	for idx := range cd.Mutations {
		// mutation having weird issues unless broken down like this
		mutation := cd.Mutations[idx]
		nodeName := mutation.Node

		class := cd.Classes[nodeName]
		if class == nil {
			return fmt.Errorf("mutation %s with class %s not found", mutation.GraphQLName, class.Name)
		}

		if !class.Exported {
			return fmt.Errorf("Resolver class %s needs to be exported", class.Name)
		}

		var objTypes []*objectType

		// TODO we want an option for namespace for folders but for now ignore
		mutationPath := getFilePathForCustomMutation(mutation.GraphQLName)

		// let's try and make this generic enough to work for input type and standard args...
		// and have graphql complain if not valid types at the end here
		for _, arg := range mutation.Args {
			// nothing to do with context args yet
			if arg.IsContextArg {
				continue
			}

			// need to build input type
			// TODO for now we assume inputtype is 1:1, that's not going to remain the same forever...
			inputObj := cd.Inputs[arg.Type]
			if inputObj == nil {
				continue
			}
			inputType, err := buildObjectType(data, cd, s, arg, mutationPath, "GraphQLInputObjectType")
			if err != nil {
				return err
			}
			objTypes = append(objTypes, inputType)
		}

		hasResponse := false
		for _, result := range mutation.Results {
			// 0 -1 allowed...
			object := cd.Objects[result.Type]
			if object == nil {
				continue
			}
			responseType, err := buildObjectType(data, cd, s, result, mutationPath, "GraphQLObjectType")
			if err != nil {
				return err
			}

			cls := cd.Classes[mutation.Node]
			if cls != nil {
				importPath, err := getRelativeImportPath(data, mutationPath, cls.Path)
				if err != nil {
					return err
				}
				if cls.DefaultExport {
					responseType.DefaultImports = append(responseType.DefaultImports, &fileImport{
						ImportPath: importPath,
						Type:       mutation.Node,
					})
				} else {
					responseType.Imports = append(responseType.Imports, &fileImport{
						ImportPath: importPath,
						Type:       mutation.Node,
					})
				}
			}
			hasResponse = true
			objTypes = append(objTypes, responseType)
		}
		if !hasResponse {
			return errors.New("no response for mutation. TODO handle")
		}

		s.customMutations = append(s.customMutations, &gqlNode{
			ObjData: &gqlobjectData{
				Node:         mutation.Node,
				NodeInstance: "obj",
				GQLNodes:     objTypes,
				FieldConfig:  buildCustomMutationFieldConfig(cd, mutation, objTypes),
			},
			FilePath: mutationPath,
			Field:    &mutation,
		})
	}

	// flag this appropriately
	if len(s.customMutations) > 0 {
		s.hasMutations = true
	}

	return nil
}

func buildCustomMutationFieldConfig(cd *customData, mutation CustomField, objTypes []*objectType) *fieldConfig {
	prefix := strcase.ToCamel(mutation.GraphQLName)
	var argImports []string

	// args that "useImport" should be called on
	for _, arg := range mutation.Args {
		if arg.IsContextArg {
			continue
		}

		cls := cd.Classes[arg.Type]
		if cls != nil && cls.Exported {
			argImports = append(argImports, arg.Type)
		}
	}
	for _, result := range mutation.Results {
		cls := cd.Classes[result.Type]
		if cls != nil && cls.Exported {
			argImports = append(argImports, result.Type)
		}
	}
	//	mutation.Args[0].Type
	// TODO share this with buildActionFieldConfig?
	result := &fieldConfig{
		Exported: true,
		Name:     fmt.Sprintf("%sType", prefix),
		// TODO this may eventually not be input but may be other types...
		Arg:              fmt.Sprintf("{ [input: string]: %s}", objTypes[0].Node),
		ResolveMethodArg: "{ input }",
		TypeImports: []string{
			"GraphQLNonNull",
			// TODO we should pass this in instead of automatically doing this
			fmt.Sprintf("%sResponseType", prefix),
		},
		ArgImports: argImports,
		Args: []*fieldConfigArg{
			{
				Name: "input",
				Imports: []string{
					"GraphQLNonNull",
					// same for this about passing it in
					fmt.Sprintf("%sInputType", prefix),
				},
			},
		},
		ReturnTypeHint: fmt.Sprintf("Promise<%sResponse>", prefix),
	}

	argContents := make([]string, len(mutation.Args))
	for idx, arg := range mutation.Args {
		if arg.IsContextArg {
			argContents[idx] = "context"
			continue
		}
		input := cd.Inputs[arg.Type]
		if input == nil {
			argContents[idx] = arg.Name
		} else {
			// TODO need to change the format of fields...
			args := []string{}
			for _, f := range cd.Fields {

				if f.Node != arg.Type {
					continue
				}
				args = append(args, fmt.Sprintf("%s:input.%s", f.GraphQLName, f.GraphQLName))
			}
			argContents[idx] = fmt.Sprintf("{%s},", strings.Join(args, ","))
		}
	}
	result.FunctionContents = []string{
		fmt.Sprintf("const r = new %s();", mutation.Node),
		fmt.Sprintf("return r.%s(", mutation.GraphQLName),
		// put all the args on one line separated by a comma. we'll depend on prettier to format correctly
		strings.Join(argContents, ","),
		// closing the funtion call..
		");",
	}

	return result
}

func buildObjectType(data *codegen.Data, cd *customData, s *gqlSchema, item CustomItem, destPath, gqlType string) (*objectType, error) {
	typ := &objectType{
		Type:     fmt.Sprintf("%sType", item.Type),
		Node:     item.Type,
		Exported: true,
		// input or object type
		GQLType: gqlType,
	}

	// TODO this is way too slow
	// need to change the format of fields
	// to not be a list but be mapped via name or something
	for _, f := range cd.Fields {
		if f.Node != item.Type {
			continue
		}
		// maybe we'll care for input vs response here at some point
		gqlField, err := getCustomGQLField(f, s, "obj")
		if err != nil {
			return nil, err
		}
		typ.Fields = append(typ.Fields, gqlField)
	}

	cls := cd.Classes[item.Type]
	createInterface := true
	if cls != nil {
		importPath, err := getRelativeImportPath(data, destPath, cls.Path)
		if err != nil {
			return nil, err
		}
		if cls.DefaultExport {

			// exported, we need to import it
			typ.DefaultImports = []*fileImport{
				{
					ImportPath: importPath,
					Type:       item.Type,
				},
			}
			createInterface = false
		} else if cls.Exported {
			typ.Imports = []*fileImport{
				{
					ImportPath: importPath,
					Type:       item.Type,
				},
			}
			createInterface = false
		}
	}

	if createInterface {
		// need to create an interface for it
		customInt := &interfaceType{
			Exported: false,
			Name:     item.Type,
		}
		// TODO also needs to be fixed...
		for _, field := range cd.Fields {
			if field.Node != item.Type {
				continue
			}

			newInt := &interfaceField{
				Name: field.GraphQLName,
				Type: field.Results[0].Type,
				// TODO getGraphQLImportsForField???
				UseImport: false,
				// TODO need to conver to number etc...
				// need to convert from graphql type to TS type :(
			}

			if len(field.Results) == 1 {
				result := field.Results[0]
				if result.TSType != nil {
					newInt.Type = *result.TSType
					if newInt.Type == "ID" {
						// TODO this needs to change since this isn't scalable
						newInt.UseImport = true
					}
				}
			}

			//			if field.Ts
			//			if field.Args[0].
			customInt.Fields = append(customInt.Fields, newInt)
		}
		typ.Interfaces = []*interfaceType{customInt}
	}
	return typ, nil
}

func getGraphQLImportsForField(f CustomField, s *gqlSchema) ([]string, error) {
	scalars := map[string]string{
		"String":  "GraphQLString",
		"Date":    "Time",
		"Int":     "GraphQLInt",
		"Float":   "GraphQLFloat",
		"Boolean": "GraphQLBoolean",
		"ID":      "GraphQLID",
	}

	var imports []string
	for _, result := range f.Results {

		switch result.Nullable {
		case NullableTrue:
			if result.List {
				imports = append(
					imports,
					"GraphQLList",
					"GraphQLNonNull",
				)
			}
			break

		case NullableContents:
			if !result.List {
				return nil, fmt.Errorf("list required to use this option")
			}
			imports = append(
				imports,
				"GraphQLNonNull",
				"GraphQLList",
			)
			break

		case NullableContentsAndList:
			if !result.List {
				return nil, fmt.Errorf("list required to use this option")
			}
			imports = append(
				imports,
				"GraphQLList",
			)
			break

		default:
			if result.List {
				imports = append(
					imports,
					"GraphQLNonNull",
					"GraphQLList",
					"GraphQLNonNull",
				)
			} else {
				imports = append(imports, "GraphQLNonNull")
			}
			break
		}

		typ, ok := scalars[result.Type]
		if ok {
			// scalar!
			imports = append(imports, typ)
		} else {
			_, ok := s.nodes[result.Type]
			if ok {
				// TODO need to add it to DefaultImport for the entire file...
				imports = append(imports, fmt.Sprintf("%sType", result.Type))
			} else {
				return nil, fmt.Errorf("found a type %s which was not part of the schema", result.Type)
			}
		}
	}
	return imports, nil
}

type gqlobjectData struct {
	NodeData     *schema.NodeData
	Node         string
	NodeInstance string
	GQLNodes     []*objectType
	FieldConfig  *fieldConfig
	initMap      bool
	m            map[string]bool
}

func (obj gqlobjectData) DefaultImports() []*fileImport {
	var result []*fileImport
	for _, node := range obj.GQLNodes {
		result = append(result, node.DefaultImports...)
	}
	return result
}

func (obj gqlobjectData) Imports() []*fileImport {
	var result []*fileImport
	for _, node := range obj.GQLNodes {
		result = append(result, node.Imports...)
	}
	return result
}

func (obj gqlobjectData) Interfaces() []*interfaceType {
	var result []*interfaceType
	for _, node := range obj.GQLNodes {
		result = append(result, node.Interfaces...)
	}
	return result
}

func (obj gqlobjectData) ForeignImport(name string) bool {
	if !obj.initMap {
		obj.m = make(map[string]bool)

		// any node Type defined here is local
		for _, node := range obj.GQLNodes {
			obj.m[node.Type] = true

			// same for interfaces
			for _, in := range node.Interfaces {
				obj.m[in.Name] = true
			}
		}
		// and field config
		obj.m[obj.FieldConfig.Name] = true
		obj.initMap = true
	}
	return !obj.m[name]
}

type gqlSchema struct {
	hasMutations    bool
	nodes           map[string]*gqlNode
	customQueries   []*gqlNode
	customMutations []*gqlNode
	customData      *customData
}

type gqlNode struct {
	ObjData    *gqlobjectData
	FilePath   string
	Dependents []*gqlNode // actions are the dependents
	Field      *CustomField
}

func buildGQLSchema(data *codegen.Data) chan *gqlSchema {
	var result = make(chan *gqlSchema)
	go func() {
		var hasMutations bool
		nodes := make(map[string]*gqlNode)
		var wg sync.WaitGroup
		var m sync.Mutex
		wg.Add(len(data.Schema.Nodes))

		nodeMap := data.Schema.Nodes
		for key := range data.Schema.Nodes {
			go func(key string) {
				defer wg.Done()

				info := data.Schema.Nodes[key]
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
						GQLNodes:     []*objectType{buildNodeForObject(nodeMap, nodeData)},
						FieldConfig:  buildFieldConfig(nodeData),
					},
					FilePath: getFilePathForNode(nodeData),
				}

				actionInfo := nodeData.ActionInfo
				if actionInfo != nil {
					for _, action := range actionInfo.Actions {
						if !action.ExposedToGraphQL() {
							continue
						}
						hasMutations = true
						actionPrefix := strcase.ToCamel(action.GetGraphQLName())

						actionObj := gqlNode{
							ObjData: &gqlobjectData{
								Node:         nodeData.Node,
								NodeInstance: nodeData.NodeInstance,
								GQLNodes:     buildActionNodes(nodeData, action, actionPrefix),
								FieldConfig:  buildActionFieldConfig(nodeData, action, actionPrefix),
							},
							FilePath: getFilePathForAction(nodeData, action),
						}
						obj.Dependents = append(obj.Dependents, &actionObj)
					}
				}

				m.Lock()
				defer m.Unlock()
				nodes[nodeData.Node] = &obj
			}(key)
		}

		wg.Wait()
		result <- &gqlSchema{
			nodes:        nodes,
			hasMutations: hasMutations,
		}
	}()
	return result
}

// write graphql file
func writeFile(node *gqlNode) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data:              node.ObjData,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/object.tmpl"),
		TemplateName:      "object.tmpl",
		PathToFile:        node.FilePath,
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

type fieldConfig struct {
	Exported         bool
	Name             string
	Arg              string
	ResolveMethodArg string
	TypeImports      []string
	ArgImports       []string // incase it's { [argName: string]: any }, we need to know difference
	Args             []*fieldConfigArg
	FunctionContents []string
	ReturnTypeHint   string
}

func (f fieldConfig) FieldType() string {
	return typeFromImports(f.TypeImports)
}

type fieldConfigArg struct {
	Name        string
	Description string
	Imports     []string
}

func (f fieldConfigArg) FieldType() string {
	return typeFromImports(f.Imports)
}

func buildFieldConfig(nodeData *schema.NodeData) *fieldConfig {
	return &fieldConfig{
		Exported:    true,
		Name:        fmt.Sprintf("%sQuery", nodeData.Node),
		Arg:         fmt.Sprintf("%sQueryArgs", nodeData.Node),
		TypeImports: []string{fmt.Sprintf("%sType", nodeData.Node)},
		Args: []*fieldConfigArg{
			{
				Name:    "id",
				Imports: []string{"GraphQLNonNull", "GraphQLID"},
			},
		},
		FunctionContents: []string{
			fmt.Sprintf("return %s.load(context.getViewer(), args.id);", nodeData.Node),
		},
	}
}

func buildNodeForObject(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) *objectType {
	result := &objectType{
		Type:     fmt.Sprintf("%sType", nodeData.Node),
		Node:     nodeData.Node,
		GQLType:  "GraphQLObjectType",
		Exported: true,
	}

	for _, node := range nodeData.GetUniqueNodes() {
		// no need to import yourself
		if node.Node == nodeData.Node {
			continue
		}
		result.Imports = append(result.Imports, &fileImport{
			ImportPath: fmt.Sprintf("./%s_type", node.PackageName),
			Type:       fmt.Sprintf("%sType", node.Node),
		})
	}
	result.DefaultImports = append(result.DefaultImports, &fileImport{
		ImportPath: fmt.Sprintf("src/ent/%s", nodeData.PackageName),
		Type:       nodeData.Node,
	})

	result.Interfaces = append(result.Interfaces, &interfaceType{
		Name: fmt.Sprintf("%sQueryArgs", nodeData.Node),
		Fields: []*interfaceField{
			{
				Name:      "id",
				Type:      "ID",
				UseImport: true,
			},
		},
	})

	instance := nodeData.NodeInstance

	fieldInfo := nodeData.FieldInfo
	var fields []*fieldType

	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		// TODO this shouldn't be here but be somewhere else...
		if f != nil {
			fieldInfo.InvalidateFieldForGraphQL(f)
		}
		addSingularEdge(edge, &fields, instance)
	}

	for _, field := range fieldInfo.GraphQLFields() {
		gqlField := &fieldType{
			Name:               field.GetGraphQLName(),
			HasResolveFunction: field.GetGraphQLName() != field.TsFieldName(),
			FieldImports:       field.GetTSGraphQLTypeForFieldImports(false),
		}
		if gqlField.HasResolveFunction {
			gqlField.FunctionContents = fmt.Sprintf("return %s.%s;", instance, field.TsFieldName())
		}
		fields = append(fields, gqlField)
	}

	for _, edge := range nodeData.EdgeInfo.Associations {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		if edge.Unique {
			addSingularEdge(edge, &fields, instance)
		} else {
			addPluralEdge(edge, &fields, instance)
		}
	}

	for _, edge := range nodeData.EdgeInfo.ForeignKeys {
		if nodeMap.HideFromGraphQL(edge) {
			continue
		}
		addPluralEdge(edge, &fields, instance)
	}
	result.Fields = fields
	return result
}

func addSingularEdge(edge edge.Edge, fields *[]*fieldType, instance string) {
	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       edge.GetTSGraphQLTypeImports(),
		FunctionContents:   fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName()),
	}
	*fields = append(*fields, gqlField)
}

func addPluralEdge(edge edge.Edge, fields *[]*fieldType, instance string) {
	gqlField := &fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       edge.GetTSGraphQLTypeImports(),
		FunctionContents:   fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName()),
	}
	*fields = append(*fields, gqlField)
}

func buildActionNodes(nodeData *schema.NodeData, action action.Action, actionPrefix string) []*objectType {
	return []*objectType{
		buildActionInputNode(nodeData, action, actionPrefix),
		buildActionResponseNode(nodeData, action, actionPrefix),
	}
}

func buildActionInputNode(nodeData *schema.NodeData, a action.Action, actionPrefix string) *objectType {
	// TODO shared input types across created/edit for example
	result := &objectType{
		Type:     fmt.Sprintf("%sInputType", actionPrefix),
		Node:     fmt.Sprintf("%sInput", actionPrefix),
		Exported: true,
		GQLType:  "GraphQLInputObjectType",
	}

	// add id field for edit and delete mutations
	if a.MutatingExistingObject() {
		result.Fields = append(result.Fields, &fieldType{
			Name:         fmt.Sprintf("%sID", a.GetNodeInfo().NodeInstance),
			FieldImports: []string{"GraphQLNonNull", "GraphQLID"},
			Description:  fmt.Sprintf("id of %s", nodeData.Node),
		})
	}

	for _, f := range a.GetFields() {
		if !f.EditableField() {
			continue
		}
		result.Fields = append(result.Fields, &fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: f.GetTSGraphQLTypeForFieldImports(!action.IsRequiredField(a, f)),
		})
	}

	// add each edge that's part of the mutation as an ID
	// use singular version so that this is friendID instead of friendsID
	for _, edge := range a.GetEdges() {
		result.Fields = append(result.Fields, &fieldType{
			Name:         fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
			FieldImports: []string{"GraphQLNonNull", "GraphQLID"},
		})
	}

	if a.MutatingExistingObject() {
		// custom interface for editing

		result.Interfaces = []*interfaceType{
			{
				Exported: false,
				Name:     fmt.Sprintf("custom%sInput", actionPrefix),
				Fields: []*interfaceField{
					{
						Name:      fmt.Sprintf("%sID", a.GetNodeInfo().NodeInstance),
						Type:      "ID", // ID
						UseImport: true,
					},
				},
			},
		}

		// this doesn't ally for delete
		// can be done cleaner if/when this gets more complicated but works for now
		if a.GetOperation() != ent.DeleteAction {
			result.Interfaces[0].Extends = []string{
				fmt.Sprintf("%sInput", actionPrefix),
			}
		}
	}

	// TODO non ent fields 	e.g. status etc

	return result
}

// TODO stolen from internal/tscode/write_action.go
func getInputName(action action.Action) string {
	// TODO
	// todo multiple create | edits

	node := action.GetNodeInfo().Node
	switch action.GetOperation() {
	case ent.CreateAction:
		return fmt.Sprintf("%sCreateInput", node)
	case ent.EditAction:
		return fmt.Sprintf("%sEditInput", node)
	}
	panic("invalid. todo")
}

func buildActionResponseNode(nodeData *schema.NodeData, action action.Action, actionPrefix string) *objectType {
	result := &objectType{
		Type:     fmt.Sprintf("%sResponseType", actionPrefix),
		Node:     fmt.Sprintf("%sResponse", actionPrefix),
		Exported: true,
		GQLType:  "GraphQLObjectType",
		DefaultImports: []*fileImport{
			{
				ImportPath: fmt.Sprintf("src/ent/%s", nodeData.PackageName),
				Type:       nodeData.Node,
			},
			{
				ImportPath: fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, strcase.ToSnake(action.GetActionName())),
				Type:       action.GetActionName(),
			},
		},
		Imports: []*fileImport{
			{
				ImportPath: getImportPathForNode(nodeData),
				Type:       fmt.Sprintf("%sType", nodeData.Node),
			},
		},
	}

	if action.GetOperation() != ent.DeleteAction {
		result.Imports = append(result.Imports, &fileImport{
			ImportPath: fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, strcase.ToSnake(action.GetActionName())),
			Type:       getInputName(action),
		})
	}

	nodeInfo := action.GetNodeInfo()
	if action.GetOperation() != ent.DeleteAction {
		result.Fields = append(result.Fields, &fieldType{
			Name:         nodeInfo.NodeInstance,
			FieldImports: []string{"GraphQLNonNull", fmt.Sprintf("%sType", nodeInfo.Node)},
		})

		result.Interfaces = []*interfaceType{
			{
				Exported: false,
				Name:     fmt.Sprintf("%sResponse", actionPrefix),
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
			FieldImports: []string{"GraphQLID"},
		})

		result.Interfaces = []*interfaceType{
			{
				Exported: false,
				Name:     fmt.Sprintf("%sResponse", actionPrefix),
				Fields: []*interfaceField{
					{
						Name:      fmt.Sprintf("deleted%sID", nodeInfo.Node),
						Type:      "ID",
						UseImport: true,
					},
				},
			},
		}
	}

	return result
}

func buildActionFieldConfig(nodeData *schema.NodeData, action action.Action, actionPrefix string) *fieldConfig {
	argImports := []string{
		action.GetActionName(),
	}
	var argName string
	if action.MutatingExistingObject() {
		argName = fmt.Sprintf("custom%sInput", actionPrefix)
	} else {
		argName = getInputName(action)
		argImports = append(argImports, argName)
	}
	result := &fieldConfig{
		Exported:         true,
		Name:             fmt.Sprintf("%sType", actionPrefix),
		Arg:              fmt.Sprintf("{ [input: string]: %s}", argName),
		ResolveMethodArg: "{ input }",
		TypeImports: []string{
			"GraphQLNonNull",
			fmt.Sprintf("%sResponseType", actionPrefix),
		},
		// TODO these are just all imports, we don't care where from
		ArgImports: argImports,
		Args: []*fieldConfigArg{
			{
				Name: "input",
				Imports: []string{
					"GraphQLNonNull",
					fmt.Sprintf("%sInputType", actionPrefix),
				},
			},
		},
		ReturnTypeHint: fmt.Sprintf("Promise<%sResponse>", actionPrefix),
	}

	if action.GetOperation() == ent.CreateAction {
		result.FunctionContents = append(
			result.FunctionContents,
			// we need fields like userID here which aren't exposed to graphql but editable...
			fmt.Sprintf("let %s = await %s.create(context.getViewer(), {", nodeData.NodeInstance, action.GetActionName()),
		)
		for _, f := range action.GetFields() {
			// we need fields like userID here which aren't exposed to graphql but editable...
			if f.EditableField() {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("%s: input.%s,", f.TsFieldName(), f.TsFieldName()),
				)
			}
		}
		result.FunctionContents = append(result.FunctionContents, "}).saveX();")

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
		)
	} else if action.GetOperation() == ent.DeleteAction {
		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("await %s.saveXFromID(context.getViewer(), input.%sID);", action.GetActionName(), nodeData.NodeInstance),
		)

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {deleted%sID: input.%sID};", nodeData.Node, nodeData.NodeInstance),
		)
	} else {
		// some kind of editing
		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("let %s = await %s.saveXFromID(context.getViewer(), input.%sID, {", nodeData.NodeInstance, action.GetActionName(), nodeData.NodeInstance),
		)
		for _, f := range action.GetFields() {
			if f.ExposeToGraphQL() && f.EditableField() {
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("%s: input.%s,", f.TsFieldName(), f.TsFieldName()),
				)
			}
		}
		result.FunctionContents = append(result.FunctionContents, "});")

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
		)
	}

	return result
}

type objectType struct {
	Type     string
	Node     string
	Fields   []*fieldType
	Exported bool
	GQLType  string // GraphQLObjectType or GraphQLInputObjectType

	DefaultImports []*fileImport
	Imports        []*fileImport
	Interfaces     []*interfaceType
}

type fieldType struct {
	Name               string
	HasResolveFunction bool
	HasAsyncModifier   bool
	Description        string
	FieldImports       []string

	// no args for now. come back.
	FunctionContents string // TODO
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
	return typeFromImports(f.FieldImports)
}

type fileImport struct {
	ImportPath string
	Type       string
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

func getQueryData(data *codegen.Data) []rootField {
	var results []rootField
	for key := range data.Schema.Nodes {

		nodeData := data.Schema.Nodes[key].NodeData
		if nodeData.HideFromGraphQL {
			continue
		}
		results = append(results, rootField{
			ImportPath: fmt.Sprintf("./%s_type", nodeData.PackageName),
			Type:       fmt.Sprintf("%sQuery", nodeData.Node),
			Name:       strcase.ToLowerCamel(nodeData.Node),
		})
	}

	// sort lexicographically so that we are not always changing this
	sort.Slice(results, func(i, j int) bool {
		return results[i].Name < results[j].Name
	})
	return results
}

func getMutationData(data *codegen.Data, s *gqlSchema) []rootField {
	var results []rootField
	for key := range data.Schema.Nodes {

		nodeData := data.Schema.Nodes[key].NodeData
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
		//		spew.Dump("node field", node.Field)
		mutation := node.Field
		// TODO import path not registering well...
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

func writeQueryFile(data *codegen.Data) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlRootData{
			RootFields: getQueryData(data),
			Type:       "QueryType",
			Node:       "Query",
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/root.tmpl"),
		TemplateName:      "root.tmpl",
		PathToFile:        getQueryFilePath(),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func writeMutationFile(data *codegen.Data, s *gqlSchema) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlRootData{
			RootFields: getMutationData(data, s),
			Type:       "MutationType",
			Node:       "Mutation",
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/root.tmpl"),
		TemplateName:      "root.tmpl",
		PathToFile:        getMutationFilePath(),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func generateSchemaFile(hasMutations bool) error {
	filePath := getTempSchemaFilePath()

	err := writeSchemaFile(filePath, hasMutations)

	defer os.Remove(filePath)
	if err != nil {
		return errors.Wrap(err, "error writing temporary schema file")
	}

	cmd := exec.Command("ts-node", "-r", "tsconfig-paths/register", filePath)
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

func writeSchemaFile(fileToWrite string, hasMutations bool) error {
	imps := tsimport.NewImports()

	return file.Write(
		&file.TemplatedBasedFileWriter{
			Data: schemaData{
				QueryPath:    getQueryFilePath(),
				MutationPath: getMutationFilePath(),
				HasMutations: hasMutations,
				SchemaPath:   getSchemaFilePath(),
			},
			AbsPathToTemplate: util.GetAbsolutePath("generate_schema.tmpl"),
			TemplateName:      "generate_schema.tmpl",
			PathToFile:        fileToWrite,
			TsImports:         imps,
			FormatSource:      true,
			CreateDirIfNeeded: true,
			FuncMap:           imps.FuncMap(),
		},
		file.DisableLog(),
	)
}
