package main

import (
	"io/ioutil"

	"github.com/99designs/gqlgen/codegen"
	"github.com/99designs/gqlgen/codegen/templates"
	"github.com/99designs/gqlgen/plugin"
)

// inspired by servergen from gqlgen
type entGraphQLServerPlugin struct{}

var _ plugin.CodeGenerator = &entGraphQLServerPlugin{}

func (p *entGraphQLServerPlugin) Name() string {
	return "ent_graphql_server"
}

func readTemplateFile(fileName string) string {
	path := getAbsolutePath(fileName)

	contents, err := ioutil.ReadFile(path)
	die(err)
	return string(contents)
}

func (p *entGraphQLServerPlugin) GenerateCode(data *codegen.Data) error {
	serverBuild := &ServerBuild{
		// TODO...
		ExecPackageName:     "github.com/lolopinto/jarvis/graphql",
		ResolverPackageName: "github.com/lolopinto/jarvis/graphql",
	}

	return templates.Render(templates.Options{
		PackageName: "main",
		Filename:    "server.go",
		Data:        serverBuild,
		Template:    readTemplateFile("ent_graphql_server.gotpl"),
	})
}

// ServerBuild is the object passed to the template to generate the graphql code
type ServerBuild struct {
	codegen.Data

	ExecPackageName     string
	ResolverPackageName string
}

func newGraphQLServerPlugin() plugin.Plugin {
	return &entGraphQLServerPlugin{}
}
