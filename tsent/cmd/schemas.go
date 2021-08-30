package cmd

import (
	"fmt"
	"io"
	"os"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/tsent/cmd/generateschema"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

type schemasArg struct {
	file  string
	force bool
}

var schemasInfo schemasArg

// generate a schema
var generateSchemasCmd = &cobra.Command{
	Use:   "schemas",
	Short: "generate schemas",
	Long: `generate multiple schemas by taking in a json file with the format that's generated in the codegen process. 
Not very user-friendly since some of the keys are slightly different from the TypeScript schema.
See https://github.com/lolopinto/ent/blob/main/internal/schema/input/input.go#L20-L29 and other places in that file for different keys

The json file can be specified via --file or piped through e.g. cat schema.json | tsent generate schemas`,
	Example: `tsent generate schemas --file schema.json
cat schema.json | tsent generate schemas
cat schema.json | tsent generate schemas --force`,
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
		if !schemasInfo.force {
			schema, err := parseSchema()
			if err != nil {
				return err
			}
			for k := range s.Nodes {
				schemaName := base.GetCamelName(k)

				if schema.NameExists(schemaName) {
					return fmt.Errorf("cannot generate a schema for %s since schema with name already exists", schemaName)
				}
			}
		}

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}
		return generateschema.GenerateFromInputSchema(cfg, s)
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
