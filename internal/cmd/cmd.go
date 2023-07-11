package cmd

import (
	"os"
	"path/filepath"

	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
)

func GetTsconfigPaths() string {
	return util.GetEnv("TSCONFIG_PATHS", "tsconfig-paths/register")
}

// initial args for ts-node-script
// we need tsconfig.json referenced because of relative paths like src/ent/generated/types.ts
func GetArgsForTsNodeScript(rootPath string) []string {
	return []string{
		// this seems to let the errors pass through as opposed to giving compile error
		"--log-error", // TODO spend more time figuring this out
		"--project",
		// TODO this should find the tsconfig.json and not assume there's one at the root but fine for now
		// same in generate_ts_code.go
		filepath.Join(rootPath, "tsconfig.json"),
		"--transpileOnly",
		"-r",
		GetTsconfigPaths(),
	}
}

func UseSwc() bool {
	return util.EnvIsTrue("ENABLE_SWC")
}

type CommandInfo struct {
	Name   string
	Args   []string
	Env    []string
	UseSwc bool
}

func GetCommandInfo(dirPath string, fromTest bool) *CommandInfo {
	env := os.Environ()
	cmdName := "ts-node"
	var cmdArgs []string
	useSwc := UseSwc()

	// no swc with tests right now because we need -r configured locally
	// we'll always use ts-node
	if fromTest {
		cmdArgs = []string{
			"--compiler-options",
			testingutils.DefaultCompilerOptions(),
			"--transpileOnly",
		}
	} else {
		cmdName = "ts-node-script"

		if useSwc {
			// if using swc, skip ts-node and use node directly
			// we're going to do: node -r @swc-node/register -r tsconfig-paths/register
			cmdName = "node"
			cmdArgs = append(
				cmdArgs,
				"-r",
				"@swc-node/register",
			)

			env = append(env, "SWCRC=true")
		} else {
			cmdArgs = append(cmdArgs, GetArgsForTsNodeScript(dirPath)...)
		}

		// for paths like src/ent/generated/types.ts
		cmdArgs = append(cmdArgs, "-r", GetTsconfigPaths())
	}

	if useSwc {
		env = append(env, "ENABLE_SWC=true")
	}

	// append LOCAL_SCRIPT_PATH so we know. in typescript...
	if util.EnvIsTrue("LOCAL_SCRIPT_PATH") {
		env = append(env, "LOCAL_SCRIPT_PATH=true")
	}

	return &CommandInfo{
		Name:   cmdName,
		Args:   cmdArgs,
		Env:    env,
		UseSwc: useSwc,
	}
}
