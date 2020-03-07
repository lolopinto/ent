package input

import (
	"bytes"
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

func ParseSchemaFromTSDir(dirPath string) (*Schema, error) {
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
		// assumption is upper case file.
		// TODO need a better way to deal with scenarios where this isn't true
		schemas = append(schemas, schemaData{
			Name: strcase.ToCamel(match[1]),
			Path: match[1],
		})
	}

	fileName := filepath.Join(schemaPath, fmt.Sprintf("%d_read_schema.ts", time.Now().Unix()))

	if err := writeTsFile(fileName, schemas); err != nil {
		return nil, errors.Wrapf(err, "error writing temp file")
	}

	defer os.Remove(fileName)

	// TODO dependencies as needed docker file?
	execCmd := exec.Command("ts-node", fileName)
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

func GetAbsoluteSchemaPath() string {
	schemaPath := util.GetAbsolutePath("../../../ts/src/schema.ts")
	// trim the suffix for the import
	schemaPath = strings.TrimSuffix(schemaPath, ".ts")
	return schemaPath
}

func writeTsFile(fileToWrite string, schemas []schemaData) error {
	schemaPath := GetAbsoluteSchemaPath()

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
