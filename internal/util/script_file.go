package util

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/codepath"
)

// path should be scripts/...
// e.g. scripts/custom_graphql.ts
func GetPathToScript(path string, dirPath string, fromTest bool, runtime string) string {
	local := EnvIsTrue("LOCAL_SCRIPT_PATH")
	if fromTest || local || shouldUseLocalScriptPath(dirPath, runtime) {
		return GetAbsolutePath("../../ts/src/" + path)
	}
	path = strings.Replace(path, ".ts", ".js", 1)

	// local...
	// this assumes package already installed
	return fmt.Sprintf("./node_modules/%s/%s", codepath.Package, path)
}

func shouldUseLocalScriptPath(dirPath string, runtime string) bool {
	if runtime != "bun" || dirPath == "" {
		return false
	}
	absDir, err := filepath.Abs(dirPath)
	if err != nil {
		return false
	}
	repoRoot := GetAbsolutePath("../../")
	rel, err := filepath.Rel(repoRoot, absDir)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
