package graphql

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/tsimport"
)

type processCustomRoot interface {
	process(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error
	getFilePath(*codegen.Processor, string) string
	getArgObject(cd *CustomData, arg CustomItem) *CustomObject
	getFields(cd *CustomData) []CustomField
	buildFieldConfig(processor *codegen.Processor, cd *CustomData, s *gqlSchema, field CustomField) (*fieldConfig, error)
}

type customMutationsProcesser struct {
}

func (cm *customMutationsProcesser) process(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	arr, err := processFields(processor, cd, s, cm)
	if err != nil {
		return err
	}

	if len(arr) > 0 {
		// flag this appropriately
		s.hasMutations = true
		s.customMutations = arr
	}

	return nil
}

func (cm *customMutationsProcesser) getFilePath(p *codegen.Processor, gqlName string) string {
	return getFilePathForCustomMutation(p.Config, gqlName)
}

func (cm *customMutationsProcesser) getArgObject(cd *CustomData, arg CustomItem) *CustomObject {
	return cd.Inputs[arg.Type]
}

func (cm *customMutationsProcesser) getFields(cd *CustomData) []CustomField {
	return cd.Mutations
}

func (cm *customMutationsProcesser) buildFieldConfig(processor *codegen.Processor, cd *CustomData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	b := &mutationFieldConfigBuilder{
		field:     field,
		filePath:  cm.getFilePath(processor, field.GraphQLName),
		cd:        cd,
		processor: processor,
	}

	for _, arg := range field.Args {
		if arg.IsContextArg {
			continue
		}
		if arg.Name == "input" {
			b.inputArg = &arg
		}
	}
	return b.build(processor, cd, s, field)
}

type customQueriesProcesser struct {
}

func (cq *customQueriesProcesser) process(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	arr, err := processFields(processor, cd, s, cq)
	s.customQueries = arr

	return err
}

func (cq *customQueriesProcesser) getFilePath(processor *codegen.Processor, gqlName string) string {
	return getFilePathForCustomQuery(processor.Config, gqlName)
}

func (cq *customQueriesProcesser) getArgObject(cd *CustomData, arg CustomItem) *CustomObject {
	return cd.Args[arg.Type]
}

func (cq *customQueriesProcesser) getFields(cd *CustomData) []CustomField {
	return cd.Queries
}

func (cq *customQueriesProcesser) buildFieldConfig(processor *codegen.Processor, cd *CustomData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	b := &queryFieldConfigBuilder{
		field,
		cq.getFilePath(processor, field.GraphQLName),
		processor,
	}
	return b.build(processor, cd, s, field)
}

func processFields(processor *codegen.Processor, cd *CustomData, s *gqlSchema, cr processCustomRoot) ([]*gqlNode, error) {
	var result []*gqlNode
	fields := cr.getFields(cd)

	for idx := range fields {
		// field having weird issues unless broken down like this
		field := fields[idx]
		nodeName := field.Node

		if field.Node != "" {
			class := cd.Classes[nodeName]
			if class == nil {
				return nil, fmt.Errorf("mutation/query %s with class %s not found", field.GraphQLName, nodeName)
			}

			if !class.Exported {
				return nil, fmt.Errorf("resolver class %s needs to be exported", class.Name)
			}
		} else if field.FunctionContents == "" {
			return nil, fmt.Errorf("cannot have a field %s with no NodeName and no inline function contents", field.GraphQLName)

		}

		var objTypes []*objectType

		// TODO we want an option for namespace for folders but for now ignore
		filePath := cr.getFilePath(processor, field.GraphQLName)

		// let's try and make this generic enough to work for input type and standard args...
		// and have graphql complain if not valid types at the end here

		// should we build an interface for this custom object?
		createInterface := false
		intType := newInterfaceType(&interfaceType{
			Name: names.ToClassType(field.GraphQLName, "Args"),
		})
		for _, arg := range field.Args {
			// nothing to do with context args yet
			if arg.IsContextArg {
				continue
			}

			// need to build input type
			// TODO for now we assume inputtype is 1:1, that's not going to remain the same forever...
			argObj := cr.getArgObject(cd, arg)
			typ := knownTsTypes[arg.Type]
			// TODO use input.Field.GetEntType()
			if typ == "" {
				typ = "any"
			} else {
				if arg.Connection {
					typ = "any"
				} else {
					if arg.List {
						typ = typ + "[]"
					}
					if arg.Nullable == NullableTrue {
						typ = typ + " | null"
					}
				}
			}
			if argObj == nil {
				createInterface = true
				if err := intType.addField(&interfaceField{
					Name: arg.Name,
					Type: typ,
					//
					// arg.TSType + add to import so we can useImport
					//					UseImport: true,
				}); err != nil {
					return nil, err
				}
				continue
			}
			// not always going to be GraphQLInputObjectType (for queries)
			argType, err := buildObjectType(processor, cd, s, arg, argObj, filePath, "GraphQLInputObjectType")
			if err != nil {
				return nil, err
			}
			objTypes = append(objTypes, argType)
			s.nestedCustomTypes[argType.Node] = filePath
		}

		for _, result := range field.Results {
			// 0 -1 allowed...
			object := cd.Objects[result.Type]
			if object == nil {
				continue
			}

			payloadType, err := buildObjectType(processor, cd, s, result, object, filePath, "GraphQLObjectType")
			if err != nil {
				return nil, err
			}

			cls := cd.Classes[field.Node]
			if cls != nil {
				importPath, err := getRelativeImportPath(processor, filePath, cls.Path)
				if err != nil {
					return nil, err
				}
				if cls.DefaultExport {
					payloadType.DefaultImports = append(payloadType.DefaultImports, &tsimport.ImportPath{
						ImportPath: importPath,
						Import:     field.Node,
					})
				} else {
					payloadType.Imports = append(payloadType.Imports, &tsimport.ImportPath{
						ImportPath: importPath,
						Import:     field.Node,
					})
				}
			}
			s.nestedCustomTypes[payloadType.Node] = filePath
			objTypes = append(objTypes, payloadType)
		}

		fieldConfig, err := cr.buildFieldConfig(processor, cd, s, field)
		if err != nil {
			return nil, err
		}
		// take connection here and add to result...
		var connections []*gqlConnection
		if fieldConfig.connection != nil {
			connections = append(connections, fieldConfig.connection)
		}

		var interfaces []*interfaceType
		if createInterface {
			interfaces = append(interfaces, intType)
		}
		// here...
		result = append(result, &gqlNode{
			ObjData: &gqlobjectData{
				interfaces: interfaces,
				// TODO kill node and NodeInstance they don't make sense here...
				Node:        field.Node,
				GQLNodes:    objTypes,
				FieldConfig: fieldConfig,
				Package:     processor.Config.GetImportPackage(),
			},
			FilePath:    filePath,
			Field:       &field,
			connections: connections,
		})
	}

	return result, nil
}

type fieldConfigBuilder interface {
	build(processor *codegen.Processor, cd *CustomData, s *gqlSchema, field CustomField) (*fieldConfig, error)
	getArg() string
	getName() string
	getResolveMethodArg() string
	getTypeImports(processor *codegen.Processor, cd *CustomData, s *gqlSchema) []*tsimport.ImportPath
	getArgs(s *gqlSchema) []*fieldConfigArg
	getReturnTypeHint() string
	getArgMap(cd *CustomData) map[string]*CustomObject
	getFilePath() string
}

type mutationFieldConfigBuilder struct {
	field     CustomField
	filePath  string
	cd        *CustomData
	inputArg  *CustomItem
	processor *codegen.Processor
}

func (mfcg *mutationFieldConfigBuilder) getName() string {
	return names.ToClassType(mfcg.field.GraphQLName, "Type")
}

func (mfcg *mutationFieldConfigBuilder) build(processor *codegen.Processor, cd *CustomData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	return buildFieldConfigFrom(mfcg, processor, s, cd, field)
}

func (mfcg *mutationFieldConfigBuilder) getFilePath() string {
	return mfcg.filePath
}

func (mfcg *mutationFieldConfigBuilder) getArg() string {
	// for input object type, type it
	if mfcg.inputArg != nil {
		return fmt.Sprintf("{ [input: string]: %s}", mfcg.inputArg.Type)
	}

	return mfcg.field.getArg()
}

func (mfcg *mutationFieldConfigBuilder) getResolveMethodArg() string {
	if mfcg.inputArg != nil {
		return "{ input }"
	}

	return mfcg.field.getResolveMethodArg()
}

func (mfcg *mutationFieldConfigBuilder) getTypeImports(processor *codegen.Processor, cd *CustomData, s *gqlSchema) []*tsimport.ImportPath {
	if len(mfcg.field.Results) != 1 {
		panic(fmt.Errorf("invalid number of results for custom field %s", mfcg.field.FunctionName))
	}
	r := mfcg.field.Results[0]
	// use the initialized imports to seed this
	// TODO use s.getImports and make these be consistent
	// https://github.com/lolopinto/ent/issues/240
	if err := r.initialize(); err != nil {
		panic(err)
	}
	var ret = r.imports[:]

	imp := s.getImportFor(processor, r.Type, true)
	if imp != nil {
		ret = append(ret, imp)
	} else {
		ret = append(ret, &tsimport.ImportPath{
			// local import file which exists in the same file
			// i.e. UserAuthPayload -> UserAuthPayloadType
			// UserAuthLogin -> UserAuthLoginType
			Import:     names.ToClassType(r.Type, "Type"),
			ImportPath: "",
		})
	}

	return ret
}

func (mfcg *mutationFieldConfigBuilder) getArgs(s *gqlSchema) []*fieldConfigArg {
	if mfcg.inputArg != nil {
		argType := s.getNodeNameFor(mfcg.inputArg.Type)
		return []*fieldConfigArg{
			{
				Name: "input",
				Imports: []*tsimport.ImportPath{
					tsimport.NewGQLClassImportPath("GraphQLNonNull"),
					// same for this about passing it in
					{
						Import: argType + "Type",
					},
				},
			},
		}
	}
	return getFieldConfigArgs(mfcg.processor, mfcg.field, s, true)
}

func (mfcg *mutationFieldConfigBuilder) getReturnTypeHint() string {
	if mfcg.inputArg != nil {
		// only add a type hint if we know for sure we have a type that's a custom object
		// TODO ola 2/29/2024. should we always assume Payload?
		obj := mfcg.field.Results[0]
		if mfcg.cd.Objects[obj.Type] == nil {
			return ""
		}
		typ := names.ToClassType(mfcg.field.GraphQLName, "Payload")
		return fmt.Sprintf("Promise<%s>", typ)
	}
	return ""
}

func (mfcg *mutationFieldConfigBuilder) getArgMap(cd *CustomData) map[string]*CustomObject {
	return cd.Inputs
}

type queryFieldConfigBuilder struct {
	field     CustomField
	filePath  string
	processor *codegen.Processor
}

func (qfcg *queryFieldConfigBuilder) getName() string {
	return names.ToClassType(qfcg.field.GraphQLName, "QueryType")
}

func (qfcg *queryFieldConfigBuilder) build(processor *codegen.Processor, cd *CustomData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	return buildFieldConfigFrom(qfcg, processor, s, cd, field)
}

func (qfcg *queryFieldConfigBuilder) getFilePath() string {
	return qfcg.filePath
}

func (qfcg *queryFieldConfigBuilder) getArg() string {
	return qfcg.field.getArg()
}

func (qfcg *queryFieldConfigBuilder) getResolveMethodArg() string {
	return qfcg.field.getResolveMethodArg()
}

func (qfcg *queryFieldConfigBuilder) getTypeImports(processor *codegen.Processor, cd *CustomData, s *gqlSchema) []*tsimport.ImportPath {
	if len(qfcg.field.Results) != 1 {
		panic("invalid number of results for custom field")
	}

	if qfcg.field.Connection {
		return getGQLFileImports(getRootGQLEdge(processor.Config, qfcg.field).GetTSGraphQLTypeImports(), false)
	}
	r := qfcg.field.Results[0]

	// use the initialized imports to seed this
	// TODO use s.getImports and make these be consistent
	// https://github.com/lolopinto/ent/issues/240
	if err := r.initialize(); err != nil {
		panic(err)
	}
	var ret = r.imports[:]

	importType := s.getNodeNameFor(r.Type)
	imp := s.getImportFor(processor, importType, false)
	if imp != nil {
		ret = append(ret, imp)
	} else {
		// new type
		ret = append(ret, &tsimport.ImportPath{
			Import: fmt.Sprintf("%sType", importType),
			//		ImportPath is local here
		})
	}

	return ret
}

func getFieldConfigArgs(processor *codegen.Processor, field CustomField, s *gqlSchema, mutation bool) []*fieldConfigArg {
	return getFieldConfigArgsFrom(processor, field.Args, s, mutation)
}

// if s is nil, we only check knownTypes to see if arg.Type
// matches, otherwise, no type given for that...
func getFieldConfigArgsFrom(processor *codegen.Processor, args []CustomItem, s *gqlSchema, mutation bool) []*fieldConfigArg {
	var ret []*fieldConfigArg
	for _, arg := range args {
		if arg.IsContextArg {
			continue
		}

		// use the initialized imports to seed this
		// TODO use s.getImports and make these be consistent
		// https://github.com/lolopinto/ent/issues/240
		if err := arg.initialize(); err != nil {
			panic(err)
		}

		var imp *tsimport.ImportPath

		if s != nil {
			importType := s.getNodeNameFor(arg.Type)
			imp = s.getImportFor(processor, importType, mutation)
			if imp == nil {
				// local
				imp = &tsimport.ImportPath{
					Import: importType,
				}
			}
		} else {
			imp = knownTypes[arg.Type]
			if imp == nil {
				if processor.Config.DebugMode() {
					fmt.Printf("couldn't find type for custom arg %s. maybe a bug with codegen?", arg.Type)
				}
			}
		}

		var imports []*tsimport.ImportPath
		if imp != nil {
			imports = arg.imports[:]
			imports = append(imports, imp)
		}

		ret = append(ret, &fieldConfigArg{
			// need flag of arg passed to function
			Name:    arg.Name,
			Imports: imports,
		})
	}
	return ret
}

func (qfcg *queryFieldConfigBuilder) getArgs(s *gqlSchema) []*fieldConfigArg {
	return getFieldConfigArgs(qfcg.processor, qfcg.field, s, false)
}

func (qfcg *queryFieldConfigBuilder) getReturnTypeHint() string {
	// no type hint for now
	return ""
}

func (qfcg *queryFieldConfigBuilder) getArgMap(cd *CustomData) map[string]*CustomObject {
	return cd.Args
}

func buildFieldConfigFrom(builder fieldConfigBuilder, processor *codegen.Processor, s *gqlSchema, cd *CustomData, field CustomField) (*fieldConfig, error) {
	var argImports []*tsimport.ImportPath

	if field.Connection {
		argImports = append(argImports, tsimport.NewEntGraphQLImportPath("GraphQLEdgeConnection"))
	}

	// args that "useImport" should be called on
	// assumes they're reserved somewhere else...

	addToArgImport := func(typ string) error {
		cls := cd.Classes[typ]
		if cls != nil && cls.Exported {
			path, err := getRelativeImportPath(processor, builder.getFilePath(), cls.Path)
			if err != nil {
				return err
			}
			argImports = append(argImports, &tsimport.ImportPath{
				Import:     typ,
				ImportPath: path,
			})
		}
		return nil
	}
	for _, arg := range field.Args {
		if arg.IsContextArg {
			continue
		}
		if err := addToArgImport(arg.Type); err != nil {
			return nil, err
		}
	}

	inlineContents := field.FunctionContents != ""

	if field.Node != "" {
		if err := addToArgImport(field.Node); err != nil {
			return nil, err
		}
	}

	// only add return type if we have a type hint
	if builder.getReturnTypeHint() != "" {
		for _, result := range field.Results {
			if err := addToArgImport(result.Type); err != nil {
				return nil, err
			}
		}
	}

	var conn *gqlConnection

	var functionContents []string
	argMap := builder.getArgMap(cd)

	getConnection := func(s string) (*gqlConnection, string) {
		// nodeName is root or something...
		customEdge := getRootGQLEdge(processor.Config, field)
		// RootQuery?
		conn := getGqlConnection("root", customEdge, processor)

		return conn, fmt.Sprintf(
			"return new GraphQLEdgeConnection(context.getViewer(), (v) => %s, args);",
			s,
		)
	}

	if inlineContents {
		contents := field.FunctionContents
		for _, arg := range field.Args {
			argType := argMap[arg.Type]
			if argType == nil {
				contents, imps := arg.renderArg(processor.Config, s)
				defaultArg := arg.defaultArg()
				if contents != defaultArg {
					// arg changed, so assign new value before inline contents
					// so we don't have to change the generated code
					functionContents = append(functionContents,
						fmt.Sprintf("%s=%s;", defaultArg, contents),
					)
				}
				argImports = append(argImports, imps...)
			}
		}
		if field.Connection {
			conn2, call := getConnection(fmt.Sprintf("{%s}", contents))
			conn = conn2

			functionContents = append(
				functionContents,
				call,
			)
		} else {
			functionContents = append(functionContents, contents)
		}
	} else {
		var argContents []string
		for _, arg := range field.Args {
			if arg.GraphQLOnlyArg {
				continue
			}
			if arg.IsContextArg {
				argContents = append(argContents, "context")
				continue
			}
			argType := argMap[arg.Type]
			if argType == nil {
				contents, imps := arg.renderArg(processor.Config, s)
				argContents = append(argContents, contents)
				argImports = append(argImports, imps...)
			} else {
				fields, ok := cd.Fields[arg.Type]
				if !ok {
					return nil, fmt.Errorf("type %s has no fields", arg.Type)
				}
				args := make([]string, len(fields))

				for idx, f := range fields {
					// input.foo
					args[idx] = fmt.Sprintf("%s:%s.%s", f.GraphQLName, arg.Name, f.GraphQLName)
				}
				argContents = append(argContents, fmt.Sprintf("{%s},", strings.Join(args, ",")))
			}
		}
		functionCall := fmt.Sprintf("r.%s(%s)", field.FunctionName, strings.Join(argContents, ","))

		functionContents = []string{
			fmt.Sprintf("const r = new %s();", field.Node),
		}

		if field.Connection {
			conn2, call := getConnection(functionCall)
			conn = conn2

			functionContents = append(
				functionContents,
				call,
			)
		} else {
			functionContents = append(functionContents, fmt.Sprintf("return %s;", functionCall))
		}
	}

	// fieldConfig can have connection
	result := &fieldConfig{
		Exported:         true,
		Name:             builder.getName(),
		Description:      field.Description,
		Arg:              builder.getArg(),
		ResolveMethodArg: builder.getResolveMethodArg(),
		TypeImports:      builder.getTypeImports(processor, cd, s),
		ArgImports:       argImports,
		// reserve and use them. no questions asked
		ReserveAndUseImports: field.ExtraImports,
		Args:                 builder.getArgs(s),
		ReturnTypeHint:       builder.getReturnTypeHint(),
		connection:           conn,
		FunctionContents:     functionContents,
	}

	return result, nil
}

func buildObjectTypeImpl(item CustomItem, obj *CustomObject, gqlType string, isTypeOf bool) *objectType {
	// TODO right now it depends on custom inputs and outputs being FooInput and FooPayload to work
	// we shouldn't do that and we should be smarter
	// maybe add PayloadType if no Payload suffix otherwise Payload. Same for InputType and Input
	typ := newObjectType(&objectType{
		Type:     fmt.Sprintf("%sType", obj.NodeName),
		Node:     obj.NodeName,
		TSType:   item.Type,
		Exported: true,
		// input or object type
		GQLType: gqlType,
	})
	for _, inter := range obj.Interfaces {
		typ.Imports = append(typ.Imports, tsimport.NewLocalGraphQLEntImportPath(inter))
		typ.GQLInterfaces = append(typ.GQLInterfaces, inter+"Type")
	}

	if isTypeOf && typ.GQLType == "GraphQLObjectType" {
		typ.IsTypeOfMethod = []string{
			fmt.Sprintf("return obj instanceof %s", item.Type),
		}
	}
	return typ
}

func maybeAddCustomImport(processor *codegen.Processor, cd *CustomData, typ *objectType, destPath, importedType string) error {
	cls := cd.Classes[importedType]
	if cls != nil {
		importPath, err := getRelativeImportPath(processor, destPath, cls.Path)
		if err != nil {
			return err
		}
		if cls.DefaultExport {

			// exported, we need to import it
			typ.DefaultImports = append(typ.DefaultImports, &tsimport.ImportPath{
				ImportPath: importPath,
				Import:     importedType,
			})
		} else if cls.Exported {
			typ.Imports = append(typ.Imports, &tsimport.ImportPath{
				ImportPath: importPath,
				Import:     importedType,
			})
		} else {
			return fmt.Errorf("class %s is not exported and objects referenced need to be exported", importedType)
		}
	}
	return nil
}

func buildObjectType(processor *codegen.Processor, cd *CustomData, s *gqlSchema, item CustomItem, obj *CustomObject, destPath, gqlType string) (*objectType, error) {
	// TODO right now it depends on custom inputs and outputs being FooInput and FooPayload to work
	// we shouldn't do that and we should be smarter
	// maybe add PayloadType if no Payload suffix otherwise Payload. Same for InputType and Input
	typ := buildObjectTypeImpl(item, obj, gqlType, true)

	s.seenCustomObjects[item.Type] = true

	fields, ok := cd.Fields[item.Type]
	if !ok {
		return nil, fmt.Errorf("type %s has no fields", item.Type)
	}

	for _, f := range fields {
		// maybe we'll care for input vs Payload here at some point
		gqlField, err := getCustomGQLField(processor, cd, f, s, "obj")
		if err != nil {
			return nil, err
		}
		if err := typ.addField(gqlField); err != nil {
			return nil, err
		}
		typ.Imports = append(typ.Imports, gqlField.FieldImports...)
	}

	err := maybeAddCustomImport(processor, cd, typ, destPath, item.Type)
	if err != nil {
		return nil, err
	}

	return typ, nil
}

func getRelativeImportPath(processor *codegen.Processor, basepath, targetpath string) (string, error) {
	// convert from absolute path to relative path
	// and then depend on getImportPath() in internal/tsimport/path.go to convert to relative
	// paths if need be
	rel, err := filepath.Rel(processor.Config.GetAbsPathToRoot(), targetpath)
	if err != nil {
		return "", err
	}

	return strings.TrimSuffix(rel, ".ts"), nil
}

func processCustomFields(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	for nodeName, fields := range cd.Fields {
		if cd.Inputs[nodeName] != nil {
			continue
		}

		if cd.Objects[nodeName] != nil || cd.Interfaces[nodeName] != nil || cd.Args[nodeName] != nil {
			continue
		}

		nodeInfo := s.nodes[nodeName]
		customEdge := s.edgeNames[nodeName]

		var obj *objectType
		instance := "obj"
		var nodeData *schema.NodeData
		if nodeInfo != nil {
			objData := nodeInfo.ObjData
			nodeData = objData.NodeData
			// always has a node for now
			obj = objData.GQLNodes[0]
		} else if customEdge {
			// create new obj
			obj = newObjectType(&objectType{
				GQLType: "GraphQLObjectType",
				// needed to reference the edge
				TSType: fmt.Sprintf("GraphQLEdge<%s>", nodeName),
				Node:   nodeName,
			})
			s.customEdges[nodeName] = obj
			// the edge property of GraphQLEdge is where the processor is
			instance = "edge.edge"
		} else {
			return fmt.Errorf("can't find %s node that has custom fields", nodeName)
		}

		for _, field := range fields {
			if field.Connection {
				customEdge := getGQLEdge(processor.Config, field, nodeName)
				nodeInfo.connections = append(nodeInfo.connections, getGqlConnection(nodeData.PackageName, customEdge, processor))
				if err := addConnection(processor, nodeData, customEdge, obj, &field, s); err != nil {
					return err
				}
				continue
			}

			gqlField, err := getCustomGQLField(processor, cd, field, s, instance)
			if err != nil {
				return err
			}
			// append the field
			if err := obj.addField(gqlField); err != nil {
				return err
			}
			for _, imp := range gqlField.FieldImports {
				imported := false
				// TODO change this to allow multiple imports and the reserveImport system handles this
				// this is just a temporary fix...
				for _, obImp := range obj.Imports {
					if imp.Import == obImp.Import {
						imported = true
						break
					}
				}
				if !imported {
					obj.Imports = append(obj.Imports, imp)
				}
			}
			//			obj.Imports = append(obj.Imports, gqlField.FieldImports...)

			// check if we have a new custom field to add
			// because we're currently adding to current file, it can get lost
			for _, result := range field.Results {

				customObj := cd.Objects[result.Type]
				if customObj == nil {
					continue
				}

				if nodeInfo == nil {
					return fmt.Errorf("custom objects not referenced in top level queries and mutations can only be referenced in ent nodes")
				}

				objFilePath := getFilePathForCustomInterfaceFile(processor.Config, customObj.NodeName)
				objType, err := buildObjectType(processor, cd, s, result, customObj, objFilePath, "GraphQLObjectType")
				if err != nil {
					return err
				}
				gqlNode := &gqlNode{
					ObjData: &gqlobjectData{
						Node:     customObj.NodeName,
						GQLNodes: []*objectType{objType},
						Package:  processor.Config.GetImportPackage(),
					},
					FilePath: objFilePath,
				}
				s.otherObjects[customObj.NodeName] = gqlNode

				nodeInfo.ObjData.customDependencyImports = append(nodeInfo.ObjData.customDependencyImports, &tsimport.ImportPath{
					Import:     customObj.NodeName + "Type",
					ImportPath: codepath.GetImportPathForInternalGQLFile(),
				})
			}
		}
	}
	return nil
}

func isConnection(field *CustomField) bool {
	if len(field.Results) != 1 {
		return false
	}
	return field.Results[0].Connection
}

// should be obj except if it's nested...
// eg obj.edge for edges
func getCustomGQLField(processor *codegen.Processor, cd *CustomData, field CustomField, s *gqlSchema, instance string) (*fieldType, error) {
	if field.Connection {
		return nil, fmt.Errorf("field is a connection. this should be handled elsewhere")
	}
	imports, err := getGraphQLImportsForField(processor, cd, field, s)
	if err != nil {
		return nil, err
	}
	gqlField := &fieldType{
		Name:               field.GraphQLName,
		HasResolveFunction: false,
		FieldImports:       imports,
		Description:        field.Description,
	}

	var args []string
	for _, arg := range field.Args {
		if arg.IsContextArg {
			args = append(args, "context")
			continue
		}
		args = append(args, fmt.Sprintf("args.%s", arg.Name))

		cfgArg := &fieldConfigArg{
			Name: arg.Name,
		}

		imps, err := arg.getImports(processor, s, cd)
		if err != nil {
			return nil, err
		}
		cfgArg.Imports = append(cfgArg.Imports, imps...)

		gqlField.Args = append(gqlField.Args, cfgArg)
	}

	switch field.FieldType {
	case Accessor, Field:
		// for an accessor or field, we only add a resolve function if named differently
		// or if the instance is something like edge.edge
		if field.GraphQLName != field.FunctionName || strings.Contains(instance, ".") {
			gqlField.HasResolveFunction = true
			gqlField.FunctionContents = []string{
				fmt.Sprintf("return %s.%s;", instance, field.FunctionName),
			}
		}

	case Function, AsyncFunction:
		gqlField.HasAsyncModifier = field.FieldType == AsyncFunction
		gqlField.HasResolveFunction = true
		gqlField.FunctionContents = []string{
			fmt.Sprintf("return %s.%s(%s);", instance, field.FunctionName, strings.Join(args, ",")),
		}
	}

	return gqlField, nil
}

func processCustomMutations(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	cm := &customMutationsProcesser{}
	return cm.process(processor, cd, s)
}

func processCustomQueries(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	cq := &customQueriesProcesser{}
	return cq.process(processor, cd, s)
}

func processCustomEnum(processor *codegen.Processor, s *gqlSchema, typ *CustomType) error {
	// todo type tstype empty
	tsType := typ.TSType
	if tsType == "" {
		tsType = typ.Type
	}

	_, gql := enum.GetEnums(&enum.Input{
		EnumMap:            typ.EnumMap,
		TSName:             tsType,
		GQLName:            typ.Type,
		GQLType:            typ.Type + "Type",
		DisableUnknownType: true,
	})
	if s.enums[gql.Type] != nil {
		return fmt.Errorf("enum name %s already exists", gql.Type)
	}

	path := getFilePathForEnums(processor.Config)
	if typ.InputType {
		path = getFilePathForEnumInput(processor.Config)

	}
	s.enums[gql.Type] = &gqlEnum{
		Type:     gql.Type,
		Enum:     gql,
		FilePath: path,
	}
	return nil
}

func processCustomStructType(processor *codegen.Processor, s *gqlSchema, typ *CustomType) error {
	// technically not a CI but whatever
	var filePath string
	var gqlType string
	if typ.InputType {
		filePath = getFilePathForCustomInterfaceInputFile(processor.Config, typ.Type)
		gqlType = "GraphQLInputObjectType"
	} else {
		filePath = getFilePathForCustomInterfaceFile(processor.Config, typ.Type)
		gqlType = "GraphQLObjectType"
	}

	obj := &CustomObject{
		NodeName: typ.Type,
	}
	item := CustomItem{
		Type: typ.Type,
	}
	objType := buildObjectTypeImpl(item, obj, gqlType, false)

	fi, err := field.NewFieldInfoFromInputs(processor.Config, "Root", typ.StructFields, &field.Options{})
	if err != nil {
		return err
	}

	var customInt *interfaceType
	// don't need it for input types, create for non-input type
	if !typ.InputType {
		customInt = newInterfaceType(&interfaceType{
			Exported: false,
			Name:     item.Type,
		})
	}

	for _, field := range fi.AllFields() {

		imports := field.GetTSGraphQLTypeForFieldImports(true)
		gqlField := &fieldType{
			Name:               field.GetGraphQLName(),
			HasResolveFunction: false,
			FieldImports:       imports,
		}
		if err := objType.addField(gqlField); err != nil {
			return err
		}
		objType.Imports = append(objType.Imports, gqlField.FieldImports...)

		var useImports []string
		imps := field.GetTsTypeImports()
		if len(imps) != 0 {
			objType.Imports = append(objType.Imports, imps...)
			for _, v := range imps {
				useImports = append(useImports, v.Import)
			}
		}
		intField := &interfaceField{
			Name:       field.GetGraphQLName(),
			Optional:   field.Nullable(),
			Type:       field.GetTsType(),
			UseImports: useImports,
		}

		if customInt != nil {
			if err := customInt.addField(intField); err != nil {
				return err
			}
		}
	}

	if customInt != nil {
		objType.TSInterfaces = append(objType.TSInterfaces, customInt)
	}

	gqlNode := &gqlNode{
		ObjData: &gqlobjectData{
			Node:     obj.NodeName,
			GQLNodes: []*objectType{objType},
			Package:  processor.Config.GetImportPackage(),
		},
		FilePath: filePath,
	}
	s.otherObjects[obj.NodeName] = gqlNode
	return nil
}

func processCusomTypes(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	for _, typ := range cd.CustomTypes {
		if len(typ.EnumMap) != 0 {
			if err := processCustomEnum(processor, s, typ); err != nil {
				return err
			}
		}

		if len(typ.StructFields) != 0 {
			if err := processCustomStructType(processor, s, typ); err != nil {
				return err
			}
		}
	}
	return nil
}

func processCustomUnions(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	for _, union := range cd.Unions {
		if s.unions[union.NodeName] != nil {
			return fmt.Errorf("union name %s already exists", union.NodeName)
		}

		obj := newObjectType(&objectType{
			// TODO have to make sure this is unique
			Type:     fmt.Sprintf("%sType", union.NodeName),
			Node:     union.NodeName,
			TSType:   union.ClassName,
			GQLType:  "GraphQLUnionType",
			Exported: true,
		})

		unionTypes := make([]string, len(union.UnionTypes))
		imports := make([]*tsimport.ImportPath, len(union.UnionTypes))
		// sort to make sure it's deterministic
		sort.Strings(union.UnionTypes)
		for i, unionType := range union.UnionTypes {
			unionTypes[i] = fmt.Sprintf("%sType", unionType)
			imports[i] = tsimport.NewLocalGraphQLEntImportPath(unionType)
		}
		obj.UnionTypes = unionTypes
		obj.Imports = imports

		node := &gqlNode{
			ObjData: &gqlobjectData{
				Node:     union.NodeName,
				GQLNodes: []*objectType{obj},
				Package:  processor.Config.GetImportPackage(),
			},
			FilePath: getFilePathForUnionInterfaceFile(processor.Config, union.NodeName),
		}
		s.unions[union.NodeName] = node
	}
	return nil
}

func processCustomInterfaces(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	interfaces := make(map[string]*gqlNode)
	for _, inter := range cd.Interfaces {
		obj := newObjectType(&objectType{
			// TODO have to make sure this is unique
			Type:     fmt.Sprintf("%sType", inter.NodeName),
			Node:     inter.NodeName,
			GQLType:  "GraphQLInterfaceType",
			TSType:   inter.NodeName,
			Exported: true,
		})

		fields, ok := cd.Fields[inter.NodeName]
		if !ok {
			return fmt.Errorf("type %s has no fields", inter.NodeName)
		}

		for _, f := range fields {
			gqlField, err := getCustomGQLField(processor, cd, f, s, "obj")
			if err != nil {
				return err
			}
			if err := obj.addField(gqlField); err != nil {
				return err
			}
			obj.Imports = append(obj.Imports, gqlField.FieldImports...)
		}

		filePath := getFilePathForUnionInterfaceFile(processor.Config, inter.NodeName)
		err := maybeAddCustomImport(processor, cd, obj, filePath, inter.NodeName)
		if err != nil {
			return err
		}

		node := &gqlNode{
			ObjData: &gqlobjectData{
				Node:     inter.NodeName,
				GQLNodes: []*objectType{obj},
				Package:  processor.Config.GetImportPackage(),
			},
			FilePath: filePath,
		}
		interfaces[inter.NodeName] = node
	}
	s.interfaces = interfaces
	return nil
}

func processCustomArgs(processor *codegen.Processor, cd *CustomData, s *gqlSchema) error {
	for _, arg := range cd.Args {

		item := CustomItem{
			Type: arg.NodeName,
		}
		filePath := getFilePathForCustomArg(processor.Config, arg.NodeName)

		objType, err := buildObjectType(processor, cd, s, item, arg, filePath, "GraphQLInputObjectType")
		objType.ArgNotInput = true
		if err != nil {
			return err
		}
		gqlNode := &gqlNode{
			ObjData: &gqlobjectData{
				Node:     arg.NodeName,
				GQLNodes: []*objectType{objType},
				Package:  processor.Config.GetImportPackage(),
			},
			FilePath: filePath,
		}
		s.otherObjects[arg.NodeName] = gqlNode
	}

	return nil
}

// clean this up eventually. most custom objects are referenced as part of a mutation or query and are then
// generated in the same file as the mutation or query.
// this is for the custom objects that are not referenced in a mutation or query e.g. not an argument or result
// we go through and create them in their own file
// eventually, we should put all of them in their own file or all in one big file
func processDanglingCustomObject(processor *codegen.Processor, cd *CustomData, s *gqlSchema, obj *CustomObject) error {
	// technically not a CI but whatever
	filePath := getFilePathForCustomInterfaceFile(processor.Config, obj.NodeName)

	item := CustomItem{
		Type: obj.NodeName,
	}
	objType, err := buildObjectType(processor, cd, s, item, obj, filePath, "GraphQLObjectType")
	if err != nil {
		return err
	}

	gqlNode := &gqlNode{
		ObjData: &gqlobjectData{
			Node:     obj.NodeName,
			GQLNodes: []*objectType{objType},
			Package:  processor.Config.GetImportPackage(),
		},
		FilePath: filePath,
	}
	s.otherObjects[obj.NodeName] = gqlNode
	return nil
}

func getGraphQLImportsForField(processor *codegen.Processor, cd *CustomData, f CustomField, s *gqlSchema) ([]*tsimport.ImportPath, error) {
	var imports []*tsimport.ImportPath

	for _, result := range f.Results {

		imps, err := result.getImports(processor, s, cd)
		if err != nil {
			return nil, err
		}
		imports = append(imports, imps...)
	}
	return imports, nil
}

type customGraphQLEdge interface {
	isCustomEdge() bool
}

type CustomEdge struct {
	SourceNodeName string
	EdgeName       string
	graphqlName    string
	Type           string
}

func (e *CustomEdge) isCustomEdge() bool {
	return true
}

func (e *CustomEdge) GetEdgeName() string {
	return e.EdgeName
}

func (e *CustomEdge) GetNodeInfo() nodeinfo.NodeInfo {
	return nodeinfo.GetNodeInfo(e.Type)
}

func (e *CustomEdge) GetEntConfig() *edge.EntConfigInfo {
	return edge.GetEntConfigFromName(e.Type)
}

func (e *CustomEdge) GraphQLEdgeName() string {
	return e.graphqlName
}

func (e *CustomEdge) CamelCaseEdgeName() string {
	return names.ToClassType(e.EdgeName)
}

func (e *CustomEdge) HideFromGraphQL() bool {
	return false
}

func (e *CustomEdge) GetTSGraphQLTypeImports() []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalEntConnectionImportPath(e.GetGraphQLConnectionName()),
	}
}

func (e *CustomEdge) PolymorphicEdge() bool {
	return false
}

func (e *CustomEdge) GetSourceNodeName() string {
	return names.ToClassType(e.SourceNodeName)
}

func (e *CustomEdge) GetGraphQLEdgePrefix() string {
	return names.ToClassType(e.SourceNodeName, "To", e.EdgeName)
}

func (e *CustomEdge) GetGraphQLConnectionName() string {
	return names.ToClassType(e.SourceNodeName, "To", e.EdgeName, "Connection")
}

func (e *CustomEdge) GetGraphQLConnectionType() string {
	return names.ToClassType(e.SourceNodeName, "To", e.EdgeName, "ConnectionType")
}

func (e *CustomEdge) TsEdgeQueryEdgeName() string {
	// For CustomEdge, we only use this with GraphQLConnectionType and the EdgeType is "Data"
	return "Data"
}

func (e *CustomEdge) TsEdgeQueryName() string {
	return names.ToClassType(e.SourceNodeName, "To", e.EdgeName, "Query")
}

func (e *CustomEdge) UniqueEdge() bool {
	return false
}

var _ edge.Edge = &CustomEdge{}
var _ edge.ConnectionEdge = &CustomEdge{}

func getGQLEdge(cfg codegenapi.Config, field CustomField, nodeName string) *CustomEdge {
	edgeName := field.GraphQLName
	if field.EdgeName != "" {
		edgeName = field.EdgeName
	}
	return &CustomEdge{
		SourceNodeName: nodeName,
		Type:           field.Results[0].Type,
		graphqlName:    names.ToGraphQLName(cfg, field.GraphQLName),
		EdgeName:       edgeName,
	}
}

func getRootGQLEdge(cfg codegenapi.Config, field CustomField) *CustomEdge {
	return getGQLEdge(cfg, field, "root")
}
