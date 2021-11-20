package util

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/codepath"
)

// path should be scripts/...
// e.g. scripts/custom_graphql.ts
func GetPathToScript(path string, fromTest bool) string {
	// TODO
	return "/Users/ola/code/ent/ts/src/" + path
	// need something for local development
	if fromTest {
		return GetAbsolutePath("../../ts/src/" + path)
	}
	path = strings.Replace(path, ".ts", ".js", 1)

	// local...
	// this assumes package already installed
	return fmt.Sprintf("./node_modules/%s/%s", codepath.Package, path)
}
