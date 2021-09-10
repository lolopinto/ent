package tsimport

import (
	"path"
	"path/filepath"
	"strings"
)

// always src/
// may eventually be something else but we don't support that yet
var prefix = "src/"

func getImportPath(cfg Config, filePath, importPath string) (string, error) {
	if !cfg.ShouldUseRelativePaths() || filePath == "" {
		return importPath, nil
	}
	if filePath == "" {
		return importPath, nil
	}
	wd := cfg.GetAbsPathToRoot()

	isDir := strings.HasSuffix(importPath, "/")

	// not trying to render src/blah, we don't care
	if !strings.HasPrefix(importPath, prefix) {
		return importPath, nil
	}
	if !path.IsAbs(filePath) {
		filePath = path.Join(wd, filePath)
	}
	importPath = path.Join(wd, importPath)

	if !isDir {
		importPath = importPath + ".ts"
	}
	relPath, err := filepath.Rel(path.Dir(filePath), importPath)
	if err != nil {
		return "", err
	}
	// retrim the suffix we added above
	if !isDir {
		relPath = strings.TrimSuffix(relPath, ".ts")
	}

	if !strings.HasPrefix(relPath, "..") {
		relPath = "./" + relPath
	}
	return relPath, nil
}
