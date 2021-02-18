package input

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/file"
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

	files, err := ioutil.ReadDir(schemaPath)
	if err != nil {
		return nil, err
		//		return nil, errors.Wrap(err, fmt.Sprintf("error reading dir %s", info.Name()))
	}

	r := regexp.MustCompile(`(\w+).ts$`)
	negR := regexp.MustCompile(`(\d+_read_schema).ts`)

	var schemas []schemaData
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		match := r.FindStringSubmatch(file.Name())
		// generated schema.py anything else...
		if len(match) != 2 {
			continue
		}
		// found a schema file from a previous broken thing. ignore
		if len(negR.FindStringSubmatch(file.Name())) == 2 {
			continue
		}
		// assumption is upper case file.
		// TODO need a better way to deal with scenarios where this isn't true
		schemas = append(schemas, schemaData{
			Name: strcase.ToCamel(match[1]),
			Path: match[1],
		})
	}

	fileName := filepath.Join(schemaPath, fmt.Sprintf("%d_read_schema.ts", time.Now().Unix()))

	err = writeTsFile(fileName, schemas, fromTest)
	defer os.Remove(fileName)

	if err != nil {
		return nil, errors.Wrapf(err, "error writing temp file")
	}

	// TODO dependencies as needed docker file?
	var execCmd exec.Cmd
	if fromTest {
		// no tsconfig-paths for tests...
		opts, err := json.Marshal(map[string]interface{}{"lib": []string{"esnext", "dom"}})
		if err != nil {
			return nil, errors.Wrap(err, "error creating json compiler options")
		}
		execCmd = *exec.Command("ts-node", "--compiler-options", string(opts), fileName)
	} else {
		execCmd = *exec.Command("ts-node", "-r", "tsconfig-paths/register", fileName)
	}

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

func writeTsFile(fileToWrite string, schemas []schemaData, fromTest bool) error {
	var schemaPath string
	if fromTest {
		// in tests, we don't have @lolopinto/ent installed so for now
		// since no node_modules (for now) so we use absolute path
		schemaPath = GetAbsoluteSchemaPathForTest()
	} else {
		schemaPath = "@lolopinto/ent/schema"
	}

	return file.Write(
		&file.TemplatedBasedFileWriter{
			Data: struct {
				Schemas    []schemaData
				SchemaPath string
			}{
				schemas,
				schemaPath,
			},
			AbsPathToTemplate: util.GetAbsolutePath("read_schema.tmpl"),
			TemplateName:      "read_schema.tmpl",
			PathToFile:        fileToWrite,
		},
		file.DisableLog(),
	)
}
