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
func GetArgsForScript(rootPath string) []string {
	return append(
		getArgsForScriptBoth(rootPath),
		"-r",
		"@swc-node/register",
	)
}

func GetArgsForScriptSwc(rootPath string) []string {
	return append(
		getArgsForScriptBoth(rootPath),
		"-r",
		GetTsconfigPaths(),
	)
}

func getArgsForScriptBoth(rootPath string) []string {
	return []string{
		// this seems to let the errors pass through as opposed to giving compile error
		"--log-error", // TODO spend more time figuring this out
		"--project",
		// TODO this should find the tsconfig.json and not assume there's one at the root but fine for now
		// same in generate_ts_code.go
		filepath.Join(rootPath, "tsconfig.json"),
		// "-r",
		// GetTsconfigPaths(),
	}
}

func UseSwc() bool {
	return !util.EnvIsTrue("DISABLE_SWC")
}

// func GetCommand()

type CommandInfo struct {
	Name   string
	Args   []string
	Env    []string
	UseSwc bool
}

func GetCommandInfo(dirPath string, fromTest bool) *CommandInfo {
	var env []string
	cmdName := "ts-node"
	var cmdArgs []string
	useSwc := false

	if UseSwc() {
		cmdArgs = append(
			getArgsForScriptBoth(dirPath),
			"-r", "@swc-node/register",
		)

		env = append(os.Environ(), "SWCRC=true")

		useSwc = true
	} else if fromTest {
		// TODO if in swc do we need this?
		cmdArgs = []string{
			"--compiler-options",
			testingutils.DefaultCompilerOptions(),
		}
	} else {
		cmdName = "ts-node-script"

		cmdArgs = GetArgsForScript(dirPath)
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
