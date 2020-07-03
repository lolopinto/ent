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
	getArgObject(cd *customData, arg CustomItem) *CustomArg
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

func (cm *customMutationsProcesser) getArgObject(cd *customData, arg CustomItem) *CustomArg {
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

func (cq *customQueriesProcesser) getArgObject(cd *customData, arg CustomItem) *CustomArg {
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
			argType, err := buildObjectType(data, cd, s, arg, filePath, "GraphQLInputObjectType")
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
			responseType, err := buildObjectType(data, cd, s, result, filePath, "GraphQLObjectType")
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
				Node:         field.Node,
				NodeInstance: "obj",
				GQLNodes:     objTypes,
				FieldConfig:  fieldConfig,
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
	getArgMap(cd *customData) map[string]*CustomArg
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

func (mfcg *mutationFieldConfigBuilder) getArgMap(cd *customData) map[string]*CustomArg {
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

func (qfcg *queryFieldConfigBuilder) getArgMap(cd *customData) map[string]*CustomArg {
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

func buildObjectType(data *codegen.Data, cd *customData, s *gqlSchema, item CustomItem, destPath, gqlType string) (*objectType, error) {
	typ := &objectType{
		Type:     fmt.Sprintf("%sType", item.Type),
		Node:     item.Type,
		Exported: true,
		// input or object type
		GQLType: gqlType,
	}

	fields, ok := cd.Fields[item.Type]
	if !ok {
		return nil, fmt.Errorf(" type %s has no fields", item.Type)
	}

	for _, f := range fields {
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
		fields, ok := cd.Fields[item.Type]
		if !ok {
			return nil, fmt.Errorf("type %s has no fields", item.Type)

		}
		for _, field := range fields {
			newInt := &interfaceField{
				Name: field.GraphQLName,
				Type: field.Results[0].Type,
				// TODO getGraphQLImportsForField???
				UseImport: false,
				// TODO need to convert to number etc...
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
