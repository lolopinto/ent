package codegen

import (
	"path/filepath"
	"strconv"

	"github.com/lolopinto/ent/internal/util"
)

type CodePath struct {
	relativePathToConfigs string
	importPathToConfigs   string
	importPathToModels    string
	importPathToRoot      string
	absPathToConfigs      string
}

func NewCodePath(configPath, modulePath string) *CodePath {
	// TODO all this logic is dependent on passing "models/configs". TODO fix it
	rootPath, err := filepath.Abs(configPath)

	// TODO we need to store absPathToRoot at some point
	util.Die(err)
	return &CodePath{
		relativePathToConfigs: configPath,
		absPathToConfigs:      rootPath, // this is part to configs root but not root of dir TODO...
		importPathToRoot:      modulePath,
		importPathToConfigs:   filepath.Join(modulePath, configPath),
		importPathToModels:    filepath.Join(modulePath, "models"),
	}
}

func (cp *CodePath) OverrideImportPathToModels(importPath string) {
	cp.importPathToModels = importPath
}

func (cp *CodePath) GetQuotedImportPathToConfigs() string {
	return strconv.Quote(cp.importPathToConfigs)
}

func (cp *CodePath) GetImportPathToModels() string {
	return cp.importPathToModels
}

func (cp *CodePath) GetImportPathToGraphQL() string {
	return filepath.Join(cp.importPathToRoot, "graphql")
}

func (cp *CodePath) GetQuotedImportPathToModels() string {
	return strconv.Quote(cp.importPathToModels)
}

func (cp *CodePath) GetImportPathToRoot() string {
	return cp.importPathToRoot
}

func (cp *CodePath) GetRootPathToConfigs() string {
	return cp.absPathToConfigs
}

func (cp *CodePath) GetRelativePathToConfigs() string {
	return cp.relativePathToConfigs
}

func (cp *CodePath) AppendPathToModels(paths ...string) string {
	allPaths := append([]string{cp.importPathToModels}, paths...)
	return filepath.Join(allPaths...)
}

func (cp *CodePath) GetAbsPathToModels() string {
	return filepath.Join(cp.absPathToConfigs, "..")
}

func (cp *CodePath) GetAbsPathToRoot() string {
	return filepath.Join(cp.absPathToConfigs, "../..")
}

func (cp *CodePath) GetAbsPathToGraphQL() string {
	return filepath.Join(cp.absPathToConfigs, "../..", "graphql")
}

func init() {
	impPkg = &ImportPackage{
		PackagePath:        Package,
		AuthPackagePath:    AuthPackage,
		ActionPackagePath:  ActionPackage,
		SchemaPackagePath:  SchemaPackage,
		GraphQLPackagePath: GraphQLPackage,
	}
}

var impPkg *ImportPackage

func (cp *CodePath) GetImportPackage() *ImportPackage {
	return impPkg
}

// Package refers to the name of the package
const Package = "@lolopinto/ent"

// ActionPackage refers to the name of the action package
const ActionPackage = Package + "/action"

// AuthPackage refers to the name of the auth package where ent-auth stuff is
// TODO
const AuthPackage = Package + "/auth"

// SchemaPackage refers to the name of the schema package
const SchemaPackage = Package + "/schema"

// GraphQLPackage refers to the name of the graphql package
const GraphQLPackage = Package + "/graphql"

// ImportPackage refers to TypeScript paths of what needs to be generated for imports
type ImportPackage struct {
	PackagePath        string
	AuthPackagePath    string
	ActionPackagePath  string
	SchemaPackagePath  string
	GraphQLPackagePath string
}
