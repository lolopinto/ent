package devschema

import (
	"os"
	"path/filepath"
	"strings"
)

func findGitRoot(start string) string {
	if start == "" {
		return ""
	}
	dir := start
	for {
		if exists(filepath.Join(dir, ".git")) {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func resolveGitDir(gitPath string) string {
	if gitPath == "" {
		return ""
	}
	fi, err := os.Stat(gitPath)
	if err != nil {
		return ""
	}
	if fi.IsDir() {
		return gitPath
	}
	contents, err := os.ReadFile(gitPath)
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(contents))
	if !strings.HasPrefix(line, "gitdir:") {
		return ""
	}
	path := strings.TrimSpace(strings.TrimPrefix(line, "gitdir:"))
	if path == "" {
		return ""
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(filepath.Dir(gitPath), path)
	}
	return path
}

func branchFromGitDir(gitDir string) string {
	if gitDir == "" {
		return ""
	}
	headPath := filepath.Join(gitDir, "HEAD")
	b, err := os.ReadFile(headPath)
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(b))
	if !strings.HasPrefix(line, "ref:") {
		return ""
	}
	ref := strings.TrimSpace(strings.TrimPrefix(line, "ref:"))
	ref = strings.TrimPrefix(ref, "refs/heads/")
	return ref
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
