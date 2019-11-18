package codegen

import (
	"path/filepath"
	"strconv"

	"github.com/lolopinto/ent/internal/util"
)

type CodePath struct {
	PathToConfigs string
	PathToModels  string
	PathToRoot    string
}

func (cp *CodePath) AppendPathToModels(path string) string {
	unquotedPath, err := strconv.Unquote(cp.PathToModels)
	util.Die(err)
	return strconv.Quote(filepath.Join(unquotedPath, path))
}
