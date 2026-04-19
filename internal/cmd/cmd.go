package cmd

import (
	"os"
	"path/filepath"

	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"gopkg.in/yaml.v3"
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

const (
	runtimeNode       = "node"
	runtimeBun        = "bun"
	postgresDriverPG  = "pg"
	postgresDriverBun = "bun"
)

type runtimeConfig struct {
	Runtime        string `yaml:"runtime"`
	PostgresDriver string `yaml:"postgresDriver"`
}

func normalizeRuntime(runtime string) string {
	if runtime == runtimeBun {
		return runtimeBun
	}
	return runtimeNode
}

func normalizePostgresDriver(driver string) string {
	if driver == postgresDriverBun {
		return postgresDriverBun
	}
	return postgresDriverPG
}

func readRuntimeConfig(dirPath string) *runtimeConfig {
	paths := []string{
		"ent.yml",
		"src/ent.yml",
		"src/graphql/ent.yml",
	}

	for _, relPath := range paths {
		path := filepath.Join(dirPath, relPath)
		fi, err := os.Stat(path)
		if err != nil || fi.IsDir() {
			continue
		}
		b, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var cfg runtimeConfig
		if err := yaml.Unmarshal(b, &cfg); err != nil {
			continue
		}
		return &cfg
	}
	return nil
}

func getRuntime(dirPath string, fromTest bool) string {
	if runtime, ok := os.LookupEnv("ENT_RUNTIME"); ok {
		return normalizeRuntime(runtime)
	}
	if fromTest {
		return runtimeNode
	}
	cfg := readRuntimeConfig(dirPath)
	if cfg == nil {
		return runtimeNode
	}
	return normalizeRuntime(cfg.Runtime)
}

func getPostgresDriver(dirPath string, fromTest bool) string {
	if driver, ok := os.LookupEnv("ENT_POSTGRES_DRIVER"); ok {
		return normalizePostgresDriver(driver)
	}
	if fromTest {
		return postgresDriverPG
	}
	cfg := readRuntimeConfig(dirPath)
	if cfg == nil {
		return postgresDriverPG
	}
	return normalizePostgresDriver(cfg.PostgresDriver)
}

func UseSwc() bool {
	return util.EnvIsTrue("ENABLE_SWC")
}

type CommandInfo struct {
	Name    string
	Args    []string
	Env     []string
	UseSwc  bool
	Runtime string
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
	runtime := getRuntime(dirPath, fromTest)
	postgresDriver := getPostgresDriver(dirPath, fromTest)
	cmdName := "ts-node"
	var cmdArgs []string
	useSwc := UseSwc()

	if runtime == runtimeBun {
		cmdName = "bun"
		useSwc = false
	} else {
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
	}

	if useSwc {
		env = append(env, "ENABLE_SWC=true")
	}
	env = append(env, "ENT_RUNTIME="+runtime)
	env = append(env, "ENT_POSTGRES_DRIVER="+postgresDriver)

	// append LOCAL_SCRIPT_PATH so we know. in typescript...
	if util.EnvIsTrue("LOCAL_SCRIPT_PATH") {
		env = append(env, "LOCAL_SCRIPT_PATH=true")
	}

	return &CommandInfo{
		Name:    cmdName,
		Args:    cmdArgs,
		Env:     env,
		UseSwc:  useSwc,
		Runtime: runtime,
	}
}
