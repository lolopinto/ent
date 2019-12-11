package codegen

import (
	"path/filepath"
	"strconv"

	"github.com/lolopinto/ent/internal/util"
)

type CodePath struct {
	importPathToConfigs string
	importPathToModels  string
	importPathToRoot    string
	absPathToConfigs    string
}

func NewCodePath(configPath, modulePath string) *CodePath {
	rootPath, err := filepath.Abs(configPath)

	// TODO we need to store absPathToRoot at some point
	util.Die(err)
	return &CodePath{
		absPathToConfigs:    rootPath, // this is part to configs root but not root of dir TODO...
		importPathToRoot:    modulePath,
		importPathToConfigs: filepath.Join(modulePath, configPath),
		importPathToModels:  filepath.Join(modulePath, "models"),
	}
}

func (cp *CodePath) GetQuotedImportPathToConfigs() string {
	return strconv.Quote(cp.importPathToConfigs)
}

func (cp *CodePath) GetImportPathToModels() string {
	return cp.importPathToModels
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

func (cp *CodePath) AppendPathToModels(paths ...string) string {
	allPaths := append([]string{cp.importPathToModels}, paths...)
	return filepath.Join(allPaths...)
}

func (cp *CodePath) GetAbsPathToModels() string {
	return filepath.Join(cp.absPathToConfigs, "..")
}
