package auto_schema

import (
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/lolopinto/ent/ent/data"
)

func RunPythonCommand(pathToConfigs string, extraArgs ...string) error {
	return RunPythonCommandWriter(pathToConfigs, os.Stdout, extraArgs...)
}

func RunPythonCommandWriter(pathToConfigs string, w io.Writer, extraArgs ...string) error {
	args := []string{
		fmt.Sprintf("-s=%s", pathToConfigs),
		fmt.Sprintf("-e=%s", data.GetSQLAlchemyDatabaseURIgo()),
	}
	if len(extraArgs) > 0 {
		args = append(args, extraArgs...)
	}
	cmd := exec.Command("auto_schema", args...)
	cmd.Stdout = w
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
