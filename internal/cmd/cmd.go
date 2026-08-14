package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

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

type runtimeSelection struct {
	Runtime        string
	PostgresDriver string
	ModuleFormat   string
}

type runtimeConfig struct {
	Runtime        string `yaml:"runtime"`
	PostgresDriver string `yaml:"postgresDriver"`
	ModuleFormat   string `yaml:"moduleFormat"`
}

func parseRuntimeValue(runtime string) (string, error) {
	switch runtime {
	case "", "node":
		return "node", nil
	case "bun":
		return "bun", nil
	default:
		return "", fmt.Errorf("invalid runtime %q. valid values: node, bun", runtime)
	}
}

func parsePostgresDriverValue(driver string) (string, error) {
	switch driver {
	case "", "pg":
		return "pg", nil
	case "bun":
		return "bun", nil
	default:
		return "", fmt.Errorf("invalid postgresDriver %q. valid values: pg, bun", driver)
	}
}

func parseModuleFormatValue(moduleFormat string) (string, error) {
	switch moduleFormat {
	case "", "esm":
		return "esm", nil
	case "commonjs":
		return "commonjs", nil
	default:
		return "", fmt.Errorf("invalid moduleFormat %q. valid values: esm, commonjs", moduleFormat)
	}
}

func readRuntimeConfig(dirPath string) (*runtimeConfig, error) {
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
		if _, err := parseRuntimeValue(cfg.Runtime); err != nil {
			return nil, err
		}
		if _, err := parsePostgresDriverValue(cfg.PostgresDriver); err != nil {
			return nil, err
		}
		if _, err := parseModuleFormatValue(cfg.ModuleFormat); err != nil {
			return nil, err
		}
		return &cfg, nil
	}
	return nil, nil
}

func getRuntimeSelection(dirPath string, fromTest bool) (*runtimeSelection, error) {
	ret := &runtimeSelection{
		Runtime:        "node",
		PostgresDriver: "pg",
		ModuleFormat:   "esm",
	}

	var cfg *runtimeConfig
	if !fromTest {
		var err error
		cfg, err = readRuntimeConfig(dirPath)
		if err != nil {
			return nil, err
		}
	}

	if runtime, ok := os.LookupEnv("ENT_RUNTIME"); ok {
		val, err := parseRuntimeValue(runtime)
		if err != nil {
			return nil, err
		}
		ret.Runtime = val
	} else if cfg != nil {
		ret.Runtime, _ = parseRuntimeValue(cfg.Runtime)
	}

	if driver, ok := os.LookupEnv("ENT_POSTGRES_DRIVER"); ok {
		val, err := parsePostgresDriverValue(driver)
		if err != nil {
			return nil, err
		}
		ret.PostgresDriver = val
	} else if cfg != nil {
		ret.PostgresDriver, _ = parsePostgresDriverValue(cfg.PostgresDriver)
	}

	if moduleFormat, ok := os.LookupEnv("ENT_MODULE_FORMAT"); ok {
		val, err := parseModuleFormatValue(moduleFormat)
		if err != nil {
			return nil, err
		}
		ret.ModuleFormat = val
	} else if cfg != nil {
		ret.ModuleFormat, _ = parseModuleFormatValue(cfg.ModuleFormat)
	}

	return ret, nil
}

func UseSwc() bool {
	return util.EnvIsTrue("ENABLE_SWC")
}

type CommandInfo struct {
	Name         string
	Args         []string
	Env          []string
	UseSwc       bool
	Runtime      string
	ModuleFormat string
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

func GetCommandInfo(dirPath string, fromTest bool) (*CommandInfo, error) {
	env := os.Environ()
	selection, err := getRuntimeSelection(dirPath, fromTest)
	if err != nil {
		return nil, err
	}
	if err := validateEntToolingCompatibility(dirPath, fromTest); err != nil {
		return nil, err
	}
	runtime := string(selection.Runtime)
	postgresDriver := string(selection.PostgresDriver)
	moduleFormat := string(selection.ModuleFormat)
	cmdName := "node"
	cmdArgs := []string{
		util.GetPathToScript("scripts/run_tsx.js", dirPath, fromTest, runtime),
	}
	useSwc := false

	if selection.Runtime == "bun" {
		cmdName = "bun"
		cmdArgs = nil
	}

	if useSwc {
		env = append(env, "ENABLE_SWC=true")
	}
	env = append(env, "ENT_RUNTIME="+runtime)
	env = append(env, "ENT_POSTGRES_DRIVER="+postgresDriver)
	env = append(env, "ENT_MODULE_FORMAT="+moduleFormat)

	// append LOCAL_SCRIPT_PATH so we know. in typescript...
	if util.EnvIsTrue("LOCAL_SCRIPT_PATH") {
		env = append(env, "LOCAL_SCRIPT_PATH=true")
	}

	return &CommandInfo{
		Name:         cmdName,
		Args:         cmdArgs,
		Env:          env,
		UseSwc:       useSwc,
		Runtime:      runtime,
		ModuleFormat: moduleFormat,
	}, nil
}

func validateEntToolingCompatibility(dirPath string, fromTest bool) error {
	if fromTest || util.EnvIsTrue("LOCAL_SCRIPT_PATH") {
		return nil
	}

	packageDir := filepath.Join(
		dirPath,
		"node_modules",
		"@snowtop",
		"ent",
	)
	if _, err := os.Stat(packageDir); err != nil {
		// Preserve the existing missing-dependency error path. This guard is for
		// an installed but version-skewed Ent package.
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	packageJSONPath := filepath.Join(packageDir, "package.json")
	contents, err := os.ReadFile(packageJSONPath)
	if err != nil {
		return err
	}
	var packageJSON struct {
		EntToolingContract int `json:"entToolingContract"`
	}
	if err := json.Unmarshal(contents, &packageJSON); err != nil {
		return fmt.Errorf("could not read Ent tooling contract from %s: %w", packageJSONPath, err)
	}
	if packageJSON.EntToolingContract < 1 {
		return fmt.Errorf(
			"this tsent release requires @snowtop/ent's native-ESM tooling contract 1 (released in @snowtop/ent >=0.3.0). upgrade tsent and @snowtop/ent together",
		)
	}

	launcherPath := filepath.Join(packageDir, "scripts", "run_tsx.js")
	if _, err := os.Stat(launcherPath); err != nil {
		return fmt.Errorf(
			"@snowtop/ent declares tooling contract %d but its launcher %s is unavailable: %w",
			packageJSON.EntToolingContract,
			launcherPath,
			err,
		)
	}
	return nil
}
