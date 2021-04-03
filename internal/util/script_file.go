package util

import (
	"fmt"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/codepath"
)

// path should be scripts/...
// e.g. scripts/custom_graphql.ts
func GetPathToScript(path string, fromTest bool) string {
	if fromTest {
		ret := GetAbsolutePath("../../ts/src/" + path)
		spew.Dump(ret)
		return ret
	}
	path = strings.Replace(path, ".ts", ".js", 1)

	// local...
	// this assumes package already installed
	ret := fmt.Sprintf("./node_modules/%s/%s", codepath.Package, path)
	spew.Dump(ret)
	return ret
}
