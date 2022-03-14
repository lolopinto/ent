package util

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/codepath"
)

// path should be scripts/...
// e.g. scripts/custom_graphql.ts
func GetPathToScript(path string, fromTest bool) string {
	// NOTE: be careful with this for custom_graphql since the instances of
	// GQLCapture vary...
	local := EnvIsTrue("LOCAL_SCRIPT_PATH")
	if fromTest || local {
		return GetAbsolutePath("../../ts/src/" + path)
	}
	path = strings.Replace(path, ".ts", ".js", 1)

	// local...
	// this assumes package already installed
	return fmt.Sprintf("./node_modules/%s/%s", codepath.Package, path)
}
