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
	if isRelativeImportPath(importPath) {
		return formatRelativeImportPath(cfg, importPath), nil
	}
	if !cfg.ShouldUseRelativePaths() || filePath == "" {
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
	if isDir && cfg.ShouldAddImportExtensions() {
		importPath = path.Join(importPath, "index")
	}
	addedTypeScriptExtension := false
	if !isDir && path.Ext(importPath) == "" {
		importPath += ".ts"
		addedTypeScriptExtension = true
	}
	importPath = path.Join(wd, importPath)

	relPath, err := filepath.Rel(path.Dir(filePath), importPath)
	if err != nil {
		return "", err
	}
	relPath = filepath.ToSlash(relPath)

	if !strings.HasPrefix(relPath, "..") {
		relPath = "./" + relPath
	}
	if addedTypeScriptExtension && !cfg.ShouldAddImportExtensions() {
		relPath = strings.TrimSuffix(relPath, ".ts")
	}
	return formatRelativeImportPath(cfg, relPath), nil
}

func isRelativeImportPath(importPath string) bool {
	return importPath == "." || importPath == ".." ||
		strings.HasPrefix(importPath, "./") || strings.HasPrefix(importPath, "../")
}

func formatRelativeImportPath(cfg Config, importPath string) string {
	importPath = filepath.ToSlash(importPath)
	if !cfg.ShouldAddImportExtensions() {
		return importPath
	}

	if strings.HasSuffix(importPath, "/") || importPath == "." || importPath == ".." {
		dotRelative := importPath == "." || strings.HasPrefix(importPath, "./")
		importPath = path.Join(importPath, "index")
		if dotRelative && !strings.HasPrefix(importPath, "./") {
			importPath = "./" + importPath
		}
	}

	ext := path.Ext(importPath)
	switch ext {
	case "":
		return importPath + ".js"
	case ".ts", ".tsx":
		return strings.TrimSuffix(importPath, ext) + ".js"
	case ".mts":
		return strings.TrimSuffix(importPath, ext) + ".mjs"
	case ".cts":
		return strings.TrimSuffix(importPath, ext) + ".cjs"
	default:
		return importPath
	}
}

func getErrorPath(cfg Config, filePath string) string {
	wd := cfg.GetAbsPathToRoot()
	if !path.IsAbs(filePath) {
		return filePath
	}
	p, err := filepath.Rel(wd, filePath)
	if err != nil {
		// any error here isn't important, just return what we got
		return filePath
	}
	return p

}

func GetRelativePathForRoot(cfg Config, filePath string) string {
	return getErrorPath(cfg, filePath)
}
