package graphql

import (
	"regexp"
	"text/template"

	"github.com/99designs/gqlgen/codegen"
	"github.com/99designs/gqlgen/codegen/templates"
	"github.com/99designs/gqlgen/plugin"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/action"
	intcodegen "github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/schema"
)

// inspired by resolvergen from gqlgen
type entGraphQLResolverPlugin struct {
	schema    *schema.Schema
	config    *intcodegen.Config
	gqlSchema *graphQLSchema
	fileName  string
}

var _ plugin.CodeGenerator = &entGraphQLResolverPlugin{}

func (p *entGraphQLResolverPlugin) Name() string {
	return "ent_graphql_resolver"
}

func (p *entGraphQLResolverPlugin) castToString(field *codegen.Field) bool {
	nodeData := p.getNodeDataForField(field)
	if nodeData == nil {
		return false
	}

	entField := nodeData.GetFieldByName(field.GoFieldName)
	//spew.Dump(field, entField)
	if entField == nil {
		return false
	}

	// todo need to make this generic enough in the future
	// castToSomething
	// then call a getCastToBlah code
	return entField.GetGraphQLTypeForField() == "String!"
}

func (p *entGraphQLResolverPlugin) getNodeDataForField(field *codegen.Field) *schema.NodeData {
	objName := field.Object.Name

	return p.schema.GetNodeDataFromGraphQLName(objName)
}

func (p *entGraphQLResolverPlugin) loadObjectFromContext(field *codegen.Field) bool {
	if len(field.Args) != 1 {
		return false
	}
	firstArg := field.Args[0]

	// for now just assume always id. TODO?
	if firstArg.Name != "id" {
		return false
	}

	// field.Object.Name = Query
	// field.GoFieldName = Contact/User etc.
	nodeData := p.schema.GetNodeDataFromGraphQLName(field.GoFieldName)
	return nodeData != nil
}

func (p *entGraphQLResolverPlugin) fieldEdge(field *codegen.Field) bool {
	nodeData := p.getNodeDataForField(field)
	if nodeData == nil {
		return false
	}

	edge := nodeData.GetFieldEdgeByName(field.GoFieldName)
	return edge != nil
}

func (p *entGraphQLResolverPlugin) pluralEdge(field *codegen.Field) bool {
	nodeData := p.getNodeDataForField(field)
	if nodeData == nil {
		return false
	}

	edge := nodeData.GetDestinationEdgeByName(field.GoFieldName)
	if edge != nil {
		return true
	}

	assocEdge := nodeData.GetAssociationEdgeByName(field.GoFieldName)
	return assocEdge != nil
}

func (p *entGraphQLResolverPlugin) action(field *codegen.Field) action.Action {
	if field.Object.Name != "Mutation" {
		return nil
	}
	//	spew.Dump(field)

	//	spew.Dump(field.TypeReference.Definition.Name)

	// Name -> userCreate, GoFieldName -> UserCreate
	//	spew.Dump(field.GoFieldName, field.GoReceiverName)
	//	spew.Dump(field)
	return p.schema.GetActionFromGraphQLName(field.Name)
	//	spew.Dump(field.Name, action)
}

func (p *entGraphQLResolverPlugin) groupEdgeEnum(field *codegen.Field) *edge.AssociationEdgeGroup {
	nodeData := p.getNodeDataForField(field)
	if nodeData == nil {
		return nil
	}
	r := regexp.MustCompile(`Viewer(\w+)`)
	match := r.FindStringSubmatch(field.GoFieldName)
	if len(match) != 2 {
		return nil
	}

	return nodeData.EdgeInfo.GetAssociationEdgeGroupByStatusName(match[1])
}

func (p *entGraphQLResolverPlugin) groupEdgeEnumConst(field *codegen.Field) string {
	return p.groupEdgeEnum(field).ConstType
}

func (p *entGraphQLResolverPlugin) getActionPath(a action.Action) string {
	// TODO these names are broken. fix it
	// this is equivalent to nodeData.PackageName which is what we're using when
	// generating the file
	// need to make sure we support contact_date etc
	// to be consistent with writeActionFile
	return p.config.AppendPathToModels(strcase.ToSnake(a.GetNodeInfo().Node), "action")
}

func (p *entGraphQLResolverPlugin) customFn(field *codegen.Field) *customFunction {
	if field.Object.Name == "Query" {
		return p.gqlSchema.queryCustomImpls[field.Name]
	} else if field.Object.Name == "Mutation" {
		return p.gqlSchema.mutationCustomImpls[field.Name]
	}
	return nil
}

// ResolverBuild is the object passed to the template to generate the graphql code
type ResolverBuild struct {
	*codegen.Data

	PackageName  string
	ResolverType string
	Config       *intcodegen.Config
}

func (p *entGraphQLResolverPlugin) GenerateCode(data *codegen.Data) error {
	resolverBuild := &ResolverBuild{
		Data:         data,
		ResolverType: "Resolver",
		Config:       p.config,
	}

	return templates.Render(templates.Options{
		PackageName:     "graphql",
		Filename:        p.fileName,
		Data:            resolverBuild,
		GeneratedHeader: true,
		Template:        readTemplateFile("ent_graphql_resolver.gotmpl"),
		Funcs: template.FuncMap{
			"castToString":          p.castToString,
			"loadObjectFromContext": p.loadObjectFromContext,
			"fieldEdge":             p.fieldEdge,
			"pluralEdge":            p.pluralEdge,
			"action":                p.action,
			"actionMethodName":      action.GetActionMethodName,
			"actionFields":          action.GetFields,
			"actionEdges":           action.GetEdges,
			"actionNonEntFields":    action.GetNonEntFields,
			"actionPath":            p.getActionPath,
			"groupEdgeEnum":         p.groupEdgeEnum,
			"groupEdgeEnumConst":    p.groupEdgeEnumConst,
			"removeEdgeAction":      action.IsRemoveEdgeAction,
			"customFn":              p.customFn,
		},
	})
}

func newGraphQLResolverPlugin(s *graphQLSchema, filename string) plugin.Plugin {
	plugin := &entGraphQLResolverPlugin{
		schema:    s.config.Schema,
		config:    s.config.Config,
		gqlSchema: s,
		fileName:  filename,
	}
	return plugin
}
