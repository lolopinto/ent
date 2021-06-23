package input

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// TODO probably want an environment variable flag here instead
func ParseSchemaFromTSDir(dirPath string, fromTest bool) (*Schema, error) {
	// TODO provide flag for this and pass it here
	schemaPath := filepath.Join(dirPath, "src", "schema")
	info, err := os.Stat(schemaPath)
	if err != nil {
		return nil, errors.Wrap(err, "no schema file")
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("expected schema to be a directory")
	}

	// TODO dependencies as needed docker file?

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
	spew.Dump("command", cmdName, cmdArgs)

	return ParseSchema(out.Bytes())
}

type schemaData struct {
	Name string
	Path string
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
