package cmd

import (
	"path/filepath"

	"github.com/lolopinto/ent/internal/util"
)

func GetTsconfigPaths() string {
	return util.GetEnv("TSCONFIG_PATHS", "tsconfig-paths/register")
}

// initial args for ts-node-script
// we need tsconfig.json referenced because of relative paths like src/ent/generated/const.ts
func GetArgsForScript(rootPath string) []string {
	return []string{
		"--log-error", // TODO spend more time figuring this out
		"--project",
		// TODO this should find the tsconfig.json and not assume there's one at the root but fine for now
		// same in generate_ts_code.go
		filepath.Join(rootPath, "tsconfig.json"),
		"-r",
		GetTsconfigPaths(),
	}
}
