package input

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// TODO: environment variable flag for fromTest instead of passing it in
// TODO: environment variable or flag for src/schema path instead of hardcoding it here
func ParseSchemaFromTSDir(dirPath string, fromTest bool) (*Schema, error) {
	schemaPath := filepath.Join(dirPath, "src", "schema")
	info, err := os.Stat(schemaPath)
	if err != nil {
		return nil, errors.Wrap(err, "no schema directory")
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("expected schema to be a directory")
	}

	var cmdArgs []string
	cmdName := "ts-node"
	if fromTest {
		cmdArgs = []string{
			"--compiler-options",
			testingutils.DefaultCompilerOptions(),
		}
	} else {
		cmdName = "ts-node-script"
		cmdArgs = cmd.GetArgsForScript(dirPath)
	}

	cmdArgs = append(
		cmdArgs,
		util.GetPathToScript("scripts/read_schema.ts", fromTest),
		"--path",
		schemaPath,
	)
	execCmd := exec.Command(cmdName, cmdArgs...)

	var out bytes.Buffer
	var stderr bytes.Buffer
	execCmd.Stdout = &out
	execCmd.Stderr = &stderr
	if err := execCmd.Run(); err != nil {
		str := stderr.String()
		err = errors.Wrap(err, str)
		return nil, err
	}

	return ParseSchema(out.Bytes())
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
