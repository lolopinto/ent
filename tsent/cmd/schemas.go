package cmd

import (
	"fmt"
	"io"
	"os"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/tsent/cmd/generateschema"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

type schemasArg struct {
	file string
}

var schemasInfo schemasArg

// generate a schema
var generateSchemasCmd = &cobra.Command{
	Use:   "schemas",
	Short: "generate schemas",
	RunE: func(_ *cobra.Command, args []string) error {
		r, err := getBuffer()
		if err != nil {
			return err
		}
		b, err := io.ReadAll(r)
		if err != nil {
			return err
		}
		// skips useless keys hah
		s, err := input.ParseSchema(b)
		if err != nil {
			return err
		}

		codePathInfo, err := codegen.NewCodePath("src/schema", "")
		if err != nil {
			return err
		}
		// TODO check that the files don't already exist in the schema
		return generateschema.GenerateFromInputSchema(codePathInfo, s)
	},
}

func isPipe() (bool, error) {
	fi, err := os.Stdin.Stat()
	if err != nil {
		return false, err
	}

	return fi.Mode()&os.ModeCharDevice == 0, nil
}

func getBuffer() (io.Reader, error) {
	p, err := isPipe()
	if err != nil {
		return nil, err
	}
	if p {
		return os.Stdin, nil
	}

	if schemasInfo.file == "" {
		return nil, fmt.Errorf("please specify file")
	}

	info, err := os.Stat(schemasInfo.file)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("file doesn't exist")
	}
	if info.IsDir() {
		return nil, fmt.Errorf("directory specified. please specify file")
	}
	file, err := os.Open(schemasInfo.file)
	if err != nil {
		return nil, errors.Wrap(err, "error opening file")
	}

	return file, nil
}
