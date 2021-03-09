package graphql

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen"
)

type processCustomRoot interface {
	process(data *codegen.Data, cd *customData, s *gqlSchema) error
	getFilePath(string) string
	getArgObject(cd *customData, arg CustomItem) *CustomObject
	getFields(cd *customData) []CustomField
	buildFieldConfig(data *codegen.Data, cd *customData, s *gqlSchema, field CustomField) (*fieldConfig, error)
}

type customMutationsProcesser struct {
}

func (cm *customMutationsProcesser) process(data *codegen.Data, cd *customData, s *gqlSchema) error {
	arr, err := processFields(data, cd, s, cm)
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

func (cm *customMutationsProcesser) getFilePath(gqlName string) string {
	return getFilePathForCustomMutation(gqlName)
}

func (cm *customMutationsProcesser) getArgObject(cd *customData, arg CustomItem) *CustomObject {
	return cd.Inputs[arg.Type]
}

func (cm *customMutationsProcesser) getFields(cd *customData) []CustomField {
	return cd.Mutations
}

func (cm *customMutationsProcesser) buildFieldConfig(data *codegen.Data, cd *customData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	b := &mutationFieldConfigBuilder{
		field:    field,
		filePath: cm.getFilePath(field.GraphQLName),
		cd:       cd,
	}

	for _, arg := range field.Args {
		if arg.IsContextArg {
			continue
		}
		if arg.Name == "input" {
			b.inputArg = &arg
		}
	}
	return b.build(data, cd, s, field)
}

type customQueriesProcesser struct {
}

func (cq *customQueriesProcesser) process(data *codegen.Data, cd *customData, s *gqlSchema) error {
	arr, err := processFields(data, cd, s, cq)
	s.customQueries = arr

	return err
}

func (cq *customQueriesProcesser) getFilePath(gqlName string) string {
	return getFilePathForCustomQuery(gqlName)
}

func (cq *customQueriesProcesser) getArgObject(cd *customData, arg CustomItem) *CustomObject {
	return cd.Args[arg.Type]
}

func (cq *customQueriesProcesser) getFields(cd *customData) []CustomField {
	return cd.Queries
}

func (cq *customQueriesProcesser) buildFieldConfig(data *codegen.Data, cd *customData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	b := &queryFieldConfigBuilder{
		field,
		cq.getFilePath(field.GraphQLName),
	}
	return b.build(data, cd, s, field)
}

func processFields(data *codegen.Data, cd *customData, s *gqlSchema, cr processCustomRoot) ([]*gqlNode, error) {
	var result []*gqlNode
	fields := cr.getFields(cd)

	for idx := range fields {
		// field having weird issues unless broken down like this
		field := fields[idx]
		nodeName := field.Node

		class := cd.Classes[nodeName]
		if class == nil {
			return nil, fmt.Errorf("mutation/query %s with class %s not found", field.GraphQLName, class.Name)
		}

		if !class.Exported {
			return nil, fmt.Errorf("Resolver class %s needs to be exported", class.Name)
		}

		var objTypes []*objectType

		// TODO we want an option for namespace for folders but for now ignore
		filePath := cr.getFilePath(field.GraphQLName)

		// let's try and make this generic enough to work for input type and standard args...
		// and have graphql complain if not valid types at the end here
		for _, arg := range field.Args {
			// nothing to do with context args yet
			if arg.IsContextArg {
				continue
			}

			// need to build input type
			// TODO for now we assume inputtype is 1:1, that's not going to remain the same forever...
			argObj := cr.getArgObject(cd, arg)
			if argObj == nil {
				continue
			}
			// not always going to be GraphQLInputObjectType (for queries)
			argType, err := buildObjectType(data, cd, s, arg, argObj, filePath, "GraphQLInputObjectType")
			if err != nil {
				return nil, err
			}
			objTypes = append(objTypes, argType)
		}

		for _, result := range field.Results {
			// 0 -1 allowed...
			object := cd.Objects[result.Type]
			if object == nil {
				continue
			}

			payloadType, err := buildObjectType(data, cd, s, result, object, filePath, "GraphQLObjectType")
			if err != nil {
				return nil, err
			}

			cls := cd.Classes[field.Node]
			if cls != nil {
				importPath, err := getRelativeImportPath(data, filePath, cls.Path)
				if err != nil {
					return nil, err
				}
				if cls.DefaultExport {
					payloadType.DefaultImports = append(payloadType.DefaultImports, &fileImport{
						ImportPath: importPath,
						Type:       field.Node,
					})
				} else {
					payloadType.Imports = append(payloadType.Imports, &fileImport{
						ImportPath: importPath,
						Type:       field.Node,
					})
				}
			}
			objTypes = append(objTypes, payloadType)
		}

		fieldConfig, err := cr.buildFieldConfig(data, cd, s, field)
		if err != nil {
			return nil, err
		}
		result = append(result, &gqlNode{
			ObjData: &gqlobjectData{
				// TODO kill node and NodeInstance they don't make sense here...
				Node:         field.Node,
				NodeInstance: "obj",
				GQLNodes:     objTypes,
				FieldConfig:  fieldConfig,
				Package:      data.CodePath.GetImportPackage(),
			},
			FilePath: filePath,
			Field:    &field,
		})
	}

	return result, nil
}

type fieldConfigBuilder interface {
	build(data *codegen.Data, cd *customData, s *gqlSchema, field CustomField) (*fieldConfig, error)
	getArg() string
	getName() string
	getResolveMethodArg() string
	getTypeImports(s *gqlSchema) []*fileImport
	getArgs(s *gqlSchema) []*fieldConfigArg
	getReturnTypeHint() string
	getArgMap(cd *customData) map[string]*CustomObject
	getFilePath() string
}

type mutationFieldConfigBuilder struct {
	field    CustomField
	filePath string
	cd       *customData
	inputArg *CustomItem
}

func (mfcg *mutationFieldConfigBuilder) getName() string {
	return fmt.Sprintf("%sType", strcase.ToCamel(mfcg.field.GraphQLName))
}

func (mfcg *mutationFieldConfigBuilder) build(data *codegen.Data, cd *customData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	return buildFieldConfigFrom(mfcg, data, s, cd, field)
}

func (mfcg *mutationFieldConfigBuilder) getFilePath() string {
	return mfcg.filePath
}

func (mfcg *mutationFieldConfigBuilder) getArg() string {
	// for input object type, type it
	// everything else, leave blank similar to what we do for queries. see queryFieldConfigBuilder.getArg
	if mfcg.inputArg != nil {
		return fmt.Sprintf("{ [input: string]: %s}", mfcg.inputArg.Type)
	}
	return ""
}

func (mfcg *mutationFieldConfigBuilder) getResolveMethodArg() string {
	if mfcg.inputArg != nil {
		return "{ input }"
	}

	// otherwise, custom and destructure it

	var args []string
	for _, arg := range mfcg.field.Args {
		if arg.IsContextArg {
			continue
		}

		args = append(args, arg.Name)
	}

	return fmt.Sprintf("{%s}", strings.Join(args, ", "))
}

func (mfcg *mutationFieldConfigBuilder) getTypeImports(s *gqlSchema) []*fileImport {
	if len(mfcg.field.Results) != 1 {
		panic("invalid number of results for custom field")
	}
	r := mfcg.field.Results[0]
	var ret []*fileImport
	if r.Nullable == "" {
		ret = append(ret, &fileImport{
			Type:       "GraphQLNonNull",
			ImportPath: "graphql",
		})
	}
	imp := s.getImportFor(r.Type, true)
	if imp != nil {
		ret = append(ret, imp)
	} else {

		prefix := strcase.ToCamel(mfcg.field.GraphQLName)

		ret = append(ret, &fileImport{
			// TODO we should pass this in instead of automatically doing this
			Type:       fmt.Sprintf("%sPayloadType", prefix),
			ImportPath: "",
		})
	}

	return ret
}

func (mfcg *mutationFieldConfigBuilder) getArgs(s *gqlSchema) []*fieldConfigArg {
	if mfcg.inputArg != nil {
		prefix := strcase.ToCamel(mfcg.field.GraphQLName)
		return []*fieldConfigArg{
			{
				Name: "input",
				Imports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					// same for this about passing it in
					{
						Type: fmt.Sprintf("%sInputType", prefix),
					},
				},
			},
		}
	}
	return getFieldConfigArgs(mfcg.field, s, true)
}

func (mfcg *mutationFieldConfigBuilder) getReturnTypeHint() string {
	if mfcg.inputArg != nil {
		prefix := strcase.ToCamel(mfcg.field.GraphQLName)
		return fmt.Sprintf("Promise<%sPayload>", prefix)
	}
	return ""
}

func (mfcg *mutationFieldConfigBuilder) getArgMap(cd *customData) map[string]*CustomObject {
	return cd.Inputs
}

type queryFieldConfigBuilder struct {
	field    CustomField
	filePath string
}

func (qfcg *queryFieldConfigBuilder) getName() string {
	return fmt.Sprintf("%sQueryType", strcase.ToCamel(qfcg.field.GraphQLName))
}

func (qfcg *queryFieldConfigBuilder) build(data *codegen.Data, cd *customData, s *gqlSchema, field CustomField) (*fieldConfig, error) {
	return buildFieldConfigFrom(qfcg, data, s, cd, field)
}

func (qfcg *queryFieldConfigBuilder) getFilePath() string {
	return qfcg.filePath
}

func (qfcg *queryFieldConfigBuilder) getArg() string {
	// we don't type query args for now since it can be whatever. TODO make this work
	return ""
}

func (qfcg *queryFieldConfigBuilder) getResolveMethodArg() string {
	var args []string
	for _, arg := range qfcg.field.Args {
		if arg.IsContextArg {
			continue
		}
		args = append(args, arg.Name)
	}
	return fmt.Sprintf("{%s}", strings.Join(args, ", "))
}

func (qfcg *queryFieldConfigBuilder) getTypeImports(s *gqlSchema) []*fileImport {
	if len(qfcg.field.Results) != 1 {
		panic("invalid number of results for custom field")
	}
	r := qfcg.field.Results[0]
	var ret []*fileImport
	if r.Nullable == "" {
		ret = append(ret, &fileImport{
			Type:       "GraphQLNonNull",
			ImportPath: "graphql",
		})
	}

	imp := s.getImportFor(r.Type, false)
	if imp != nil {
		ret = append(ret, imp)
	} else {
		// new type
		ret = append(ret, &fileImport{
			Type: fmt.Sprintf("%sType", r.Type),
			//		ImportPath is local here
		})
	}

	return ret
}

func getFieldConfigArgs(field CustomField, s *gqlSchema, mutation bool) []*fieldConfigArg {
	var args []*fieldConfigArg
	for _, arg := range field.Args {
		if arg.IsContextArg {
			continue
		}

		imp := s.getImportFor(arg.Type, mutation)
		if imp == nil {
			// local
			imp = &fileImport{
				Type: arg.Type,
			}
		}

		// non-null
		var imports []*fileImport
		if arg.Nullable == "" {
			imports = []*fileImport{
				getNativeGQLImportFor("GraphQLNonNull"), imp,
			}

		} else {
			imports = []*fileImport{imp}
		}
		args = append(args, &fieldConfigArg{
			Name:    arg.Name,
			Imports: imports,
		})
	}
	return args
}

func (qfcg *queryFieldConfigBuilder) getArgs(s *gqlSchema) []*fieldConfigArg {
	return getFieldConfigArgs(qfcg.field, s, false)
}

func (qfcg *queryFieldConfigBuilder) getReturnTypeHint() string {
	// no type hint for now
	return ""
}

func (qfcg *queryFieldConfigBuilder) getArgMap(cd *customData) map[string]*CustomObject {
	return cd.Args
}

func buildFieldConfigFrom(builder fieldConfigBuilder, data *codegen.Data, s *gqlSchema, cd *customData, field CustomField) (*fieldConfig, error) {
	var argImports []*fileImport

	// args that "useImport" should be called on
	// assumes they're reserved somewhere else...

	addToArgImport := func(typ string) error {
		cls := cd.Classes[typ]
		if cls != nil && cls.Exported {
			path, err := getRelativeImportPath(data, builder.getFilePath(), cls.Path)
			if err != nil {
				return err
			}
			argImports = append(argImports, &fileImport{
				Type:       typ,
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

	if err := addToArgImport(field.Node); err != nil {
		return nil, err
	}

	for _, result := range field.Results {
		if err := addToArgImport(result.Type); err != nil {
			return nil, err
		}
	}

	result := &fieldConfig{
		Exported:         true,
		Name:             builder.getName(),
		Arg:              builder.getArg(),
		ResolveMethodArg: builder.getResolveMethodArg(),
		TypeImports:      builder.getTypeImports(s),
		ArgImports:       argImports,
		Args:             builder.getArgs(s),
		ReturnTypeHint:   builder.getReturnTypeHint(),
	}

	argMap := builder.getArgMap(cd)
	argContents := make([]string, len(field.Args))
	for idx, arg := range field.Args {
		if arg.IsContextArg {
			argContents[idx] = "context"
			continue
		}
		argType := argMap[arg.Type]
		if argType == nil {
			argContents[idx] = arg.Name
		} else {
			fields, ok := cd.Fields[arg.Type]
			if !ok {
				return nil, fmt.Errorf("type %s has no fields", arg.Type)
			}
			args := make([]string, len(fields))

			for idx, f := range fields {
				args[idx] = fmt.Sprintf("%s:%s.%s", f.GraphQLName, arg.Name, f.GraphQLName)
			}
			argContents[idx] = fmt.Sprintf("{%s},", strings.Join(args, ","))
		}
	}
	result.FunctionContents = []string{
		fmt.Sprintf("const r = new %s();", field.Node),
		fmt.Sprintf("return r.%s(", field.FunctionName),
		// put all the args on one line separated by a comma. we'll depend on prettier to format correctly
		strings.Join(argContents, ","),
		// closing the funtion call..
		");",
	}

	return result, nil
}

func buildObjectType(data *codegen.Data, cd *customData, s *gqlSchema, item CustomItem, obj *CustomObject, destPath, gqlType string) (*objectType, error) {
	// TODO right now it depends on custom inputs and outputs being FooInput and FooPayload to work
	// we shouldn't do that and we should be smarter
	// maybe add PayloadType if no Payload suffix otherwise Payload. Same for InputType and Input
	typ := &objectType{
		Type:     fmt.Sprintf("%sType", item.Type),
		Node:     obj.NodeName,
		TSType:   item.Type,
		Exported: true,
		// input or object type
		GQLType: gqlType,
	}

	fields, ok := cd.Fields[item.Type]
	if !ok {
		return nil, fmt.Errorf("type %s has no fields", item.Type)
	}

	for _, f := range fields {
		// maybe we'll care for input vs Payload here at some point
		gqlField, err := getCustomGQLField(cd, f, s, "obj")
		if err != nil {
			return nil, err
		}
		typ.Fields = append(typ.Fields, gqlField)
		typ.Imports = append(typ.Imports, gqlField.FieldImports...)
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
			typ.DefaultImports = append(typ.DefaultImports, &fileImport{
				ImportPath: importPath,
				Type:       item.Type,
			})
			createInterface = false
		} else if cls.Exported {
			typ.Imports = append(typ.Imports, &fileImport{
				ImportPath: importPath,
				Type:       item.Type,
			})
			createInterface = false
		}
	}

	if createInterface {
		// need to create an interface for it
		customInt := &interfaceType{
			Exported: false,
			Name:     item.Type,
		}
		fields, ok := cd.Fields[item.Type]
		if !ok {
			return nil, fmt.Errorf("type %s has no fields", item.Type)

		}
		for _, field := range fields {
			newInt := &interfaceField{
				Name: field.GraphQLName,
				Type: field.Results[0].Type,
				// TODO getGraphQLImportsForField???
				// here we grab import from classessss
				// but then later we need class
				UseImport: false,
				// TODO need to convert to number etc...
				// need to convert from graphql type to TS type :(
			}

			if len(field.Results) == 1 {
				result := field.Results[0]
				// check for imported paths that are being used
				if result.TSType != "" {
					newInt.Type = result.TSType
					if cls != nil {
						file := cd.Files[cls.Path]
						if file != nil {
							imp := file.Imports[newInt.Type]
							if imp != nil {
								fImp := &fileImport{
									Type: newInt.Type,
									// TODO this needs to be resolved to be relative...
									// for now assuming tsconfig.json paths being used
									ImportPath: imp.Path,
								}
								if imp.DefaultImport {
									typ.DefaultImports = append(typ.DefaultImports, fImp)
								} else {
									typ.Imports = append(typ.Imports, fImp)
								}
								newInt.UseImport = true
							}
						}
					}
				}
			}

			customInt.Fields = append(customInt.Fields, newInt)
		}
		typ.TSInterfaces = []*interfaceType{customInt}
	}
	return typ, nil
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

func processCustomFields(cd *customData, s *gqlSchema) error {
	for nodeName, fields := range cd.Fields {
		if cd.Inputs[nodeName] != nil {
			continue
		}

		if cd.Objects[nodeName] != nil {
			continue
		}

		nodeInfo := s.nodes[nodeName]
		customEdge := s.edgeNames[nodeName]

		var obj *objectType
		var instance string
		if nodeInfo != nil {
			objData := nodeInfo.ObjData
			nodeData := objData.NodeData
			// always has a node for now
			obj = objData.GQLNodes[0]
			instance = nodeData.NodeInstance
		} else if customEdge {
			// create new obj
			obj = &objectType{
				GQLType: "GraphQLObjectType",
				// needed to reference the edge
				TSType: fmt.Sprintf("GraphQLEdge<%s>", nodeName),
				Node:   nodeName,
			}
			s.customEdges[nodeName] = obj
			// the edge property of GraphQLEdge is where the data is
			instance = "edge.edge"
		} else {
			return fmt.Errorf("can't find %s node that has custom fields", nodeName)
		}

		for _, field := range fields {

			gqlField, err := getCustomGQLField(cd, field, s, instance)
			if err != nil {
				return err
			}
			// append the field
			obj.Fields = append(obj.Fields, gqlField)
			for _, imp := range gqlField.FieldImports {
				imported := false
				// TODO change this to allow multiple imports and the reserveImport system handles this
				// this is just a temporary fix...
				for _, obImp := range obj.Imports {
					if imp.Type == obImp.Type {
						imported = true
						break
					}
				}
				if !imported {
					obj.Imports = append(obj.Imports, imp)
				}
			}
			//			obj.Imports = append(obj.Imports, gqlField.FieldImports...)
		}
	}
	return nil
}

func getCustomGQLField(cd *customData, field CustomField, s *gqlSchema, instance string) (*fieldType, error) {
	imports, err := getGraphQLImportsForField(cd, field, s)
	if err != nil {
		return nil, err
	}
	gqlField := &fieldType{
		Name:               field.GraphQLName,
		HasResolveFunction: false,
		FieldImports:       imports,
	}

	var args []string
	for _, arg := range field.Args {
		if arg.IsContextArg {
			args = append(args, "context")
			continue
		}
		args = append(args, arg.Name)

		cfgArg := &fieldConfigArg{
			Name: arg.Name,
		}

		imps, err := arg.getImports(s, cd)
		if err != nil {
			return nil, err
		}
		for _, imp := range imps {
			cfgArg.Imports = append(cfgArg.Imports, imp)
		}

		gqlField.Args = append(gqlField.Args, cfgArg)
	}

	switch field.FieldType {
	case Accessor, Field:
		// for an accessor or field, we only add a resolve function if named differently
		if field.GraphQLName != field.FunctionName {
			gqlField.HasResolveFunction = true
			gqlField.FunctionContents = []string{
				fmt.Sprintf("return %s.%s;", instance, field.FunctionName),
			}
		}
		break

	case Function, AsyncFunction:
		gqlField.HasAsyncModifier = field.FieldType == AsyncFunction
		gqlField.HasResolveFunction = true
		gqlField.FunctionContents = []string{
			fmt.Sprintf("return %s.%s(%s);", instance, field.FunctionName, strings.Join(args, ",")),
		}
		break
	}

	return gqlField, nil
}

func processCustomMutations(data *codegen.Data, cd *customData, s *gqlSchema) error {
	cm := &customMutationsProcesser{}
	return cm.process(data, cd, s)
}

func processCustomQueries(data *codegen.Data, cd *customData, s *gqlSchema) error {
	cq := &customQueriesProcesser{}
	return cq.process(data, cd, s)
}

func getGraphQLImportsForField(cd *customData, f CustomField, s *gqlSchema) ([]*fileImport, error) {
	var imports []*fileImport

	for _, result := range f.Results {

		imps, err := result.getImports(s, cd)
		if err != nil {
			return nil, err
		}
		imports = append(imports, imps...)
	}
	return imports, nil
}
