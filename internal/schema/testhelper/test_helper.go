package testhelper

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func GetCodeWithSchema(code string) string {
	schemaPath := input.GetAbsoluteSchemaPathForTest()
	fieldPath := strings.Replace(schemaPath, "schema", "field", 1)

	r := strings.NewReplacer("{schema}", schemaPath, "{field}", fieldPath)
	return r.Replace(code)
}

func ParseInputSchemaForTest(t *testing.T, absPath string, code map[string]string) *input.Schema {
	dirPath, err := ioutil.TempDir(absPath, "project")
	// delete temporary created file
	defer os.RemoveAll(dirPath)
	require.NoError(t, err)

	schemaDir := filepath.Join(dirPath, "src", "schema")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	for fileName, contents := range code {
		path := filepath.Join(schemaDir, fileName)
		require.NoError(t, ioutil.WriteFile(path, []byte(contents), os.ModePerm))
	}

	inputSchema, err := input.ParseSchemaFromTSDir(dirPath, true)
	require.NoError(t, err)
	require.NotNil(t, inputSchema)

	return inputSchema
}

func ParseSchemaForTest(t *testing.T, absPath string, code map[string]string, lang base.Language) *schema.Schema {
	inputSchema := ParseInputSchemaForTest(t, absPath, code)
	s, err := schema.ParseFromInputSchema(inputSchema, lang)
	require.NoError(t, err)

	require.NotNil(t, s)
	return s
}
