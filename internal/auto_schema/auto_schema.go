package auto_schema

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/lolopinto/ent/ent/data"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

const WHICH_ERROR = "Warning: the which -a system utility is required for Pipenv to find Python installations properly.\n  Please install it."

func RunPythonCommand(cfg codegenapi.Config, extraArgs ...string) error {
	return RunPythonCommandWriter(cfg, os.Stdout, extraArgs...)
}

func RunPythonCommandWriter(cfg codegenapi.Config, w io.Writer, extraArgs ...string) error {
	pathToConfigs := cfg.GetRootPathToConfigs()
	local := os.Getenv("LOCAL_AUTO_SCHEMA") == "true"

	executable := "auto_schema"
	args := []string{
		fmt.Sprintf("-s=%s", pathToConfigs),
		fmt.Sprintf("-e=%s", data.GetSQLAlchemyDatabaseURIgo()),
	}

	if cfg.DebugMode() {
		args = append(args, "--debug")
	}

	if local {
		executable = "pipenv"
		args = append(
			[]string{
				"run",
				"python3",
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
	errMsg := trimErrorMsg(&berr, local)
	if err != nil {
		if len(errMsg) != 0 {
			return errors.Wrap(err, errMsg)
		}
		return err
	}

	if len(errMsg) != 0 {
		return errors.New(errMsg)
	}
	return nil
}

func trimErrorMsg(berr *bytes.Buffer, local bool) string {
	errMsg := strings.TrimSpace(berr.String())
	if !local {
		return errMsg
	}
	// TODO https://github.com/lolopinto/ent/issues/763
	// ignore WHICH_ERROR, make sure real errors are shown
	return strings.TrimPrefix(errMsg, WHICH_ERROR)
}
