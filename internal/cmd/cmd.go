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

func (cmdInfo *CommandInfo) MaybeSetupSwcrc(dirPath string) func() {
	swcPath := filepath.Join(dirPath, ".swcrc")
	_, err := os.Stat(swcPath)

	shouldCleanup := false
	cleanup := func() {
		if shouldCleanup {
			os.Remove(swcPath)
		}
	}
	if err != nil && os.IsNotExist(err) {
		// temp .swcrc file to be used
		// probably need this for parse_ts too
		err = os.WriteFile(swcPath, []byte(`{
		"$schema": "http://json.schemastore.org/swcrc",
    "jsc": {
        "parser": {
            "syntax": "typescript",
            "decorators": true
        },
        "target": "es2020",
        "keepClassNames":true,
        "transform": {
            "decoratorVersion": "2022-03"
        }
    },
		"module": {
			"type": "commonjs",
		}
}
				`), os.ModePerm)

		if err == nil {
			shouldCleanup = true
		}
	}
	return cleanup
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
			"--esm",
			"--preferTsExts",
			"--compiler-options",
			testingutils.DefaultCompilerOptions(),
			"--transpileOnly",
		}
	} else {
		cmdName = "ts-node"

		if useSwc {
			// if using swc, skip ts-node and use node directly
			// we're going to do: node --loader @swc-node/register/esm -r tsconfig-paths/register
			cmdName = "node"
			cmdArgs = append(
				cmdArgs,
				"--loader",
				"@swc-node/register/esm",
			)

			env = append(env, "SWCRC=true")
		} else {
			cmdArgs = append(cmdArgs,
				"--esm",
				"--preferTsExts",
				"--project",
				filepath.Join(dirPath, "tsconfig.json"),
				"--transpileOnly",
			)
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
