package main

import (
	"io/ioutil"
	"path/filepath"

	"github.com/99designs/gqlgen/codegen"
	"github.com/99designs/gqlgen/codegen/templates"
	"github.com/99designs/gqlgen/plugin"

	intcodegen "github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/util"
)

// inspired by servergen from gqlgen
type entGraphQLServerPlugin struct {
	codePath *intcodegen.CodePath
}

var _ plugin.CodeGenerator = &entGraphQLServerPlugin{}

func (p *entGraphQLServerPlugin) Name() string {
	return "ent_graphql_server"
}

func readTemplateFile(fileName string) string {
	path := getAbsolutePath(fileName)

	contents, err := ioutil.ReadFile(path)
	util.Die(err)
	return string(contents)
}

func (p *entGraphQLServerPlugin) GenerateCode(data *codegen.Data) error {
	graphqlPath := filepath.Join(p.codePath.PathToRoot, "graphql")
	serverBuild := &ServerBuild{

		ExecPackageName:     graphqlPath,
		ResolverPackageName: graphqlPath,
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

func newGraphQLServerPlugin(data *codegenData) plugin.Plugin {
	return &entGraphQLServerPlugin{
		codePath: data.codePath,
	}
}
