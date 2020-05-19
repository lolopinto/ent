package graphql

import (
	"fmt"
	"strings"
	"sync"

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
)

type TSStep struct {
}

func (p *TSStep) Name() string {
	return "graphql"
}

func (p *TSStep) ProcessData(data *codegen.Data) error {
	var wg sync.WaitGroup
	wg.Add(len(data.Schema.Nodes))
	var serr syncerr.Error

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

			if err := writeTypeFile(nodeMap, nodeData); err != nil {
				serr.Append(err)
				return
			}

			actionInfo := nodeData.ActionInfo
			if actionInfo == nil {
				return
			}

			//			write all the actions concurrently
			var actionsWg sync.WaitGroup
			actionsWg.Add(len(nodeData.ActionInfo.Actions))
			for idx := range actionInfo.Actions {
				go func(idx int) {
					defer actionsWg.Done()
					action := actionInfo.Actions[idx]

					if !action.ExposedToGraphQL() {
						return
					}
					if err := writeActionFile(nodeData, action); err != nil {
						serr.Append(err)
					}
				}(idx)
			}
			actionsWg.Wait()
		}(key)
	}
	wg.Wait()

	if err := serr.Err(); err != nil {
		return err
	}
	return writeQueryFile(data)
}

var _ codegen.Step = &TSStep{}

func getFilePathForNode(nodeData *schema.NodeData) string {
	return fmt.Sprintf("src/graphql/resolvers/generated/%s_type.ts", nodeData.PackageName)
}

func getQueryFilePath() string {
	return fmt.Sprintf("src/graphql/resolvers/generated/query_type.ts")
}

func getFilePathForAction(nodeData *schema.NodeData, action action.Action) string {
	return fmt.Sprintf("src/graphql/mutations/generated/%s/%s_type.ts", nodeData.PackageName, strcase.ToSnake(action.GetActionName()))
}

type gqlobjectData struct {
	NodeData     *schema.NodeData
	GQLNodes     []objectType
	FieldConfig  fieldConfig
	LocalImports []string
}

func (obj gqlobjectData) ForeignImport(name string) bool {
	// TODO this should eventually be a map
	for _, localImport := range obj.LocalImports {
		if localImport == name {
			return false
		}
	}
	return true
}

// write graphql file
func writeTypeFile(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlobjectData{
			NodeData:    nodeData,
			GQLNodes:    []objectType{buildNodeForObject(nodeMap, nodeData)},
			FieldConfig: buildFieldConfig(nodeData),
			LocalImports: []string{
				fmt.Sprintf("%sType", nodeData.Node),
				fmt.Sprintf("%sQueryArgs", nodeData.Node),
				fmt.Sprintf("%sQuery", nodeData.Node),
			},
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/object.tmpl"),
		TemplateName:      "object.tmpl",
		PathToFile:        getFilePathForNode(nodeData),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func writeActionFile(nodeData *schema.NodeData, action action.Action) error {
	actionPrefix := strcase.ToCamel(action.GetGraphQLName())

	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlobjectData{
			NodeData:    nodeData,
			GQLNodes:    buildActionNodes(nodeData, action, actionPrefix),
			FieldConfig: buildActionFieldConfig(nodeData, action, actionPrefix),
			LocalImports: []string{
				fmt.Sprintf("%sInputType", actionPrefix),
				fmt.Sprintf("%sResponseType", actionPrefix),
				fmt.Sprintf("%sResponse", actionPrefix),
				fmt.Sprintf("%sType", actionPrefix),
			},
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/object.tmpl"),
		TemplateName:      "object.tmpl",
		PathToFile:        getFilePathForAction(nodeData, action),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

type fieldConfig struct {
	Exported         bool
	Name             string
	Arg              string
	TypeImports      []string
	ArgImports       []string // incase it's { [argName: string]: any }, we need to know difference
	Args             []fieldConfigArg
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

func buildFieldConfig(nodeData *schema.NodeData) fieldConfig {
	return fieldConfig{
		Exported:    true,
		Name:        fmt.Sprintf("%sQuery", nodeData.Node),
		Arg:         fmt.Sprintf("%sQueryArgs", nodeData.Node),
		TypeImports: []string{fmt.Sprintf("%sType", nodeData.Node)},
		Args: []fieldConfigArg{
			{
				Name:        "id",
				Description: "id",
				Imports:     []string{"GraphQLNonNull", "GraphQLID"},
			},
		},
		FunctionContents: []string{
			fmt.Sprintf("return %s.load(context.viewer, args.id);", nodeData.Node),
		},
	}
}

func buildNodeForObject(nodeMap schema.NodeMapInfo, nodeData *schema.NodeData) objectType {
	result := objectType{
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
		result.Imports = append(result.Imports, queryGQLDatum{
			ImportPath:  fmt.Sprintf("./%s_type", node.PackageName),
			GraphQLType: fmt.Sprintf("%sType", node.Node),
		})
	}
	result.DefaultImports = append(result.DefaultImports, queryGQLDatum{
		ImportPath:  fmt.Sprintf("src/ent/%s", nodeData.PackageName),
		GraphQLType: nodeData.Node,
	})

	result.Interfaces = append(result.Interfaces, interfaceType{
		Name: fmt.Sprintf("%sQueryArgs", nodeData.Node),
		Fields: []interfaceField{
			{
				Name:      "id",
				Type:      "ID",
				UseImport: true,
			},
		},
	})

	instance := nodeData.NodeInstance

	fieldInfo := nodeData.FieldInfo
	var fields []fieldType
	for _, field := range fieldInfo.GraphQLFields() {
		gqlField := fieldType{
			Name:               field.GetGraphQLName(),
			HasResolveFunction: field.GetGraphQLName() != field.TsFieldName(),
			FieldImports:       field.GetTSGraphQLTypeForFieldImports(),
		}
		if gqlField.HasResolveFunction {
			gqlField.FunctionContents = fmt.Sprintf("return %s.%s;", instance, field.TsFieldName())
		}
		fields = append(fields, gqlField)
	}

	for _, edge := range nodeData.EdgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(edge.FieldName)
		// TODO this shouldn't be here but be somewhere else...
		if f != nil {
			fieldInfo.InvalidateFieldForGraphQL(f)
		}
		addSingularEdge(edge, &fields, instance)
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

func addSingularEdge(edge edge.Edge, fields *[]fieldType, instance string) {
	gqlField := fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       edge.GetTSGraphQLTypeImports(),
		FunctionContents:   fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName()),
	}
	*fields = append(*fields, gqlField)
}

func addPluralEdge(edge edge.Edge, fields *[]fieldType, instance string) {
	gqlField := fieldType{
		Name:               edge.GraphQLEdgeName(),
		HasResolveFunction: true,
		FieldImports:       edge.GetTSGraphQLTypeImports(),
		FunctionContents:   fmt.Sprintf("return %s.load%s();", instance, edge.CamelCaseEdgeName()),
	}
	*fields = append(*fields, gqlField)
}

func buildActionNodes(nodeData *schema.NodeData, action action.Action, actionPrefix string) []objectType {
	return []objectType{
		buildActionInputNode(nodeData, action, actionPrefix),
		buildActionResponseNode(nodeData, action, actionPrefix),
	}
}

func buildActionInputNode(nodeData *schema.NodeData, action action.Action, actionPrefix string) objectType {
	// TODO shared input types across created/edit for example
	result := objectType{
		Type:     fmt.Sprintf("%sInputType", actionPrefix),
		Node:     fmt.Sprintf("%sInput", actionPrefix),
		Exported: true,
		GQLType:  "GraphQLInputObjectType",
	}

	// add id field for edit and delete mutations
	if action.MutatingExistingObject() {
		result.Fields = append(result.Fields, fieldType{
			Name:         fmt.Sprintf("%sID", action.GetNodeInfo().NodeInstance),
			FieldImports: []string{"GraphQLNonNull", "GraphQLID"},
			Description:  fmt.Sprintf("id of %s", nodeData.Node),
		})
	}

	for _, f := range action.GetFields() {
		result.Fields = append(result.Fields, fieldType{
			Name:         f.GetGraphQLName(),
			FieldImports: f.GetTSGraphQLTypeForFieldImports(),
		})
	}

	// add each edge that's part of the mutation as an ID
	// use singular version so that this is friendID instead of friendsID
	for _, edge := range action.GetEdges() {
		result.Fields = append(result.Fields, fieldType{
			Name:         fmt.Sprintf("%sID", strcase.ToLowerCamel(edge.Singular())),
			FieldImports: []string{"GraphQLNonNull", "GraphQLID"},
		})
	}

	if action.MutatingExistingObject() {
		// custom interface for editing
		result.Interfaces = []interfaceType{
			{
				Exported: false,
				Name:     fmt.Sprintf("custom%sInput", actionPrefix),
				Fields: []interfaceField{
					{
						Name:      fmt.Sprintf("%sID", action.GetNodeInfo().NodeInstance),
						Type:      "ID", // ID
						UseImport: true,
					},
				},
				// TODO remove this for delete since no input
				Extends: []string{
					fmt.Sprintf("%sInput", actionPrefix),
				},
			},
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
	// invalid
	return fmt.Sprintf("%sDeleteInput", node)
	panic("invalid. todo")
}

func buildActionResponseNode(nodeData *schema.NodeData, action action.Action, actionPrefix string) objectType {
	// TODO add type for input above
	result := objectType{
		Type:     fmt.Sprintf("%sResponseType", actionPrefix),
		Node:     fmt.Sprintf("%sResponse", actionPrefix),
		Exported: true,
		GQLType:  "GraphQLObjectType",
		// TODO these don't make sense here either and should be moved up
		DefaultImports: []queryGQLDatum{
			{
				ImportPath:  fmt.Sprintf("src/ent/%s", nodeData.PackageName),
				GraphQLType: nodeData.Node,
			},
			{
				ImportPath:  fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, strcase.ToSnake(action.GetActionName())),
				GraphQLType: action.GetActionName(),
			},
		},
		Imports: []queryGQLDatum{
			{
				ImportPath:  getFilePathForNode(nodeData),
				GraphQLType: fmt.Sprintf("%sType", nodeData.Node),
			},
			{
				ImportPath:  fmt.Sprintf("src/ent/%s/actions/%s", nodeData.PackageName, strcase.ToSnake(action.GetActionName())),
				GraphQLType: getInputName(action),
			},
		},
	}

	nodeInfo := action.GetNodeInfo()
	if action.GetOperation() != ent.DeleteAction {
		result.Fields = append(result.Fields, fieldType{
			Name:         nodeInfo.NodeInstance,
			FieldImports: []string{"GraphQLNonNull", fmt.Sprintf("%sType", nodeInfo.Node)},
		})
	} else {
		result.Fields = append(result.Fields, fieldType{
			Name:         fmt.Sprintf("deleted%sID", nodeInfo.Node),
			FieldImports: []string{"GraphQLID"},
		})
	}

	// TODO this doesn't make sense here. it should be a top level thing
	result.Interfaces = []interfaceType{
		{
			Exported: false,
			Name:     fmt.Sprintf("%sResponse", actionPrefix),
			Fields: []interfaceField{
				{
					Name:      nodeData.NodeInstance,
					Type:      nodeData.Node,
					UseImport: true,
				},
			},
		},
	}

	return result
}

func buildActionFieldConfig(nodeData *schema.NodeData, action action.Action, actionPrefix string) fieldConfig {
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
	result := fieldConfig{
		Exported: true,
		Name:     fmt.Sprintf("%sType", actionPrefix),
		// imports UserCreateInput...
		Arg: argName,
		TypeImports: []string{
			"GraphQLNonNull",
			fmt.Sprintf("%sResponseType", actionPrefix),
		},
		// TODO these are just all imports, we don't care where from
		ArgImports: argImports,
		Args: []fieldConfigArg{
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
		result.FunctionContents = append(result.FunctionContents, fmt.Sprintf("let %s = await %s.create(context.viewer, {", nodeData.NodeInstance, action.GetActionName()))
		for _, f := range action.GetFields() {
			if f.ExposeToGraphQL() {
				// TODO rename from args to input?
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("%s: args.%s,", f.TsFieldName(), f.TsFieldName()),
				)
			}
		}
		result.FunctionContents = append(result.FunctionContents, "}).saveX();")

		result.FunctionContents = append(
			result.FunctionContents,
			fmt.Sprintf("return {%s: %s};", nodeData.NodeInstance, nodeData.NodeInstance),
		)
	} else if action.GetOperation() == ent.DeleteAction {

	} else {
		// some kind of editing
		result.FunctionContents = append(result.FunctionContents, fmt.Sprintf("let %s = await %s.saveXFromID(context.viewer, args.id, {", nodeData.NodeInstance, action.GetActionName()))
		for _, f := range action.GetFields() {
			if f.ExposeToGraphQL() {
				// TODO rename from args to input?
				result.FunctionContents = append(
					result.FunctionContents,
					fmt.Sprintf("%s: args.%s,", f.TsFieldName(), f.TsFieldName()),
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
	Fields   []fieldType
	Exported bool
	GQLType  string // for now only GraphQLObjectType

	// TODO will soon need to allow calling import multiple times for the same path
	DefaultImports []queryGQLDatum
	Imports        []queryGQLDatum
	Interfaces     []interfaceType
}

type fieldType struct {
	Name               string
	HasResolveFunction bool
	Description        string
	FieldImports       []string

	// no args for now. come back.
	FunctionContents string // TODO
	// TODO more types we need to support
}

type interfaceType struct {
	Exported bool
	Name     string
	Fields   []interfaceField
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

// TODO rename this...
type queryGQLDatum struct {
	ImportPath  string
	GraphQLName string
	GraphQLType string
}

type gqlQueryData struct {
	Queries []queryGQLDatum
}

func getQueryData(data *codegen.Data) []queryGQLDatum {
	var results []queryGQLDatum
	for key := range data.Schema.Nodes {

		nodeData := data.Schema.Nodes[key].NodeData
		if nodeData.HideFromGraphQL {
			continue
		}
		results = append(results, queryGQLDatum{
			ImportPath:  fmt.Sprintf("./%s_type", nodeData.PackageName),
			GraphQLType: fmt.Sprintf("%sQuery", nodeData.Node),
			GraphQLName: strcase.ToLowerCamel(nodeData.Node),
		})

	}
	return results
}

func writeQueryFile(data *codegen.Data) error {
	imps := tsimport.NewImports()
	return file.Write((&file.TemplatedBasedFileWriter{
		Data: gqlQueryData{
			Queries: getQueryData(data),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("ts_templates/query.tmpl"),
		TemplateName:      "query.tmpl",
		PathToFile:        getQueryFilePath(),
		FormatSource:      true,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}
