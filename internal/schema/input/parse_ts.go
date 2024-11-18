package input

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// TODO: environment variable flag for fromTest instead of passing it in
// TODO: environment variable or flag for src/schema path instead of hardcoding it here
func ParseSchemaFromTSDir(dirPath string, fromTest bool) (*Schema, error) {
	b, err := GetRawSchema(dirPath, fromTest)
	if err != nil {
		return nil, err
	}

	return ParseSchema(b)
}

func GetRawSchema(dirPath string, fromTest bool) ([]byte, error) {
	schemaPath := filepath.Join(dirPath, "src", "schema")
	info, err := os.Stat(schemaPath)
	if err != nil {
		return nil, errors.Wrap(err, "no schema directory")
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("expected schema to be a directory")
	}

	cmdInfo := cmd.GetCommandInfo(dirPath, fromTest)

	cmdArgs := append(
		cmdInfo.Args,
		util.GetPathToScript("scripts/read_schema.ts", fromTest),
		"--path",
		schemaPath,
	)
	execCmd := exec.Command(cmdInfo.Name, cmdArgs...)
	execCmd.Dir = dirPath

	var out bytes.Buffer
	execCmd.Stdout = &out
	execCmd.Stderr = os.Stderr
	execCmd.Env = cmdInfo.Env

	if cmdInfo.UseSwc {
		cleanup := cmdInfo.MaybeSetupSwcrc(dirPath)
		defer cleanup()
	}

	// flags not showing up in command but my guess is it's function of what's passed to process.argv
	if err := execCmd.Run(); err != nil {
		return nil, errors.Wrap(err, "error getting raw schema")
	}

	return out.Bytes(), nil
}

func GetAbsoluteRootPathForTest() string {
	return util.GetAbsolutePath("../../../ts/src/")
}

func GetAbsoluteSchemaPathForTest() string {
	schemaPath := util.GetAbsolutePath("../../../ts/src/schema/index.ts")
	// trim the suffix for the import
	schemaPath = strings.TrimSuffix(schemaPath, ".ts")
	return schemaPath
}
