package auto_schema

import (
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/lolopinto/ent/ent/data"
	"github.com/lolopinto/ent/internal/util"
)

func RunPythonCommand(pathToConfigs string, extraArgs ...string) error {
	return RunPythonCommandWriter(pathToConfigs, os.Stdout, extraArgs...)
}

func RunPythonCommandWriter(pathToConfigs string, w io.Writer, extraArgs ...string) error {
	local := os.Getenv("LOCAL_AUTO_SCHEMA") == "true"

	executable := "auto_schema"
	args := []string{
		fmt.Sprintf("-s=%s", pathToConfigs),
		fmt.Sprintf("-e=%s", data.GetSQLAlchemyDatabaseURIgo()),
	}
	if local {
		executable = "python3"
		args = append([]string{"auto_schema/cli/__init__.py"}, args...)
	}

	if len(extraArgs) > 0 {
		args = append(args, extraArgs...)
	}
	cmd := exec.Command(executable, args...)
	if local {
		cmd.Env = append(cmd.Env, "LOCAL_AUTO_SCHEMA=true")
		cmd.Dir = util.GetAbsolutePath("../../python/auto_schema")
	}
	cmd.Stdout = w
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
