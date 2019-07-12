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

	// TODO should probably return an error
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
	ft := getTypeForField(entField)
	//spew.Dump(ft, ft.GetGraphQLType())
	return ft.GetGraphQLType() == "String!"
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
			"castToString": p.castToString,
		},
	})
}

func newGraphQLResolverPlugin(nodes codegenMapInfo) plugin.Plugin {
	return &entGraphQLResolverPlugin{
		nodes: nodes,
	}
}
