package graphql

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/pkg/errors"
)

type processCustomRoot interface {
	process(data *codegen.Data, cd *customData, s *gqlSchema) error
	getFilePath(string) string
	getArgObject(cd *customData, arg CustomItem) *CustomObject
	getFields(cd *customData) []CustomField
	buildFieldConfig(cd *customData, field CustomField) (*fieldConfig, error)
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

func (cm *customMutationsProcesser) buildFieldConfig(cd *customData, field CustomField) (*fieldConfig, error) {
	b := &mutationFieldConfigBuilder{
		field,
	}
	return b.build(cd, field)
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

func (cq *customQueriesProcesser) buildFieldConfig(cd *customData, field CustomField) (*fieldConfig, error) {
	b := &queryFieldConfigBuilder{
		field,
	}
	return b.build(cd, field)
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

		hasResponse := false
		for _, result := range field.Results {
			// 0 -1 allowed...
			object := cd.Objects[result.Type]
			if object == nil {
				continue
			}

			responseType, err := buildObjectType(data, cd, s, result, object, filePath, "GraphQLObjectType")
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
					responseType.DefaultImports = append(responseType.DefaultImports, &fileImport{
						ImportPath: importPath,
						Type:       field.Node,
					})
				} else {
					responseType.Imports = append(responseType.Imports, &fileImport{
						ImportPath: importPath,
						Type:       field.Node,
					})
				}
			}
			hasResponse = true
			objTypes = append(objTypes, responseType)
		}
		if !hasResponse {
			return nil, errors.New("no response for mutation. TODO handle")
		}

		fieldConfig, err := cr.buildFieldConfig(cd, field)
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
	build(cd *customData, field CustomField) (*fieldConfig, error)
	getArg() string
	getResolveMethodArg() string
	getTypeImports() []string
	getArgs() []*fieldConfigArg
	getReturnTypeHint() string
	getArgMap(cd *customData) map[string]*CustomObject
}

type mutationFieldConfigBuilder struct {
	field CustomField
}

func (mfcg *mutationFieldConfigBuilder) build(cd *customData, field CustomField) (*fieldConfig, error) {
	return buildFieldConfigFrom(mfcg, cd, field)
}

func (mfcg *mutationFieldConfigBuilder) getArg() string {
	for _, arg := range mfcg.field.Args {
		if arg.IsContextArg {
			continue
		}
		// assume input object type.
		// this may eventually not be input but may be other types...
		return fmt.Sprintf("{ [input: string]: %s}", arg.Type)

	}
	return ""
}

func (mfcg *mutationFieldConfigBuilder) getResolveMethodArg() string {
	return "{ input }" // TODO not always input
}

func (mfcg *mutationFieldConfigBuilder) getTypeImports() []string {
	prefix := strcase.ToCamel(mfcg.field.GraphQLName)
	return []string{
		"GraphQLNonNull",
		// TODO we should pass this in instead of automatically doing this
		fmt.Sprintf("%sResponseType", prefix),
	}
}

func (mfcg *mutationFieldConfigBuilder) getArgs() []*fieldConfigArg {
	prefix := strcase.ToCamel(mfcg.field.GraphQLName)
	return []*fieldConfigArg{
		{
			Name: "input",
			Imports: []string{
				"GraphQLNonNull",
				// same for this about passing it in
				fmt.Sprintf("%sInputType", prefix),
			},
		},
	}
}

func (mfcg *mutationFieldConfigBuilder) getReturnTypeHint() string {
	prefix := strcase.ToCamel(mfcg.field.GraphQLName)
	return fmt.Sprintf("Promise<%sResponse>", prefix)
}

func (mfcg *mutationFieldConfigBuilder) getArgMap(cd *customData) map[string]*CustomObject {
	return cd.Inputs
}

type queryFieldConfigBuilder struct {
	field CustomField
}

func (qfcg *queryFieldConfigBuilder) build(cd *customData, field CustomField) (*fieldConfig, error) {
	return buildFieldConfigFrom(qfcg, cd, field)
}

func (qfcg *queryFieldConfigBuilder) getArg() string {
	for _, arg := range qfcg.field.Args {
		if arg.IsContextArg {
			continue
		}
		// TODO
		//		return fmt.Sprintf("{ [input: string]: %s}", arg.Type)
	}
	return ""
}

func (qfcg *queryFieldConfigBuilder) getResolveMethodArg() string {
	return "{ arg }" // TODO?
}

func (qfcg *queryFieldConfigBuilder) getTypeImports() []string {
	if len(qfcg.field.Results) != 1 {
		panic("INVALID")
	}
	r := qfcg.field.Results[0]
	if r.Nullable != "" {
		// nullable
		return []string{r.Type}
	}
	// TODO these too...
	return []string{
		"GraphQLNonNull",
		fmt.Sprintf("%sType", r.Type),
	}
}

func (qfcg *queryFieldConfigBuilder) getArgs() []*fieldConfigArg {
	var args []*fieldConfigArg
	for _, arg := range qfcg.field.Args {
		if arg.IsContextArg {
			continue
		}

		// non-null
		var imports []string
		if arg.Nullable == "" {
			// TODO this needs to also change to fileImport
			imports = []string{
				"GraphQLNonNull",
				arg.Type,
			}
		} else {
			imports = []string{
				arg.Type,
			}
		}
		args = append(args, &fieldConfigArg{
			Name:    arg.Name,
			Imports: imports,
		})
	}
	return args
}

func (qfcg *queryFieldConfigBuilder) getReturnTypeHint() string {
	// no type hint for now
	return ""
}

func (qfcg *queryFieldConfigBuilder) getArgMap(cd *customData) map[string]*CustomObject {
	return cd.Args
}

func buildFieldConfigFrom(builder fieldConfigBuilder, cd *customData, field CustomField) (*fieldConfig, error) {
	prefix := strcase.ToCamel(field.GraphQLName)
	var argImports []string

	// args that "useImport" should be called on
	// assumes they're reserved somewhere else...
	for _, arg := range field.Args {
		if arg.IsContextArg {
			continue
		}
		cls := cd.Classes[arg.Type]
		if cls != nil && cls.Exported {
			argImports = append(argImports, arg.Type)
		}
	}
	for _, result := range field.Results {
		cls := cd.Classes[result.Type]
		if cls != nil && cls.Exported {
			argImports = append(argImports, result.Type)
		}
	}

	result := &fieldConfig{
		Exported:         true,
		Name:             fmt.Sprintf("%sType", prefix),
		Arg:              builder.getArg(),
		ResolveMethodArg: builder.getResolveMethodArg(),
		TypeImports:      builder.getTypeImports(),
		ArgImports:       argImports,
		Args:             builder.getArgs(),
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
		fmt.Sprintf("return r.%s(", field.GraphQLName),
		// put all the args on one line separated by a comma. we'll depend on prettier to format correctly
		strings.Join(argContents, ","),
		// closing the funtion call..
		");",
	}

	return result, nil
}

func buildObjectType(data *codegen.Data, cd *customData, s *gqlSchema, item CustomItem, obj *CustomObject, destPath, gqlType string) (*objectType, error) {
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
		// maybe we'll care for input vs response here at some point
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
				if result.TSType != nil {
					newInt.Type = *result.TSType
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
		typ.Interfaces = []*interfaceType{customInt}
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

		if nodeInfo == nil {
			return fmt.Errorf("can't find %s node that has custom fields", nodeName)
		}

		objData := nodeInfo.ObjData
		nodeData := objData.NodeData
		// always has a node for now
		obj := objData.GQLNodes[0]

		for _, field := range fields {

			if len(field.Args) > 0 {
				return fmt.Errorf("don't currently support fields with any args")
			}

			gqlField, err := getCustomGQLField(cd, field, s, nodeData.NodeInstance)
			if err != nil {
				return err
			}
			// append the field
			obj.Fields = append(obj.Fields, gqlField)
			obj.Imports = append(obj.Imports, gqlField.FieldImports...)
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
	graphqlScalars := map[string]string{
		"String":  "GraphQLString",
		"Date":    "Time",
		"Int":     "GraphQLInt",
		"Float":   "GraphQLFloat",
		"Boolean": "GraphQLBoolean",
		"ID":      "GraphQLID",
	}

	var imports []*fileImport
	addGQLImports := func(imps ...string) {
		for _, imp := range imps {
			imports = append(imports, &fileImport{
				ImportPath: "graphql",
				Type:       imp,
			})
		}
	}
	for _, result := range f.Results {

		switch result.Nullable {
		case NullableTrue:
			if result.List {
				addGQLImports("GraphQLList", "GraphQLNonNull")
			}
			break

		case NullableContents:
			if !result.List {
				return nil, fmt.Errorf("list required to use this option")
			}
			addGQLImports("GraphQLNonNull", "GraphQLList")
			break

		case NullableContentsAndList:
			if !result.List {
				return nil, fmt.Errorf("list required to use this option")
			}
			addGQLImports("GraphQLList")
			break

		default:
			if result.List {
				addGQLImports("GraphQLNonNull", "GraphQLList", "GraphQLNonNull")
			} else {
				addGQLImports("GraphQLNonNull")
			}
			break
		}

		typ, ok := graphqlScalars[result.Type]
		if ok {
			addGQLImports(typ)
		} else {
			node, ok := s.nodes[result.Type]
			if ok {
				nodeData := node.ObjData.NodeData
				imports = append(imports, &fileImport{
					Type:       fmt.Sprintf("%sType", result.Type),
					ImportPath: getImportPathForNode(nodeData),
				})
				//				s.nodes[resultre]
				// now we need to figure out where this is from e.g.
				// result.Type a native thing e.g. User so getUserType
				// TODO need to add it to DefaultImport for the entire file...
				// e.g. getImportPathForNode
				// or in cd.Classes and figure that out for what the path should be...
				//				imports = append(imports, fmt.Sprintf("%sType", result.Type))
				//				spew.Dump(result.Type + " needs to be added to import for file...")
			} else {
				return nil, fmt.Errorf("found a type %s which was not part of the schema", result.Type)
			}
		}
	}
	return imports, nil
}
