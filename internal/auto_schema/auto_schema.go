package auto_schema

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

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
		// running into weird issues with pipenv run python3 here
		args = append(
			[]string{
				//				"run",
				//				"python3",
				"auto_schema/cli/__init__.py",
			},
			args...,
		)
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
	var berr bytes.Buffer
	cmd.Stderr = &berr
	err := cmd.Run()
	if err != nil {
		return err
	}

	errMsg := strings.TrimSpace(berr.String())
	if len(errMsg) != 0 {
		return errors.New(errMsg)
	}
	return nil
}
