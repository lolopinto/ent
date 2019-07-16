package main

import (
	"text/template"

	"github.com/99designs/gqlgen/codegen"
	"github.com/99designs/gqlgen/codegen/templates"
	"github.com/99designs/gqlgen/plugin"
)

// inspired by resolvergen from gqlgen
type entGraphQLResolverPlugin struct {
	nodes codegenMapInfo
}

var _ plugin.CodeGenerator = &entGraphQLResolverPlugin{}

func (p *entGraphQLResolverPlugin) Name() string {
	return "ent_graphql_resolver"
}

func (p *entGraphQLResolverPlugin) castToString(field *codegen.Field) bool {
	objName := field.Object.Name

	template := p.nodes.getTemplateFromGraphQLName(objName)
	if template == nil {
		return false
	}

	entField := template.getFieldByName(field.GoFieldName)
	//spew.Dump(field, entField)
	if entField == nil {
		return false
	}

	// todo need to make this generic enough in the future
	// castToSomething
	// then call a getCastToBlah code
	return entField.GetGraphQLTypeForField() == "String!"
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
	template := p.nodes.getTemplateFromGraphQLName(field.GoFieldName)
	return template != nil
}

func (p *entGraphQLResolverPlugin) fieldEdge(field *codegen.Field) bool {
	objName := field.Object.Name

	template := p.nodes.getTemplateFromGraphQLName(objName)
	if template == nil {
		return false
	}

	edge := template.getFieldEdgeByName(field.GoFieldName)
	return edge != nil
}

// ResolverBuild is the object passed to the template to generate the graphql code
type ResolverBuild struct {
	*codegen.Data

	PackageName  string
	ResolverType string
}

func (p *entGraphQLResolverPlugin) GenerateCode(data *codegen.Data) error {
	resolverBuild := &ResolverBuild{
		Data:         data,
		ResolverType: "Resolver",
	}

	return templates.Render(templates.Options{
		PackageName:     "graphql",
		Filename:        "graphql/resolver.go",
		Data:            resolverBuild,
		GeneratedHeader: true,
		Template:        readTemplateFile("ent_graphql_resolver.gotpl"),
		Funcs: template.FuncMap{
			"castToString":          p.castToString,
			"loadObjectFromContext": p.loadObjectFromContext,
			"fieldEdge":             p.fieldEdge,
		},
	})
}

func newGraphQLResolverPlugin(nodes codegenMapInfo) plugin.Plugin {
	return &entGraphQLResolverPlugin{
		nodes: nodes,
	}
}
